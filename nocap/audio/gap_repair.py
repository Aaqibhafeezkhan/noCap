"""Second pass for words Whisper skipped on a vocal stem.

Whisper feeds each 30 s window the previous window's text as a prompt. On
repetitive rap vocals that prompt can lock the decoder into a loop ("you, you,
you ×100" on one timestamp) or make it skip a window, and which windows fail
changes with tiny differences in the stem. After the first pass we look for
stretches where the stem is clearly sung but no words came out, decode just
those stretches again without the carried-over prompt, and merge the words in.
"""
from __future__ import annotations

import re
from typing import Callable

import numpy as np

SAMPLE_RATE = 16000
HOP = 0.25            # seconds per activity frame
ACTIVE_RATIO = 0.25   # frame RMS vs. the stem's overall RMS
MIN_GAP = 3.0         # only repair holes at least this long
JOIN_GAP = 1.0        # holes closer than this are repaired as one
CLIP_PAD = 1.0        # context decoded around a hole
MAX_WORDS_PER_SEC = 8.0
STACKED_REPEAT = 0.1  # the same word again within this many seconds is a loop

Decode = Callable[[np.ndarray], list]


def collapse_repeats(words: list) -> list:
    """Drop decoder loops: the same word stacked on (almost) the same timestamp."""
    kept: list = []
    for word in words:
        if kept and _norm(word.word) == _norm(kept[-1].word) and word.start - kept[-1].start < STACKED_REPEAT:
            continue
        kept.append(word)
    return kept


def find_gaps(audio: np.ndarray, words: list) -> list[tuple[float, float]]:
    """Return (start, end) seconds where the stem is active but no word covers it."""
    frame = int(SAMPLE_RATE * HOP)
    n = len(audio) // frame
    if n == 0:
        return []
    rms = np.sqrt(np.mean(np.square(audio[: n * frame].reshape(n, frame)), axis=1))
    active = rms > ACTIVE_RATIO * float(np.sqrt(np.mean(np.square(audio))))
    covered = np.zeros(n, dtype=bool)
    for word in words:
        covered[int(word.start / HOP): int(max(word.end, word.start + HOP) / HOP) + 1] = True

    gaps: list[list[float]] = []
    start = None
    for i, missing in enumerate(np.append(active & ~covered, False)):
        if missing and start is None:
            start = i
        elif not missing and start is not None:
            if gaps and start * HOP - gaps[-1][1] < JOIN_GAP:
                gaps[-1][1] = i * HOP
            else:
                gaps.append([start * HOP, i * HOP])
            start = None
    return [(a, b) for a, b in gaps if b - a >= MIN_GAP]


def repair(audio: np.ndarray, words: list, decode: Decode) -> list:
    """Fill vocal-active holes in ``words`` by decoding each hole on its own.

    ``decode`` transcribes a 16 kHz clip without previous-text conditioning and
    returns words with clip-relative times.
    """
    words = collapse_repeats(words)
    added: list = []
    duration = len(audio) / SAMPLE_RATE
    for gap_start, gap_end in find_gaps(audio, words):
        clip_start = max(0.0, gap_start - CLIP_PAD)
        clip_end = min(duration, gap_end + CLIP_PAD)
        clip = audio[int(clip_start * SAMPLE_RATE): int(clip_end * SAMPLE_RATE)]
        found = [_shifted(w, clip_start) for w in collapse_repeats(decode(clip))]
        found = [w for w in found if gap_start - 0.3 <= w.start < gap_end]
        if len(found) <= MAX_WORDS_PER_SEC * (gap_end - gap_start):  # else: hallucination
            added.extend(found)
    if not added:
        return words
    return collapse_repeats(sorted(words + added, key=lambda w: w.start))


def _shifted(word, offset: float):
    word.start += offset
    word.end += offset
    return word


def _norm(text: str) -> str:
    return re.sub(r"[^a-z0-9']", "", text.lower())
