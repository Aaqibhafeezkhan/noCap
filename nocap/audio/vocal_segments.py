"""Transcribes a vocal stem segment by segment, cut where the singer pauses.

Whisper's own long-form mode slides a 30 s window over the song and feeds each
window the previous text. On music that lets one bad window derail the next and
cuts phrases in half. A separated vocal stem shows exactly where the voice
stops, so we cut there instead and decode each phrase group on its own
(Syed et al., "Exploiting Music Source Separation for Automatic Lyrics
Transcription with Whisper", 2025: fewer hallucinations, lower WER).
"""
from __future__ import annotations

import os
import zlib
from typing import Callable

import numpy as np

SAMPLE_RATE = 16000
HOP = 0.1             # seconds per energy frame
QUIET_RATIO = 0.1     # frame RMS below this share of the stem's RMS is a pause
MIN_PAUSE = 0.6       # a pause at least this long ends a segment
MAX_SEGMENT = 28.0    # stay inside Whisper's 30 s window
MIN_SEGMENT = 2.0     # shorter segments are merged into the next one
PAD = 0.2             # seconds of context kept around each segment
LOOP_COMPRESSION = 2.4  # Whisper's own threshold: text this compressible is a repetition loop
LOOP_WORDS_PER_SEC = 7.0  # faster than any rapper: the decoder is looping

Decode = Callable[[np.ndarray], dict]


def enabled() -> bool:
    """Off by default: it lowers WER on sung music but made both rap songs in the
    benchmark worse (rap has no pauses, so cuts fall mid-flow). NOCAP_VAD_SEGMENTS=1 turns it on."""
    return os.environ.get("NOCAP_VAD_SEGMENTS", "0") == "1"


def _quiet_frames(audio: np.ndarray) -> np.ndarray:
    frame = int(SAMPLE_RATE * HOP)
    n = len(audio) // frame
    rms = np.sqrt(np.mean(np.square(audio[: n * frame].reshape(n, frame)), axis=1)) if n else np.zeros(0)
    overall = float(np.sqrt(np.mean(np.square(audio)))) or 1.0
    return rms < QUIET_RATIO * overall


def segments(audio: np.ndarray) -> list[tuple[float, float]]:
    """(start, end) seconds of voiced stretches, split at pauses and kept under MAX_SEGMENT."""
    quiet = _quiet_frames(audio)
    spans: list[list[float]] = []
    start, silent_run = None, 0
    for i, is_quiet in enumerate(quiet):
        if not is_quiet:
            if start is None:
                start = i
            silent_run = 0
            if (i - start) * HOP >= MAX_SEGMENT:  # too long without a real pause:
                breaths = np.flatnonzero(quiet[start:i])  # cut at the last short breath
                cut = start + int(breaths[-1]) if breaths.size and breaths[-1] > 0 else i
                spans.append([start * HOP, cut * HOP])
                start = cut
            continue
        silent_run += 1
        if start is not None and silent_run * HOP >= MIN_PAUSE:
            spans.append([start * HOP, (i - silent_run + 1) * HOP])
            start = None
    if start is not None:  # voice runs to the end of the song
        spans.append([start * HOP, len(quiet) * HOP])
    merged: list[list[float]] = []
    for span in spans:
        if merged and (merged[-1][1] - merged[-1][0] < MIN_SEGMENT) and span[1] - merged[-1][0] <= MAX_SEGMENT:
            merged[-1][1] = span[1]
        else:
            merged.append(span)
    if len(merged) > 1 and merged[-1][1] - merged[-1][0] < MIN_SEGMENT and merged[-1][1] - merged[-2][0] <= MAX_SEGMENT:
        last = merged.pop()  # a short last phrase joins the one before it
        merged[-1][1] = last[1]
    duration = len(audio) / SAMPLE_RATE
    return [(max(0.0, a - PAD), min(duration, b + PAD)) for a, b in merged if b > a]


def _shift(result: dict, offset: float) -> list[dict]:
    shifted = []
    for seg in result.get("segments", []):
        seg = {**seg, "start": float(seg.get("start", 0.0)) + offset, "end": float(seg.get("end", 0.0)) + offset}
        seg["words"] = [{**w, "start": float(w["start"]) + offset, "end": float(w["end"]) + offset} for w in seg.get("words", [])]
        shifted.append(seg)
    return shifted


def is_loop(result: dict, seconds: float) -> bool:
    """True when the decoder got stuck repeating itself (e.g. one line 40 times)."""
    text = str(result.get("text", "")).strip()
    if not text:
        return False
    words = sum(len(seg.get("words", [])) for seg in result.get("segments", []))
    ratio = len(text.encode()) / len(zlib.compress(text.encode()))
    return ratio > LOOP_COMPRESSION or words > LOOP_WORDS_PER_SEC * max(seconds, 1.0)


def _decode_span(audio: np.ndarray, start: float, end: float, decode: Decode, retry: bool = True) -> list[tuple[float, dict]]:
    """Decode one span; a looping span is split in half and decoded again, then dropped."""
    result = decode(audio[int(start * SAMPLE_RATE): int(end * SAMPLE_RATE)])
    if not is_loop(result, end - start):
        return [(start, result)]
    if not retry or end - start < 2 * MIN_SEGMENT:
        return []
    middle = (start + end) / 2
    return _decode_span(audio, start, middle, decode, False) + _decode_span(audio, middle, end, decode, False)


def transcribe(audio: np.ndarray, decode: Decode) -> dict:
    """Decode each voiced segment separately and merge into one Whisper-style result."""
    merged: dict = {"text": "", "language": None, "segments": []}
    texts = []
    for start, end in segments(audio):
        for offset, result in _decode_span(audio, start, end, decode):
            merged["language"] = merged["language"] or result.get("language")
            merged["segments"].extend(_shift(result, offset))
            texts.append(str(result.get("text", "")).strip())
    merged["text"] = " ".join(t for t in texts if t)
    merged["language"] = merged["language"] or "en"
    return merged
