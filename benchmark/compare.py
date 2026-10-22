"""Side-by-side summary of two scored runs (each folder needs a scores.json).

usage: python -m benchmark.compare benchmark/results benchmark/results/whisperx-large-v3
"""

from __future__ import annotations

import json
import statistics
import sys
from pathlib import Path

from benchmark.report import ms, onset_mean, pct, pooled_wer

METRICS = [
    ("WER (pooled)", lambda rows: pct(pooled_wer(rows))),
    ("WER, hip-hop only", lambda rows: pct(pooled_wer([r for r in rows if r["genre"] == "Hip-Hop"]))),
    ("CER (median)", lambda rows: pct(statistics.median(r["cer"] for r in rows))),
    ("Missing words (deletions)", lambda rows: str(sum(r["del"] for r in rows))),
    ("Wrong words (substitutions)", lambda rows: str(sum(r["sub"] for r in rows))),
    ("Extra words (insertions)", lambda rows: str(sum(r["ins"] for r in rows))),
    ("Word onset error (median)", lambda rows: ms(onset_mean(rows, "word_onset", "median_ms"))),
    ("Words within 100 ms", lambda rows: pct(onset_mean(rows, "word_onset", "within_100ms"))),
    ("Words within 300 ms", lambda rows: pct(onset_mean(rows, "word_onset", "within_300ms"))),
    ("Runaway tokens", lambda rows: str(sum(r["runaway_tokens"] for r in rows))),
    ("Words before vocals", lambda rows: str(sum(r["early_words"] for r in rows))),
]


def main() -> None:
    runs = [Path(arg) for arg in sys.argv[1:]]
    scored = [{r["id"]: r for r in json.loads((run / "scores.json").read_text())} for run in runs]
    common = sorted(set.intersection(*(set(s) for s in scored)))
    tables = [[s[song] for song in common] for s in scored]
    names = [run.name if run.name != "results" else "noCap (current)" for run in runs]
    print(f"{len(common)} songs scored in every run\n")
    print("| Metric | " + " | ".join(names) + " |")
    print("|---|" + "---|" * len(names))
    for label, fn in METRICS:
        print(f"| {label} | " + " | ".join(fn(rows) for rows in tables) + " |")
    print("\n| Song | " + " | ".join(f"WER {n}" for n in names) + " |")
    print("|---|" + "---|" * len(names))
    for index, song in enumerate(common):
        print(f"| {song} | " + " | ".join(pct(rows[index]["wer"]) for rows in tables) + " |")


if __name__ == "__main__":
    main()
