"""The whisper.cpp backend: run the binary, stream its progress, return the normalized result."""
from __future__ import annotations

import functools
import json
import os
import re
import shutil
import subprocess
import tempfile
import wave
from pathlib import Path

from nocap.audio import stem_decoding
from nocap.audio.whisper_cpp_json import normalize_whisper_cpp_json
from nocap.i18n import msg

DEFAULT_WHISPER_CPP_MODEL = "medium.en"
DEFAULT_WHISPER_CPP_MODEL_PATH = (
    Path(__file__).resolve().parents[2]
    / "vendor"
    / "whisper.cpp"
    / "models"
    / "ggml-medium.en.bin"
)


def run(
    audio_arr,
    *,
    language: str | None,
    initial_prompt: str | None,
    beam_size: int,
    temperature: float | tuple[float, ...],
    condition_on_previous_text: bool = True,
    whisper_progress_callback=None,
    no_speech_threshold: float | None = None,  # not supported by whisper.cpp; accepted and ignored
    compression_ratio_threshold: float | None = None,  # likewise
) -> dict:
    temperature = stem_decoding.first_temperature(temperature)
    model_path = _resolve_model_path()
    binary = _resolve_whisper_cpp_binary()

    with tempfile.TemporaryDirectory(prefix="nocap-whisper-cpp-") as tmp_dir:
        tmp_path = Path(tmp_dir)
        wav_path = tmp_path / "input.wav"
        output_base = tmp_path / "transcript"
        _write_wav_16k(wav_path, audio_arr)

        cmd = [
            str(binary),
            "-m", str(model_path),
            "-f", str(wav_path),
            "-l", language or "en",
            "-ojf",
            "-of", str(output_base),
            "-ml", "1",
            "-bs", str(beam_size),
            "-tp", str(temperature),
            "-sns",
        ]
        if initial_prompt:
            cmd.extend(["--prompt", initial_prompt])
        if not condition_on_previous_text:
            cmd.extend(["-mc", "0"])  # no text context from previous windows

        # Add DTW-based word timestamps when the binary supports it.
        # -dtw MODEL enables cross-attention DTW alignment (≈10 ms accuracy vs 20 ms
        # quantized from plain -ml 1), matching what openai/whisper word_timestamps=True does.
        dtw_name = _dtw_model_name(model_path)
        if dtw_name and _check_dtw_support(str(binary)):
            cmd.extend(["-dtw", dtw_name])

        ok, details = _stream_whisper_subprocess(cmd, whisper_progress_callback)
        if not ok and "ggml_metal_buffer_init" in details:
            ok, details = _stream_whisper_subprocess([*cmd, "-ng"], None)
        if not ok:
            raise RuntimeError(msg("audio.whisperCppFailed", error=details))

        json_path = output_base.with_suffix(".json")
        if not json_path.exists():
            raise RuntimeError(msg("audio.whisperCppNoOutput", path=json_path))
        with json_path.open("r", encoding="utf-8") as f:
            return normalize_whisper_cpp_json(json.load(f))


@functools.lru_cache(maxsize=None)
def _check_dtw_support(binary_str: str) -> bool:
    """Return True if the binary supports the -dtw flag (result cached per binary path)."""
    try:
        result = subprocess.run(
            [binary_str, "--help"],
            capture_output=True, text=True, timeout=10,
        )
        return "dtw" in (result.stdout + result.stderr).lower()
    except Exception:
        return False


def _dtw_model_name(model_path: Path) -> str | None:
    """Derive model name for -dtw flag from a standard ggml filename.

    ``ggml-medium.en.bin`` → ``"medium.en"``
    Returns None for unrecognised filenames so DTW is silently skipped.
    """
    stem = model_path.stem  # e.g. "ggml-medium.en"
    if stem.startswith("ggml-"):
        return stem[5:]
    return None


def _stream_whisper_subprocess(cmd: list[str], progress_callback) -> tuple[bool, str]:
    """Run whisper.cpp and stream progress percentages from stderr in real time."""
    import threading

    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
    )
    stderr_lines: list[str] = []

    def _read_stderr() -> None:
        assert proc.stderr is not None
        for line in proc.stderr:
            stderr_lines.append(line)
            if progress_callback:
                m = re.search(r'progress\s*=\s*(\d+)\s*%', line)
                if m:
                    progress_callback(int(m.group(1)))

    reader = threading.Thread(target=_read_stderr, daemon=True)
    reader.start()
    proc.wait()
    reader.join(timeout=5)
    details = "".join(stderr_lines).strip()
    return proc.returncode == 0, details


def _resolve_model_path() -> Path:
    env_path = os.environ.get("NOCAP_WHISPER_CPP_MODEL")
    if env_path and Path(env_path).expanduser().exists():
        return Path(env_path).expanduser().resolve()

    model_path = DEFAULT_WHISPER_CPP_MODEL_PATH
    if model_path.exists():
        return model_path.resolve()

    raise FileNotFoundError(msg("audio.needWhisperCppModel", path=model_path))


def _resolve_whisper_cpp_binary() -> Path:
    env_path = os.environ.get("NOCAP_WHISPER_CPP_BIN")
    path_binary = shutil.which("whisper-cli") or shutil.which("whisper-cpp") or shutil.which("whispercpp")
    candidates = [
        Path(env_path).expanduser() if env_path else None,
        Path(__file__).resolve().parents[2] / "vendor" / "whisper.cpp" / "build" / "bin" / "whisper-cli",
        Path(path_binary) if path_binary else None,
    ]
    for candidate in candidates:
        if candidate and candidate.exists() and os.access(candidate, os.X_OK):
            return candidate.resolve()
    raise FileNotFoundError(msg("audio.needWhisperCpp"))


def _write_wav_16k(path: Path, audio_arr) -> None:
    import numpy as np

    clipped = np.clip(audio_arr, -1.0, 1.0)
    pcm = (clipped * 32767.0).astype(np.int16)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        wav.writeframes(pcm.tobytes())
