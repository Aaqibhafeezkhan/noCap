from __future__ import annotations

import functools
import json
import logging
import os
import re
import shutil
import subprocess
import tempfile
import wave
from dataclasses import dataclass, field
from pathlib import Path

from nocap.i18n import msg
from nocap.audio import gap_repair, hallucination, vocal_segments
from nocap.audio.loader import AudioData, resample_to_16k
from nocap.text.parser import TimedLine


@dataclass
class TranscriptWord:
    word: str
    start: float    # seconds
    end: float      # seconds
    probability: float = 1.0


@dataclass
class TranscriptResult:
    text: str
    language: str
    # segment-level lines (always populated)
    timed_lines: list[TimedLine]
    # word-level timestamps emitted by whisper.cpp JSON output
    words: list[TranscriptWord] = field(default_factory=list)

    @property
    def has_word_timestamps(self) -> bool:
        return len(self.words) > 0


def require_word_timestamps(result: TranscriptResult) -> None:
    if not result.has_word_timestamps:
        raise ValueError(msg("audio.needWordTimestamps"))


DEFAULT_WHISPER_CPP_MODEL = "medium.en"
DEFAULT_WHISPER_CPP_MODEL_PATH = (
    Path(__file__).resolve().parents[2]
    / "vendor"
    / "whisper.cpp"
    / "models"
    / "ggml-medium.en.bin"
)

logger = logging.getLogger(__name__)

HIP_HOP_PROMPT = None  # prompt causes hallucination on vocal stems; omit


def transcribe(
    audio: AudioData,
    language: str | None = None,
    progress_callback=None,
    initial_prompt: str | None = None,
    beam_size: int = 5,
    temperature: float = 0.0,
    whisper_progress_callback=None,
    vocal_stem: bool = False,
) -> TranscriptResult:
    if progress_callback:
        progress_callback(msg("audio.loadingWhisperModel"))
    if progress_callback:
        progress_callback(msg("audio.transcribing"))

    audio_arr = resample_to_16k(audio)
    options = dict(language=language, initial_prompt=initial_prompt, beam_size=beam_size, temperature=temperature)
    if vocal_stem and vocal_segments.enabled():  # one decode per sung phrase group
        result = vocal_segments.transcribe(audio_arr, lambda clip: _run_backends(clip, condition_on_previous_text=False, **options))
    else:
        result = _run_backends(audio_arr, whisper_progress_callback=whisper_progress_callback, **options)
    words = _filter_words(_extract_words(result))
    if vocal_stem:  # fill holes where the stem is sung but the first pass found nothing
        def decode_clip(clip):
            clip_result = _run_backends(clip, condition_on_previous_text=False, **options)
            return _filter_words(_extract_words(clip_result))
        words = gap_repair.repair(audio_arr, words, decode_clip)
    words = hallucination.clean(audio_arr, words, vocal_stem)
    timed_lines = _segments_to_timed_lines(result)

    return TranscriptResult(
        text=result.get("text", "").strip(),
        language=result.get("language", "en"),
        timed_lines=timed_lines,
        words=words,
    )


def words_to_timed_lines(words: list[TranscriptWord], pause_threshold: float = 0.6) -> list[TimedLine]:
    """Group word-level timestamps into lyric lines by detecting pauses."""
    if not words:
        return []

    lines: list[TimedLine] = []
    current_words: list[TranscriptWord] = [words[0]]

    for w in words[1:]:
        gap = w.start - current_words[-1].end
        if gap > pause_threshold:
            lines.append(TimedLine(
                start=round(current_words[0].start, 3),
                text=" ".join(cw.word for cw in current_words),
            ))
            current_words = [w]
        else:
            current_words.append(w)

    if current_words:
        lines.append(TimedLine(
            start=round(current_words[0].start, 3),
            text=" ".join(cw.word for cw in current_words),
        ))

    return lines


# ── Internal helpers ──────────────────────────────────────────────────────────

def _run_backends(audio_arr, *, whisper_progress_callback=None, **options) -> dict:
    """Run the first working backend: MLX (Apple GPU) → openai-whisper → whisper.cpp.

    Both Python backends use cross-attention DTW for word timestamps (~10 ms);
    whisper.cpp timestamps are quantised to 20 ms and its -dtw flag is less
    reliable, so it is the last resort. NOCAP_WHISPER_BACKEND=mlx|torch|cpp
    pins one backend.
    """
    from nocap.audio import whisper_mlx, whisper_torch

    choice = os.environ.get("NOCAP_WHISPER_BACKEND", "auto").strip().lower()
    if choice in ("auto", "mlx") and whisper_mlx.is_available():
        try:
            return whisper_mlx.run(audio_arr, **options)
        except Exception as exc:  # GPU/conversion problems must not fail the analysis
            if choice == "mlx":
                raise
            logger.warning("MLX whisper failed, falling back to PyTorch: %s", exc)
    if choice != "cpp":
        try:
            return whisper_torch.run(audio_arr, **options)
        except ImportError:
            pass
    return _run_whisper_cpp(audio_arr, whisper_progress_callback=whisper_progress_callback, **options)


def _run_whisper_cpp(
    audio_arr,
    *,
    language: str | None,
    initial_prompt: str | None,
    beam_size: int,
    temperature: float,
    condition_on_previous_text: bool = True,
    whisper_progress_callback=None,
) -> dict:
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
            return _normalize_whisper_cpp_json(json.load(f))


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


def _normalize_whisper_cpp_json(data: dict) -> dict:
    transcription = data.get("transcription", [])
    segments = []
    for item in transcription:
        text = item.get("text", "").strip()
        if _is_special_token_text(text):
            text = ""
        start = _seconds_from_whisper_cpp_item(item, "from")
        end = _seconds_from_whisper_cpp_item(item, "to")
        segment = {"text": text, "start": start, "end": end}
        if _is_word_text(text):
            word = _item_word(item, text, start, end)
            segment["words"] = [word]
        segments.append(segment)

    return {
        "text": " ".join(seg["text"] for seg in segments if seg.get("text")).strip(),
        "language": data.get("result", {}).get("language", "en"),
        "segments": segments,
    }


def _item_word(item: dict, text: str, start: float, end: float) -> dict:
    token = _first_word_token(item)
    probability = float(token.get("p", 1.0)) if token else 1.0

    # Prefer DTW-aligned start when available — it is derived from cross-attention
    # alignment and gives ≈10 ms accuracy vs 20 ms-quantized segment boundaries.
    dtw_start = _token_dtw_start(token) if token else None
    if dtw_start is not None and 0.0 <= dtw_start <= end + 1.0:
        start = dtw_start

    token_end = _token_end(token) if token else None
    if token_end is not None and token_end > start + 0.02:
        end = min(end, token_end)
    return {"word": text, "start": start, "end": end, "probability": probability}


def _first_word_token(item: dict) -> dict | None:
    for token in item.get("tokens", []):
        text = token.get("text", "").strip()
        if _is_word_text(text):
            return token
    return None


def _token_end(token: dict | None) -> float | None:
    if not token:
        return None
    timestamps = token.get("timestamps")
    if not timestamps:
        return None
    return _seconds_from_timestamp(timestamps.get("to", "0"))


def _token_dtw_start(token: dict | None) -> float | None:
    """Return DTW-aligned token start in seconds, or None if unavailable.

    whisper.cpp stores ``t_dtw`` as a raw centisecond integer (10 ms/unit),
    the same internal unit as ``t0`` / ``t1`` before they are scaled to ms in
    the ``offsets`` field.  A negative value (-1) means DTW was not computed.
    """
    if not token:
        return None
    t_dtw = token.get("t_dtw")
    if t_dtw is None:
        return None
    val = int(t_dtw)
    if val < 0:
        return None
    return val / 100.0  # centiseconds → seconds


def _seconds_from_whisper_cpp_item(item: dict, key: str) -> float:
    offsets = item.get("offsets", {})
    if key in offsets:
        return float(offsets[key]) / 1000.0
    timestamps = item.get("timestamps", {})
    return _seconds_from_timestamp(timestamps.get(key, "0"))


def _is_special_token_text(text: str) -> bool:
    return bool(re.fullmatch(r"\[[A-Z0-9_ -]+\]", text))


def _is_word_text(text: str) -> bool:
    return bool(text and not _is_special_token_text(text) and re.search(r"[A-Za-z0-9']", text))


def _seconds_from_timestamp(value: str) -> float:
    value = value.replace(",", ".")
    parts = value.split(":")
    if len(parts) == 3:
        hours, minutes, seconds = parts
        return int(hours) * 3600 + int(minutes) * 60 + float(seconds)
    if len(parts) == 2:
        minutes, seconds = parts
        return int(minutes) * 60 + float(seconds)
    return float(value or 0)


def _extract_words(result: dict) -> list[TranscriptWord]:
    words: list[TranscriptWord] = []
    for seg in result.get("segments", []):
        for w in seg.get("words", []):
            text = w.get("word", "").strip()
            if not text:
                continue
            words.append(TranscriptWord(
                word=text,
                start=float(w.get("start", 0.0)),
                end=float(w.get("end", 0.0)),
                probability=float(w.get("probability", 1.0)),
            ))
    return words


def _filter_words(words: list[TranscriptWord]) -> list[TranscriptWord]:
    """Remove words with very low Whisper confidence scores."""
    return [w for w in words if w.probability >= 0.25]


def _segments_to_timed_lines(result: dict) -> list[TimedLine]:
    lines: list[TimedLine] = []
    for seg in result.get("segments", []):
        text = seg.get("text", "").strip()
        if text:
            lines.append(TimedLine(
                start=round(float(seg.get("start", 0.0)), 3),
                text=text,
            ))
    return lines
