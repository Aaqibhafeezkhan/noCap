from __future__ import annotations

from .rhyme_models import RhymeMatch, RhymeProfile
from .rhyme_profile import EMPTY_PROFILE, profile_for_word
from .syllables import WordAnalysis


def classify_pair(left: WordAnalysis, right: WordAnalysis) -> RhymeMatch | None:
    return match_profiles(profile_for_word(left), profile_for_word(right))


def classify_group(words: list[WordAnalysis]) -> RhymeMatch:
    if len(words) < 2:
        profile = profile_for_word(words[0]) if words else EMPTY_PROFILE
        return RhymeMatch("perfect", 1.0, profile.key)
    matches = _pair_matches(words)
    if not matches:
        return RhymeMatch("fallback", 0.35, profile_for_word(words[0]).key)
    multi = [m for m in matches if m.kind == "multi_syllable"]
    if multi:
        strongest = max(multi, key=lambda match: match.strength)
        return RhymeMatch("multi_syllable", max(0.78, strongest.strength - 0.04), strongest.key)
    priority = {"perfect": 4, "slant": 3, "assonance": 2, "fallback": 1}
    return max(matches, key=lambda match: (priority.get(match.kind, 0), match.strength))


def match_profiles(left: RhymeProfile, right: RhymeProfile) -> RhymeMatch | None:
    """Rhymes must share the stressed vowel; consonants alone never make a rhyme."""
    if not left.key or not right.key:
        return None
    if left.key == right.key:
        return RhymeMatch("perfect", 1.0, left.key)
    if not (left.has_phones and right.has_phones) or left.vowel != right.vowel:
        return None
    if _tail_score(left, right) < 0.5:
        return RhymeMatch("assonance", 0.62, left.vowel)
    return RhymeMatch("slant", 0.82, left.key)


def _pair_matches(words: list[WordAnalysis]) -> list[RhymeMatch]:
    matches: list[RhymeMatch] = []
    for idx, left in enumerate(words):
        for right in words[idx + 1:]:
            match = _with_multi_syllable(profile_for_word(left), profile_for_word(right))
            if match:
                matches.append(match)
    return matches


def _with_multi_syllable(left: RhymeProfile, right: RhymeProfile) -> RhymeMatch | None:
    """Promote a perfect/slant pair whose rhyme spans 2+ vowels on both sides."""
    match = match_profiles(left, right)
    if match and match.kind in {"perfect", "slant"} and min(left.vowel_count, right.vowel_count) > 1:
        return RhymeMatch("multi_syllable", match.strength, match.key)
    return match


def _tail_score(left: RhymeProfile, right: RhymeProfile) -> float:
    tail_overlap = len(set(left.tail) & set(right.tail))
    tail_max = max(len(set(left.tail)), len(set(right.tail)), 1)
    return tail_overlap / tail_max
