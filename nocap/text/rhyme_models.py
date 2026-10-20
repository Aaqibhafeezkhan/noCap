from __future__ import annotations

from dataclasses import dataclass


@dataclass
class RhymeGroup:
    label: str
    ending: str
    word_indices: list[int]


@dataclass(frozen=True)
class RhymeProfile:
    key: str
    vowel: str
    tail: tuple[str, ...]
    syllable_count: int
    has_phones: bool
    vowel_count: int = 1


@dataclass(frozen=True)
class RhymeMatch:
    kind: str
    strength: float
    key: str
