from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Callable

from nocap.i18n import msg
from nocap.audio import gap_repair, hallucination, stem_decoding, vocal_segments
from nocap.audio.loader import AudioData, resample_to_16k
# Re-exported: these constants used to be defined here.
from nocap.audio.whisper_cpp import DEFAULT_WHISPER_CPP_MODEL, DEFAULT_WHISPER_CPP_MODEL_PATH  # noqa: F401
from nocap.audio.whisper_cpp import run as _run_whisper_cpp
from nocap.pipeline.progress import scaled, track_progress
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
    on_progress: Callable[[float], None] | None = None,
) -> TranscriptResult:
    if progress_callback:
        progress_callback(msg("audio.loadingWhisperModel"))
    if progress_callback:
        progress_callback(msg("audio.transcribing"))

    audio_arr = resample_to_16k(audio)
    options = dict(language=language, initial_prompt=initial_prompt, beam_size=beam_size, temperature=temperature)
    options = stem_decoding.options(options, vocal_stem)
    progress = on_progress or (lambda _fraction: None)  # first pass 0–85 %, gap repair the rest
    with track_progress(scaled(progress, 0.0, 0.85)):
        if vocal_stem and vocal_segments.enabled():  # one decode per sung phrase group
            result = vocal_segments.transcribe(audio_arr, lambda clip: _run_backends(clip, condition_on_previous_text=False, **options))
        else:
            result = _run_backends(audio_arr, whisper_progress_callback=whisper_progress_callback, **options)
    # Before gap repair: a runaway token can span 30 s and hide a hole from it.
    words = hallucination.clean(audio_arr, _filter_words(_extract_words(result)), vocal_stem)
    if vocal_stem:  # fill holes where the stem is sung but the first pass found nothing
        def decode_clip(clip):
            clip_result = _run_backends(clip, condition_on_previous_text=False, **options)
            return _filter_words(_extract_words(clip_result))
        words = gap_repair.repair(audio_arr, words, decode_clip, on_progress=scaled(progress, 0.85, 1.0))
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
