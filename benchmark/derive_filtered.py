"""Applies the hallucination filters to an existing variant's words, offline.

Whisper decodes at temperature 0, so rerunning a variant with only the filters
switched on would reproduce the same words before filtering; filtering the saved
words gives the same result in seconds.

usage: python -m benchmark.derive_filtered A-baseline B-filters
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import soundfile as sf

from nocap.audio import hallucination
from nocap.audio.transcriber import TranscriptWord

ROOT = Path(__file__).parent


def main() -> None:
    source, target = (ROOT / "results" / f"variant-{name}" for name in sys.argv[1:3])
    target.mkdir(parents=True, exist_ok=True)
    os.environ["NOCAP_HALLUCINATION_FILTER"] = "1"
    for path in sorted(source.glob("*.json")):
        data = json.loads(path.read_text())
        audio, _ = sf.read(ROOT / "data" / "stems" / f"{path.stem}.wav", dtype="float32")
        words = [TranscriptWord(w["word"], w["start"], w["end"]) for w in data["words"]]
        kept = hallucination.clean(audio, words, vocal_stem=True)
        data["words"] = [{"word": w.word, "start": w.start, "end": w.end} for w in kept]
        data["metadata"]["derived_from"] = source.name
        (target / path.name).write_text(json.dumps(data))
        print(f"{path.stem}: {len(words) - len(kept)} words removed")


if __name__ == "__main__":
    main()
