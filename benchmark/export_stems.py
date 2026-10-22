"""Writes the Demucs vocal stem of every benchmark song as a 16 kHz WAV, exactly as
noCap's pipeline feeds it to Whisper, so other transcribers can be compared on the
same input.

usage: python -m benchmark.export_stems
"""

from __future__ import annotations

import json
from pathlib import Path

import soundfile as sf

from nocap.audio.loader import load, resample_to_16k
from nocap.audio.separator import separate

ROOT = Path(__file__).parent
STEMS = ROOT / "data" / "stems"


def main() -> None:
    STEMS.mkdir(parents=True, exist_ok=True)
    for ref_path in sorted((ROOT / "data").glob("*/*.ref.json")):
        ref = json.loads(ref_path.read_text())
        out = STEMS / f"{ref['id']}.wav"
        if out.exists():
            continue
        vocals = separate(load(ref_path.parent / ref["audio"]))
        sf.write(out, resample_to_16k(vocals), 16000)
        print(f"stem: {ref['id']}", flush=True)


if __name__ == "__main__":
    main()
