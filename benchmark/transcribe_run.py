"""Runs only noCap's transcription step on the cached vocal stems, so transcription
settings can be compared quickly (WER and word timing depend only on this step).

Settings come from environment variables read by the pipeline:
  NOCAP_WHISPER_MODEL=large-v3-turbo   NOCAP_HALLUCINATION_FILTER=1   NOCAP_VAD_SEGMENTS=1

usage: NOCAP_HALLUCINATION_FILTER=1 python -m benchmark.transcribe_run --name filters
(run `python -m benchmark.export_stems` first)
"""

from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path

import soundfile as sf

from nocap.audio.loader import AudioData
from nocap.audio.transcriber import transcribe

ROOT = Path(__file__).parent
STEMS = ROOT / "data" / "stems"
SETTINGS = ("NOCAP_WHISPER_MODEL", "NOCAP_HALLUCINATION_FILTER", "NOCAP_VAD_SEGMENTS")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--name", required=True, help="results go to benchmark/results/variant-<name>/")
    args = parser.parse_args()
    out_dir = ROOT / "results" / f"variant-{args.name}"
    out_dir.mkdir(parents=True, exist_ok=True)
    settings = {key: os.environ.get(key, "") for key in SETTINGS}
    stems = sorted(STEMS.glob("*.wav"))
    total = 0.0
    for index, stem in enumerate(stems, 1):
        out = out_dir / f"{stem.stem}.json"
        if out.exists():
            continue
        y, sr = sf.read(stem, dtype="float32")
        started = time.monotonic()
        result = transcribe(AudioData(y=y, sr=sr, duration=len(y) / sr, path=stem), vocal_stem=True)
        seconds = time.monotonic() - started
        total += seconds
        words = [{"word": w.word, "start": w.start, "end": w.end} for w in result.words]
        out.write_text(json.dumps({"metadata": {"variant": args.name, "settings": settings, "seconds": round(seconds, 1)}, "words": words}))
        print(f"[{index}/{len(stems)}] {stem.stem}: {len(words)} words ({seconds:.0f} s)", flush=True)
    print(f"{args.name}: {total:.0f} s transcription time")


if __name__ == "__main__":
    main()
