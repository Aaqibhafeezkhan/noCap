"""Whisper decoding options for a separated vocal stem.

Whisper retries a window at a higher temperature when its text is too repetitive
(a decoder loop), *unless* the window looks like silence (``no_speech_prob`` above
0.6). On a vocal stem a loud beat bleeding through often pushes ``no_speech_prob``
past 0.6 during dense rap, so a looping window is accepted as "silence" and a
whole verse disappears (e.g. 22 s of "Not Like Us": 3 words instead of 91; with
retries allowed, 84 words, 65 of them correct). Silence on a stem is already
handled by our own energy check (``hallucination``), so for stems we drop the
silence override and allow the usual temperature fallback.
"""
from __future__ import annotations

FALLBACK_TEMPERATURES = (0.0, 0.2, 0.4, 0.6, 0.8, 1.0)
# Whisper treats text more compressible than 2.4 as a decoder loop and retries it. A rap
# chorus repeats itself on purpose (~2.5–3); real loops sit far higher (8.4 on one song),
# so stems use a higher bar and real choruses are not retried away.
LOOP_COMPRESSION = 4.0
SEED = 0  # sampling at temperature > 0 is seeded so the same song gives the same words
# A window that only decodes at the last temperature failed every check: at 1.0 Whisper
# samples almost freely and writes fluent but wrong lyrics, so that output is dropped.
GAVE_UP = FALLBACK_TEMPERATURES[-1]


def gave_up(segment: dict) -> bool:
    return float(segment.get("temperature", 0.0)) >= GAVE_UP


def options(base: dict, vocal_stem: bool) -> dict:
    """Decode options for ``_run_backends``; unchanged for a full mix."""
    if not vocal_stem:
        return base
    return {**base, "temperature": FALLBACK_TEMPERATURES, "no_speech_threshold": None,
            "compression_ratio_threshold": LOOP_COMPRESSION}


def first_temperature(temperature) -> float:
    """Backends without fallback (whisper.cpp) take the first temperature only."""
    return float(temperature if isinstance(temperature, (int, float)) else temperature[0])
