# Phase 1: transcription experiments (20 Jam-ALT songs, 2026-10-22)

Each variant runs only the transcription step on the same cached Demucs vocal stems
(`benchmark/transcribe_run.py`), so differences come from the setting alone. Variants build on each other:

| Variant | Setting |
|---|---|
| A-baseline | Whisper medium.en on MLX, DTW word timings, gap repair (noCap 0.2.0) |
| B-filters | A + hallucination filters (runaway tokens, symbols, words over a silent stem) |
| C-turbo | B + `large-v3-turbo` instead of `medium.en` |
| D-segments | C + decoding the stem segment by segment, cut at vocal pauses |
| E-medium-segments | B + segments (back on medium.en) |
| F-loop-guard | E + loop guard (a segment that repeats itself is split and re-decoded, then dropped) |

| Metric | A-baseline | B-filters | C-turbo | D-segments | E-medium-segments | F-loop-guard |
|---|---|---|---|---|---|---|
| WER (pooled) | 33.9% | 33.6% | 32.8% | 26.7% | 30.3% | 27.5% |
| WER, hip-hop only | 21.5% | 21.5% | 24.2% | 26.2% | 25.9% | 25.2% |
| CER (median) | 23.3% | 20.7% | 21.1% | 16.6% | 18.6% | 16.6% |
| Missing words (deletions) | 1065 | 1122 | 861 | 615 | 618 | 708 |
| Wrong words (substitutions) | 834 | 787 | 956 | 911 | 1000 | 876 |
| Extra words (insertions) | 216 | 187 | 230 | 139 | 272 | 132 |
| Word onset error (median) | 77 ms | 76 ms | 116 ms | 100 ms | 167 ms | 79 ms |
| Words within 100 ms | 60.7% | 61.0% | 49.1% | 52.2% | 59.9% | 60.7% |
| Words within 300 ms | 84.0% | 84.4% | 77.3% | 84.1% | 85.8% | 88.4% |
| Runaway tokens | 7 | 0 | 0 | 0 | 0 | 0 |
| Words before vocals | 3 | 0 | 2 | 0 | 5 | 1 |
| Transcription time, 20 songs | 24 min | 24 min | 25 min | 26 min | 25 min | 33 min |

Hip-hop rows per song: JASON MILLER – CROWD PLEASER 11.6 % → 16.4 % (A → F); Wordsmith – The Statement 30.5 % → 33.2 %.

## Decisions

- **Hallucination filters: on by default.** They remove every runaway token and invented intro word and change nothing else.
- **large-v3-turbo: not adopted.** WER improves by under a point, rap gets worse (21.5 % → 24.2 %) and word timing degrades (median 76 → 116 ms): turbo's pruned decoder makes the DTW timing heads less precise.
- **Segmentation + loop guard: off by default (`NOCAP_VAD_SEGMENTS=1` to try it).** It is the biggest win on sung music (WER 33.6 % → 27.5 %, words within 300 ms 84 % → 88 %), but it made both rap songs worse and is ~35 % slower. Rap verses have no pauses, so segments end at the 28 s limit mid-flow and lose context. Without the loop guard (variant E) one song looped into 178 invented words.

## Next

- Segment only at natural pauses and leave long pause-free (rap) stretches to Whisper's native long-form decoding.
- Grow the rap test set (own tracks via `benchmark/fetch_lyrics.py`, or MUSDB-ALT): two hip-hop songs are too few to decide on.

Reproduce: `python -m benchmark.export_stems`, then e.g. `NOCAP_HALLUCINATION_FILTER=0 python -m benchmark.transcribe_run --name A-baseline`, `NOCAP_VAD_SEGMENTS=1 python -m benchmark.transcribe_run --name F-loop-guard`, `python -m benchmark.score --results benchmark/results/variant-F-loop-guard`, `python -m benchmark.compare benchmark/results/variant-A-baseline benchmark/results/variant-F-loop-guard`.
