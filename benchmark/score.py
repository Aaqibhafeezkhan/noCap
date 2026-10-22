"""Scores each analysed song against its reference and writes results/scores.json.

usage: python -m benchmark.score [--results benchmark/results/whisperx-large-v3]
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from benchmark.metrics import align, cer, error_counts, normalize, onset_stats, tempo_accuracy
from nocap.text.syllables import analyze_word

ROOT = Path(__file__).parent
RESULTS = ROOT / "results"
RUNAWAY_CHARS = 20


def hyp_tokens(words: list[dict]) -> tuple[list[str], list[float]]:
    """Recognised words as normalised tokens, each with the start time of its word."""
    tokens, starts = [], []
    for word in words:
        for token in normalize(str(word.get("word", ""))):
            tokens.append(token)
            starts.append(float(word["start"]))
    return tokens, starts


def ref_line_tokens(lines: list[dict]) -> tuple[list[str], list[int]]:
    """Reference tokens and, for each line, the index of its first token (-1 if empty)."""
    tokens, firsts = [], []
    for line in lines:
        words = normalize(str(line["text"]))
        firsts.append(len(tokens) if words else -1)
        tokens.extend(words)
    return tokens, firsts


def matched_onsets(ref: list[str], ref_starts: dict[int, float], hyp: list[str], hyp_starts: list[float]) -> list[float]:
    """hyp − ref onset (s) for reference tokens that were recognised correctly."""
    errors = []
    for op in align(ref, hyp):
        if op.kind == "ok" and op.ref in ref_starts:
            errors.append(hyp_starts[op.hyp] - ref_starts[op.ref])
    return errors


def syllables(tokens: list[str]) -> int:
    return sum(analyze_word(token).syllable_count for token in tokens)


def score(ref: dict, result: dict) -> dict:
    hyp, hyp_starts = hyp_tokens(result.get("words", []))
    ref_tokens, line_firsts = ref_line_tokens(ref["lines"])
    counts = error_counts(align(ref_tokens, hyp), len(ref_tokens))
    line_starts = {first: float(line["start"]) for first, line in zip(line_firsts, ref["lines"]) if first >= 0}
    row = {
        "id": ref["id"], "set": ref["set"], "genre": ref["genre"],
        "ref_words": counts["ref"], "hyp_words": len(hyp),
        "sub": counts["sub"], "del": counts["del"], "ins": counts["ins"], "wer": counts["rate"],
        "cer": cer(ref_tokens, hyp),
        "line_onset": onset_stats(matched_onsets(ref_tokens, line_starts, hyp, hyp_starts)),
        "word_onset": None,
        "syllables_ref": syllables(ref_tokens),
        # Other transcribers' output has no flow map: count their words' syllables instead.
        "syllables_hyp": len(result["syllables"]) if "syllables" in result else syllables(hyp),
        "bpm_ref": ref.get("bpm"), "bpm_est": result.get("metadata", {}).get("bpm"),
        "bpm_acc1": None, "bpm_acc2": None,
        # Whisper hallucinations: runaway tokens (a held note written as "aaaa…") and
        # words placed more than 3 s before the first sung line.
        "runaway_tokens": sum(len(t) > RUNAWAY_CHARS for t in hyp),
        "early_words": sum(t < float(ref["lines"][0]["start"]) - 3 for t in hyp_starts) if ref["lines"] else 0,
    }
    if ref.get("words"):
        word_tokens = [(normalize(w["word"]) or [""])[0] for w in ref["words"]]
        word_starts = {i: float(w["start"]) for i, w in enumerate(ref["words"])}
        row["word_onset"] = onset_stats(matched_onsets(word_tokens, word_starts, hyp, hyp_starts))
    if row["bpm_ref"] and row["bpm_est"]:
        row["bpm_acc1"], row["bpm_acc2"] = tempo_accuracy(float(row["bpm_est"]), float(row["bpm_ref"]))
    return row


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--results", type=Path, default=RESULTS, help="folder with one <id>.json per song")
    results = parser.parse_args().results
    rows = []
    for ref_path in sorted((ROOT / "data").glob("*/*.ref.json")):
        ref = json.loads(ref_path.read_text())
        result_path = results / f"{ref['id']}.json"
        if not result_path.exists():
            continue
        rows.append(score(ref, json.loads(result_path.read_text())))
        r = rows[-1]
        print(f"{r['id'][:40]:40} WER {r['wer']:.1%}  line onset median {r['line_onset']['median_ms']:.0f} ms")
    (results / "scores.json").write_text(json.dumps(rows, indent=1))
    print(f"{len(rows)} songs scored → {results / 'scores.json'}")


if __name__ == "__main__":
    main()
