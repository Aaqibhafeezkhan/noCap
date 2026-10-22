"""openai-whisper (PyTorch) backend and the shared model-checkpoint lookup."""
from __future__ import annotations

import functools
import os
from pathlib import Path

from nocap.i18n import msg


def run(
    audio_arr,
    *,
    language: str | None,
    initial_prompt: str | None,
    beam_size: int,
    temperature: float,
    condition_on_previous_text: bool = True,
) -> dict:
    """Transcribe using openai-whisper (PyTorch) with DTW word timestamps."""
    import whisper  # raises ImportError if not installed → caller falls back

    bundled = bundled_whisper_dir()
    model = whisper.load_model(
        model_name(), device=torch_device(),
        download_root=str(bundled) if bundled else None,
    )
    raw = whisper.transcribe(
        model,
        audio_arr,
        language=language,
        word_timestamps=True,
        initial_prompt=initial_prompt,
        beam_size=beam_size,
        temperature=temperature,
        condition_on_previous_text=condition_on_previous_text,
        verbose=False,
    )
    return normalize_result(raw)


def normalize_result(raw: dict) -> dict:
    """Reduce an openai-whisper style result to text, language and timed words."""
    segments = []
    for seg in raw.get("segments", []):
        words = [
            {
                "word": w.get("word", "").strip(),
                "start": float(w.get("start", 0.0)),
                "end": float(w.get("end", 0.0)),
                "probability": float(w.get("probability", 1.0)),
            }
            for w in seg.get("words", [])
        ]
        segments.append({
            "text": seg.get("text", "").strip(),
            "start": float(seg.get("start", 0.0)),
            "end": float(seg.get("end", 0.0)),
            "words": words,
        })
    return {
        "text": raw.get("text", "").strip(),
        "language": raw.get("language", "en"),
        "segments": segments,
    }


def bundled_whisper_dir() -> Path | None:
    """Return the whisper models dir shipped inside the app bundle, or None in dev mode."""
    resources = os.environ.get("NOCAP_RESOURCES")
    if resources:
        d = Path(resources) / "whisper_models"
        if d.exists():
            return d
    return None


def checkpoint_dir() -> Path:
    bundled = bundled_whisper_dir()
    return bundled if bundled else Path(os.path.expanduser("~/.cache/whisper"))


@functools.lru_cache(maxsize=None)
def model_name() -> str:
    """Return the model name to use for openai-whisper (prefers already-cached models)."""
    search_dir = checkpoint_dir()
    override = os.environ.get("NOCAP_WHISPER_MODEL", "").strip()
    if override:  # e.g. "large-v3-turbo" (used by the accuracy benchmark)
        return override
    for name in ("medium.en", "medium"):
        if (search_dir / f"{name}.pt").exists():
            return name
    if bundled_whisper_dir():
        raise FileNotFoundError(msg("audio.needWhisperModel", path=search_dir))
    return "medium.en"  # will be downloaded on first run


@functools.lru_cache(maxsize=None)
def torch_device() -> str:
    # MPS (Apple Silicon) is intentionally skipped: openai-whisper internally
    # creates float64 tensors which MPS does not support, causing a runtime error.
    # Apple Silicon gets GPU decoding through the MLX backend instead.
    try:
        import torch
        if torch.cuda.is_available():
            return "cuda"
    except ImportError:
        pass
    return "cpu"
