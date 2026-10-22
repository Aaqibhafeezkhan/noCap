"""Transcribes the benchmark's vocal stems with WhisperX, for comparison with noCap.

Runs in its own environment (WhisperX needs Python < 3.14 and torch 2.8), e.g.:

    uv venv --python 3.12 ~/Library/Caches/noCap-bench/whisperx-env
    uv pip install --python ~/Library/Caches/noCap-bench/whisperx-env/bin/python whisperx==3.8.6 soundfile
    ~/Library/Caches/noCap-bench/whisperx-env/bin/python benchmark/whisperx_run.py --model large-v3

Writes results/whisperx-<model>/<id>.json with the same "words" layout as noCap's
flow map, so benchmark.score can read it. Silero VAD is used (no Hugging Face token);
faster-whisper has no Apple GPU backend, so this runs on the CPU.
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import soundfile as sf
import whisperx

ROOT = Path(__file__).parent
STEMS = ROOT / "data" / "stems"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="large-v3")
    parser.add_argument("--compute-type", default="int8")
    args = parser.parse_args()
    out_dir = ROOT / "results" / f"whisperx-{args.model}"
    out_dir.mkdir(parents=True, exist_ok=True)

    model = whisperx.load_model(args.model, "cpu", compute_type=args.compute_type, language="en", vad_method="silero")
    align_model, align_meta = whisperx.load_align_model(language_code="en", device="cpu")
    stems = sorted(STEMS.glob("*.wav"))
    for index, stem in enumerate(stems, 1):
        out = out_dir / f"{stem.stem}.json"
        if out.exists():
            continue
        started = time.monotonic()
        # The stems are already 16 kHz mono WAV: read them directly (whisperx.load_audio needs ffmpeg).
        audio, _ = sf.read(stem, dtype="float32")
        result = model.transcribe(audio, batch_size=8)
        aligned = whisperx.align(result["segments"], align_model, align_meta, audio, "cpu", return_char_alignments=False)
        words = []
        for segment in aligned["segments"]:
            for w in segment.get("words", []):
                # Words wav2vec2 could not align have no times: borrow the segment's.
                words.append({"word": w["word"], "start": w.get("start", segment["start"]), "end": w.get("end", segment["end"])})
        out.write_text(json.dumps({"metadata": {"transcriber": f"whisperx-{args.model}"}, "words": words}))
        print(f"[{index}/{len(stems)}] {stem.stem}: {len(words)} words ({time.monotonic() - started:.0f} s)", flush=True)


if __name__ == "__main__":
    main()
