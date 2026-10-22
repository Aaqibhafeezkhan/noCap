"""Turns results/scores.json into results/scores.csv and benchmark/REPORT.md.

usage: python -m benchmark.report
"""

from __future__ import annotations

import csv
import json
import math
import statistics
from pathlib import Path

ROOT = Path(__file__).parent
RESULTS = ROOT / "results"
SETS = {"jamendo": "Jam-ALT (CC songs, mixed genres)", "own": "Your rap tracks"}


def pooled_wer(rows: list[dict]) -> float:
    errors = sum(r["sub"] + r["del"] + r["ins"] for r in rows)
    words = sum(r["ref_words"] for r in rows)
    return errors / words if words else math.nan


def mean(values: list[float]) -> float:
    clean = [v for v in values if v is not None and not math.isnan(v)]
    return sum(clean) / len(clean) if clean else math.nan


def onset_mean(rows: list[dict], key: str, field: str) -> float:
    return mean([r[key][field] for r in rows if r.get(key) and r[key]["n"]])


def pct(value: float) -> str:
    return "–" if math.isnan(value) else f"{value:.1%}"


def ms(value: float) -> str:
    return "–" if math.isnan(value) else f"{value:.0f} ms"


def summary_row(label: str, rows: list[dict]) -> str:
    syl_err = mean([abs(r["syllables_hyp"] - r["syllables_ref"]) / r["syllables_ref"] for r in rows if r["syllables_ref"]])
    bpm = [r for r in rows if r["bpm_acc1"] is not None]
    acc = f"{sum(r['bpm_acc1'] for r in bpm)}/{len(bpm)} · {sum(r['bpm_acc2'] for r in bpm)}/{len(bpm)}" if bpm else "–"
    return (f"| {label} | {len(rows)} | {pct(pooled_wer(rows))} | {pct(statistics.median(r['cer'] for r in rows))} "
            f"| {ms(onset_mean(rows, 'word_onset', 'median_ms'))} | {pct(onset_mean(rows, 'word_onset', 'within_300ms'))} "
            f"| {ms(onset_mean(rows, 'line_onset', 'median_ms'))} | {pct(syl_err)} | {acc} |")


def write_csv(rows: list[dict]) -> None:
    flat = []
    for r in rows:
        item = {k: v for k, v in r.items() if k not in ("line_onset", "word_onset")}
        for key in ("line_onset", "word_onset"):
            for field, value in (r.get(key) or {}).items():
                item[f"{key}_{field}"] = value
        flat.append(item)
    fields = sorted({k for item in flat for k in item}, key=lambda k: list(flat[0]).index(k) if k in flat[0] else 99)
    with (RESULTS / "scores.csv").open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(flat)


def main() -> None:
    rows = json.loads((RESULTS / "scores.json").read_text())
    write_csv(rows)
    lines = [
        "# noCap accuracy benchmark", "",
        "| Set | Songs | WER | CER (median) | Word onset (median) | Words within 300 ms | Line onset (median) | Syllable count error | BPM Acc1 · Acc2 |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for key, label in SETS.items():
        subset = [r for r in rows if r["set"] == key]
        if subset:
            lines.append(summary_row(label, subset))
    hiphop = [r for r in rows if r["genre"] == "Hip-Hop"]
    if hiphop:
        lines.append(summary_row("All hip-hop", hiphop))
    if len({r["set"] for r in rows}) > 1:
        lines.append(summary_row("**All**", rows))
    lines += ["", "## Per song (worst WER first)", "",
              "| Song | Set | Genre | WER | Sub / Del / Ins | Word onset median | Runaway tokens | Words before vocals |",
              "|---|---|---|---|---|---|---|---|"]
    for r in sorted(rows, key=lambda r: -r["wer"]):
        word = ms(r["word_onset"]["median_ms"]) if r.get("word_onset") else "–"
        lines.append(f"| {r['id']} | {r['set']} | {r['genre']} | {pct(r['wer'])} | {r['sub']} / {r['del']} / {r['ins']} "
                     f"| {word} | {r['runaway_tokens']} | {r['early_words']} |")
    (ROOT / "REPORT.md").write_text("\n".join(lines) + "\n" + (ROOT / "REPORT_NOTES.md").read_text())
    print("\n".join(lines[:9]))


if __name__ == "__main__":
    main()
