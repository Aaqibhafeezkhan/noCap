"""Levenshtein alignment of two token sequences (lyrics, transcripts, characters)."""

from __future__ import annotations

from dataclasses import dataclass
from difflib import SequenceMatcher
from math import isclose
from typing import Callable


@dataclass(frozen=True)
class Op:
    kind: str  # "ok", "sub", "del" (missing from hyp) or "ins" (extra in hyp)
    ref: int | None
    hyp: int | None


def align(ref: list[str], hyp: list[str], substitution: Callable[[str, str], float] | None = None) -> list[Op]:
    """Levenshtein alignment of two token lists, returned in order.

    ``substitution`` prices swapping two different tokens (default 1, like an
    insertion or deletion). A cheaper price for similar tokens makes a corrected
    word ("nite" → "night") pair with its old version rather than a neighbour.
    """
    swap = substitution or (lambda _a, _b: 1.0)

    def cost(a: str, b: str) -> float:
        return 0.0 if a == b else swap(a, b)

    n, m = len(ref), len(hyp)
    dist = [[0.0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        dist[i][0] = float(i)
    for j in range(1, m + 1):
        dist[0][j] = float(j)
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            dist[i][j] = min(dist[i - 1][j] + 1, dist[i][j - 1] + 1, dist[i - 1][j - 1] + cost(ref[i - 1], hyp[j - 1]))
    ops: list[Op] = []
    i, j = n, m
    while i > 0 or j > 0:
        if i > 0 and j > 0 and isclose(dist[i][j], dist[i - 1][j - 1] + cost(ref[i - 1], hyp[j - 1])):
            ops.append(Op("ok" if ref[i - 1] == hyp[j - 1] else "sub", i - 1, j - 1))
            i, j = i - 1, j - 1
        elif i > 0 and isclose(dist[i][j], dist[i - 1][j] + 1):
            ops.append(Op("del", i - 1, None))
            i -= 1
        else:
            ops.append(Op("ins", None, j - 1))
            j -= 1
    return ops[::-1]


def similarity_cost(a: str, b: str) -> float:
    """Substitution price from spelling similarity: 0 (same) … 1 (nothing in common)."""
    return 1.0 - SequenceMatcher(None, a, b).ratio()
