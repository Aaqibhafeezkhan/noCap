"""Runs the noCap analysis on every benchmark song, one at a time, with the same
settings the desktop app uses (vocal separation on, language auto-detected).

Songs that already have a result are skipped, so an interrupted run can be resumed.

usage: python -m benchmark.run [--only NAME_SUBSTRING]
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).parent
DATA = ROOT / "data"
RESULTS = ROOT / "results"


def references() -> list[Path]:
    return sorted(DATA.glob("*/*.ref.json"))


def analyze(ref_path: Path) -> tuple[bool, float, str]:
    ref = json.loads(ref_path.read_text())
    audio = ref_path.parent / ref["audio"]
    out = RESULTS / f"{ref['id']}.json"
    command = [sys.executable, "-m", "nocap.cli", "analyze", str(audio), "--no-serve", "--separate",
               "--title", ref["id"], "-o", str(out)]
    started = time.monotonic()
    proc = subprocess.run(command, capture_output=True, text=True, cwd=ROOT.parent)
    elapsed = time.monotonic() - started
    ok = proc.returncode == 0 and out.exists()
    tail = "" if ok else (proc.stderr or proc.stdout).strip().splitlines()[-1:]
    return ok, elapsed, " ".join(tail)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", default=None, help="analyse only songs whose id contains this text")
    args = parser.parse_args()
    RESULTS.mkdir(exist_ok=True)
    log_path = RESULTS / "run_log.json"
    log = json.loads(log_path.read_text()) if log_path.exists() else {}
    todo = [p for p in references() if not args.only or args.only in p.name]
    for index, ref_path in enumerate(todo, 1):
        song = ref_path.name.removesuffix(".ref.json")
        if (RESULTS / f"{song}.json").exists():
            print(f"[{index}/{len(todo)}] {song}: already done")
            continue
        ok, elapsed, error = analyze(ref_path)
        log[song] = {"ok": ok, "seconds": round(elapsed, 1), "error": error}
        log_path.write_text(json.dumps(log, indent=1))
        print(f"[{index}/{len(todo)}] {song}: {'ok' if ok else 'FAILED ' + error} ({elapsed:.0f} s)", flush=True)


if __name__ == "__main__":
    main()
