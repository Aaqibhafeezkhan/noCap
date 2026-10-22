"""Downloads the English part of Jam-ALT (20 Creative Commons songs from Jamendo) with
reference lyrics, line timings (Jam-ALT) and word timings (JamendoLyrics).

The audio keeps its Jamendo CC licence (several are NonCommercial / NoDerivatives):
it is used here only for local, non-commercial evaluation and is never committed.

usage: python -m benchmark.fetch_jamendo
"""

from __future__ import annotations

import csv
import io
import json
import urllib.request
from pathlib import Path

JAM_ALT = "https://huggingface.co/datasets/jamendolyrics/jam-alt/resolve/main/subsets/en"
JAMENDO_LYRICS = "https://raw.githubusercontent.com/f90/jamendolyrics/master"
OUT = Path(__file__).parent / "data" / "jamendo"
HEADERS = {"User-Agent": "noCap-benchmark (https://github.com/fatihserhatturan/noCap)"}


def get(url: str) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=120) as response:
        return response.read()


def word_timings(name: str) -> list[dict[str, float | str]]:
    """JamendoLyrics word list paired with its word onset annotations."""
    words = get(f"{JAMENDO_LYRICS}/lyrics/{name}.words.txt").decode().split()
    rows = list(csv.DictReader(io.StringIO(get(f"{JAMENDO_LYRICS}/annotations/words/{name}.csv").decode())))
    if len(words) != len(rows):
        print(f"  ! {name}: {len(words)} words vs {len(rows)} timings, word timings skipped")
        return []
    return [{"word": w, "start": float(r["word_start"]), "end": float(r["word_end"])} for w, r in zip(words, rows)]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    entries = [json.loads(line) for line in get(f"{JAM_ALT}/metadata.jsonl").decode().splitlines() if line.strip()]
    for entry in entries:
        name = entry["name"]
        audio = OUT / f"{name}.mp3"
        print(f"{name} ({entry['genre']}, {entry['license_type']})")
        if not audio.exists():
            audio.write_bytes(get(f"{JAM_ALT}/{entry['file_name']}"))
        reference = {
            "id": name,
            "set": "jamendo",
            "artist": entry["artist"],
            "title": entry["title"],
            "genre": entry["genre"],
            "license": entry["license_type"],
            "bpm": None,
            "text": "\n".join(line["text"].strip() for line in entry["lines"]),
            "lines": [{"start": l["start"], "end": l["end"], "text": l["text"].strip()} for l in entry["lines"]],
            "words": word_timings(name),
            "audio": audio.name,
        }
        (OUT / f"{name}.ref.json").write_text(json.dumps(reference, indent=1, ensure_ascii=False))
    print(f"{len(entries)} songs in {OUT}")


if __name__ == "__main__":
    main()
