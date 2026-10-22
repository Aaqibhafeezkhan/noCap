"""Scoring helpers for the accuracy benchmark: text normalisation, word alignment,
WER/CER, onset errors and tempo accuracy. Pure functions, no audio or I/O."""

from __future__ import annotations

import re
import statistics

from nocap.text.token_align import Op, align  # noqa: F401  (re-exported for the benchmark)

_TAG = re.compile(r"\[[^\]]*\]")  # section tags like [Chorus]
_APOSTROPHES = str.maketrans({"’": "'", "‘": "'", "`": "'"})
_NON_WORD = re.compile(r"[^a-z0-9' ]+")


def normalize(text: str) -> list[str]:
    """Lower-cased word tokens. Section tags are dropped; backing vocals in
    parentheses are kept (they are sung), only the brackets go."""
    text = _TAG.sub(" ", text).translate(_APOSTROPHES).lower()
    text = _NON_WORD.sub(" ", text.replace("-", " "))
    return [w.strip("'") for w in text.split() if w.strip("'")]


def error_counts(ops: list[Op], ref_len: int) -> dict[str, float]:
    counts = {kind: sum(op.kind == kind for op in ops) for kind in ("ok", "sub", "del", "ins")}
    errors = counts["sub"] + counts["del"] + counts["ins"]
    return {**counts, "ref": ref_len, "rate": errors / ref_len if ref_len else 0.0}


def wer(ref: list[str], hyp: list[str]) -> dict[str, float]:
    return error_counts(align(ref, hyp), len(ref))


def cer(ref: list[str], hyp: list[str]) -> float:
    ref_chars, hyp_chars = list(" ".join(ref)), list(" ".join(hyp))
    return error_counts(align(ref_chars, hyp_chars), len(ref_chars))["rate"]


def onset_stats(errors_s: list[float]) -> dict[str, float]:
    """Summary of absolute onset errors given in seconds; values reported in ms / %."""
    if not errors_s:
        return {"n": 0, "mean_ms": float("nan"), "median_ms": float("nan"), "within_100ms": float("nan"), "within_300ms": float("nan")}
    abs_ms = [abs(e) * 1000 for e in errors_s]
    return {
        "n": len(abs_ms),
        "mean_ms": statistics.fmean(abs_ms),
        "median_ms": statistics.median(abs_ms),
        "within_100ms": sum(e <= 100 for e in abs_ms) / len(abs_ms),
        "within_300ms": sum(e <= 300 for e in abs_ms) / len(abs_ms),
    }


def tempo_accuracy(estimate: float, reference: float, tolerance: float = 0.04) -> tuple[bool, bool]:
    """MIREX Acc1 (within tolerance) and Acc2 (also allowing ×2, ×½, ×3, ×⅓)."""
    def close(value: float) -> bool:
        return abs(value - reference) <= tolerance * reference

    acc1 = close(estimate)
    acc2 = acc1 or any(close(estimate * f) for f in (2, 0.5, 3, 1 / 3))
    return acc1, acc2
