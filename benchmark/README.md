# Accuracy benchmark

Measures how well noCap transcribes lyrics and times words, against songs whose lyrics
and word timings are known. Audio, lyrics and results stay local (`data/`, `results/`
are git-ignored).

**Results:** [REPORT.md](REPORT.md) (full pipeline, first run) · [PHASE1.md](PHASE1.md)
(transcription experiments and the defaults chosen) · [COMPARE_WHISPERX.md](COMPARE_WHISPERX.md).

| Script | What it does |
|---|---|
| `fetch_jamendo.py` | Downloads the 20 English Jam-ALT songs (Creative Commons) with lyrics and word timings |
| `fetch_lyrics.py` | Builds references for your own tracks in `data/own/` from LRCLIB's synced lyrics |
| `run.py` | Runs the full noCap analysis on every song (desktop-app settings) |
| `export_stems.py` | Saves each song's Demucs vocal stem, for transcription-only runs |
| `transcribe_run.py` | Runs only the transcription step on the stems; settings via `NOCAP_*` variables |
| `derive_filtered.py` | Applies the hallucination filters to a saved run, offline |
| `whisperx_run.py` | Transcribes the stems with WhisperX (separate Python environment) |
| `score.py` · `report.py` · `compare.py` | WER, CER, onset and tempo scores; the report; side-by-side tables |
| `metrics.py` | The scoring functions (tested in `tests/test_benchmark_metrics.py`) |

Quick start, from the repository root:

```bash
python -m benchmark.fetch_jamendo
python -m benchmark.run
python -m benchmark.score && python -m benchmark.report
```
