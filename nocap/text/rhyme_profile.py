from __future__ import annotations

from .rhyme_models import RhymeProfile
from .rhyme_stopwords import is_weak_function_word
from .syllables import WordAnalysis

EMPTY_PROFILE = RhymeProfile("", "", (), 0, False, 0)


def profile_for_word(wa: WordAnalysis) -> RhymeProfile:
    if is_weak_function_word(wa.clean):
        return EMPTY_PROFILE
    if wa.phones:
        ending = _stressed_ending(wa.phones)
        if not ending:
            return EMPTY_PROFILE
        return RhymeProfile(
            key=" ".join(ending),
            vowel=ending[0],
            tail=tuple(phone for phone in ending[1:] if not is_vowel_phone(phone)),
            syllable_count=wa.syllable_count,
            has_phones=True,
            vowel_count=sum(1 for phone in ending if is_vowel_phone(phone)),
        )
    vowel = fallback_vowel(wa.clean)
    if not vowel:
        return EMPTY_PROFILE
    fallback = wa.clean[-3:] if len(wa.clean) >= 3 else wa.clean
    return RhymeProfile(fallback, vowel, tuple(fallback[-1:]), wa.syllable_count, False)


def rhyme_ending(wa: WordAnalysis) -> str:
    if wa.phones:
        return " ".join(_stressed_ending(wa.phones))
    return wa.clean[-2:] if len(wa.clean) >= 2 else wa.clean


def is_vowel_phone(phone: str) -> bool:
    vowels = ("AA", "AE", "AH", "AO", "AW", "AY", "EH", "ER", "EY", "IH", "IY", "OW", "OY", "UH", "UW")
    return any(ch in phone for ch in vowels)


def fallback_vowel(clean: str) -> str:
    for ch in reversed(clean):
        if ch in "aeiouy":
            return ch
    return ""


def _stressed_ending(phones: list[str]) -> list[str]:
    """Phones from the last stressed vowel onward; empty when nothing is stressed."""
    for idx in range(len(phones) - 1, -1, -1):
        if phones[idx][-1].isdigit() and int(phones[idx][-1]) in (1, 2):
            return _trim_plural([phone.rstrip("012") for phone in phones[idx:]])
    return []


def _trim_plural(ending: list[str]) -> list[str]:
    while len(ending) > 2 and ending[-1] in {"S", "Z"}:
        ending.pop()
    return ending
