"""Removes words Whisper invents rather than hears.

Two failure modes showed up in the accuracy benchmark (benchmark/REPORT.md):

* a held vowel written out as one runaway token ("aaaaaaaa…", hundreds of letters);
* words placed over stretches where the vocal stem is silent, typically an
  instrumental intro, where Whisper fills the silence with plausible text.
"""
from __future__ import annotations

import os
import re

import numpy as np

SAMPLE_RATE = 16000
MAX_WORD_LETTERS = 20      # longer "words" are runaway tokens
REPEATED_LETTER = re.compile(r"(.)\1{5,}")  # the same letter six or more times in a row
HOP = 0.05                 # seconds per energy frame
SILENT_RATIO = 0.08        # frame RMS below this share of the stem's RMS counts as silence
PAD = 0.15                 # seconds of context around a word when checking for voice


def enabled() -> bool:
    """On by default; NOCAP_HALLUCINATION_FILTER=0 turns it off (used by the benchmark)."""
    return os.environ.get("NOCAP_HALLUCINATION_FILTER", "1") != "0"


def is_runaway(text: str) -> bool:
    """A held note written out as one huge token, or a symbol with no letters (e.g. "🎵")."""
    letters = re.sub(r"[^a-z0-9]", "", text.lower())
    return not letters or len(letters) > MAX_WORD_LETTERS or bool(REPEATED_LETTER.search(letters))


def voiced_frames(audio: np.ndarray) -> np.ndarray:
    """Boolean per HOP-second frame: is there vocal energy above the silence floor?"""
    frame = int(SAMPLE_RATE * HOP)
    n = len(audio) // frame
    if n == 0:
        return np.zeros(0, dtype=bool)
    rms = np.sqrt(np.mean(np.square(audio[: n * frame].reshape(n, frame)), axis=1))
    overall = float(np.sqrt(np.mean(np.square(audio)))) or 1.0
    return rms > SILENT_RATIO * overall


def is_over_silence(word, voiced: np.ndarray) -> bool:
    first = max(0, int((word.start - PAD) / HOP))
    last = min(len(voiced), int((max(word.end, word.start) + PAD) / HOP) + 1)
    return first < last and not voiced[first:last].any()


def clean(audio: np.ndarray, words: list, vocal_stem: bool) -> list:
    """Drop runaway tokens always, and words over silence when ``audio`` is a vocal stem
    (on a full mix the instruments keep the energy up, so silence says nothing)."""
    if not enabled():
        return words
    kept = [w for w in words if not is_runaway(w.word)]
    if vocal_stem:
        voiced = voiced_frames(audio)
        kept = [w for w in kept if not is_over_silence(w, voiced)]
    return kept
