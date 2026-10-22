"""Applies edited lyric lines (one line per bar) to an analysed track's words.

Edits keep the timing Whisper found wherever they can: a word that stays the same
or replaces another word (a misheard word corrected) takes that word's start and
end; added words are spread over the free time around them in the bar, weighted
by syllable count. Bars that were not edited keep their words untouched.
"""
from __future__ import annotations

import re
from typing import Any

from nocap.audio.transcriber import TranscriptWord
from nocap.text.syllables import analyze_word
from nocap.text.token_align import align, similarity_cost

MIN_WORD = 0.08  # seconds each added word gets at least, if its bar has no free time


def bar_spans(flowmap: dict[str, Any]) -> dict[int, tuple[float, float]]:
    """(start, end) seconds of every bar, from its first beat to the next bar's."""
    starts: dict[int, float] = {}
    for beat in flowmap.get("beats", []):
        starts.setdefault(int(beat["bar_no"]), float(beat["time"]))
    ordered = sorted(starts.items())
    duration = float(flowmap.get("metadata", {}).get("duration") or 0.0)
    return {
        bar: (start, ordered[i + 1][1] if i + 1 < len(ordered) else max(duration, start))
        for i, (bar, start) in enumerate(ordered)
    }


def words_by_bar(flowmap: dict[str, Any]) -> dict[int, list[dict[str, Any]]]:
    """Each word sits in the bar of its first syllable (as the Lyrics screen shows it)."""
    first_bar: dict[int, tuple[float, int]] = {}
    for syllable in flowmap.get("syllables", []):
        current = first_bar.get(syllable["word_id"])
        if current is None or syllable["time"] < current[0]:
            first_bar[syllable["word_id"]] = (syllable["time"], int(syllable["bar_no"]))
    spans = bar_spans(flowmap)
    grouped: dict[int, list[dict[str, Any]]] = {}
    for word in flowmap.get("words", []):
        bar = first_bar[word["id"]][1] if word["id"] in first_bar else _bar_at(spans, float(word["start"]))
        grouped.setdefault(bar, []).append(word)
    for words in grouped.values():
        words.sort(key=lambda w: w["start"])
    return grouped


def apply_edits(flowmap: dict[str, Any], edits: dict[int, str]) -> list[TranscriptWord]:
    """All words of the track after replacing the text of the edited bars."""
    spans = bar_spans(flowmap)
    unknown = [bar for bar in edits if bar not in spans]
    if unknown:
        raise ValueError(f"unknown bars: {unknown}")
    grouped = words_by_bar(flowmap)
    words: list[TranscriptWord] = []
    for bar, bar_words in grouped.items():
        if bar not in edits:
            words.extend(_word(w["word"], w["start"], w["end"], w.get("probability", 1.0)) for w in bar_words)
    for bar, text in edits.items():
        words.extend(retime(grouped.get(bar, []), text.split(), spans[bar]))
    return sorted(words, key=lambda w: w.start)


def retime(old: list[dict[str, Any]], tokens: list[str], span: tuple[float, float]) -> list[TranscriptWord]:
    """New words for one bar: matched words keep their old times, the rest fill the gaps."""
    placed: list[TranscriptWord | None] = [None] * len(tokens)
    for op in align([_key(w["word"]) for w in old], [_key(t) for t in tokens], similarity_cost):
        if op.ref is not None and op.hyp is not None:  # same word, or a corrected one
            source = old[op.ref]
            placed[op.hyp] = _word(tokens[op.hyp], source["start"], source["end"], 1.0)
    i = 0
    while i < len(tokens):
        if placed[i] is not None:
            i += 1
            continue
        j = i
        while j < len(tokens) and placed[j] is None:
            j += 1
        left = placed[i - 1].end if i > 0 else span[0]
        right = placed[j].start if j < len(tokens) else span[1]
        need = MIN_WORD * (j - i)
        if right - left < need and i > 0:
            # No free time after the previous word (often a held word running past the
            # bar line): shorten it so the new words still fall inside this bar.
            prev = placed[i - 1]
            left = max(prev.start + MIN_WORD, min(left, right - need))
            placed[i - 1] = _word(prev.word, prev.start, min(prev.end, left), prev.probability)
        for k, word in enumerate(_spread(tokens[i:j], left, right)):
            placed[i + k] = word
        i = j
    return [w for w in placed if w is not None]


def _spread(tokens: list[str], left: float, right: float) -> list[TranscriptWord]:
    weights = [max(1, analyze_word(_key(t) or t).syllable_count) for t in tokens]
    length = max(right - left, MIN_WORD * len(tokens))
    step = length / sum(weights)
    out, at = [], left
    for token, weight in zip(tokens, weights):
        out.append(_word(token, at, at + weight * step, 1.0))
        at += weight * step
    return out


def _word(text: str, start: float, end: float, probability: float) -> TranscriptWord:
    return TranscriptWord(word=text, start=round(float(start), 4), end=round(float(end), 4), probability=float(probability))


def _key(text: str) -> str:
    return re.sub(r"[^a-z0-9']", "", text.lower().replace("’", "'"))


def _bar_at(spans: dict[int, tuple[float, float]], time: float) -> int:
    for bar, (start, end) in spans.items():
        if start <= time < end:
            return bar
    return max(spans) if spans and time >= max(end for _, end in spans.values()) else min(spans, default=1)
