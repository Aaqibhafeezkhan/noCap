"""Builds reference files for your own rap tracks from LRCLIB's line-synced lyrics.

Put the audio files in benchmark/data/own/ with a manifest.csv next to them:

    file,artist,title,bpm
    track01.mp3,Artist Name,Song Title,90

bpm is optional (leave it empty). Lyrics are only stored locally.

usage: python -m benchmark.fetch_lyrics
"""

from __future__ import annotations

import csv
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

import librosa

OWN = Path(__file__).parent / "data" / "own"
API = "https://lrclib.net/api/search"
HEADERS = {"User-Agent": "noCap-benchmark (https://github.com/fatihserhatturan/noCap)"}
LRC_LINE = re.compile(r"^\[(\d+):(\d+(?:\.\d+)?)\](.*)$")
MAX_DURATION_GAP = 3.0


def search(artist: str, title: str) -> list[dict]:
    query = urllib.parse.urlencode({"artist_name": artist, "track_name": title})
    with urllib.request.urlopen(urllib.request.Request(f"{API}?{query}", headers=HEADERS), timeout=30) as response:
        return json.load(response)


def best_match(results: list[dict], duration: float) -> dict | None:
    """The synced result closest in length to the file, if close enough."""
    synced = [r for r in results if r.get("syncedLyrics") and r.get("duration")]
    if not synced:
        return None
    match = min(synced, key=lambda r: abs(r["duration"] - duration))
    return match if abs(match["duration"] - duration) <= MAX_DURATION_GAP else None


def parse_lrc(lrc: str) -> list[dict[str, float | str]]:
    lines = []
    for raw in lrc.splitlines():
        found = LRC_LINE.match(raw.strip())
        if found and found.group(3).strip():
            start = int(found.group(1)) * 60 + float(found.group(2))
            lines.append({"start": round(start, 3), "end": None, "text": found.group(3).strip()})
    for line, following in zip(lines, lines[1:]):
        line["end"] = following["start"]
    return lines


def main() -> None:
    manifest = OWN / "manifest.csv"
    if not manifest.exists():
        raise SystemExit(f"Missing {manifest} — see the docstring at the top of this file.")
    missing = []
    for row in csv.DictReader(manifest.open(encoding="utf-8")):
        audio = OWN / row["file"]
        duration = librosa.get_duration(path=str(audio))
        match = best_match(search(row["artist"], row["title"]), duration)
        if match is None:
            missing.append(f"{row['artist']} – {row['title']}")
            continue
        lines = parse_lrc(match["syncedLyrics"])
        reference = {
            "id": audio.stem,
            "set": "own",
            "artist": row["artist"],
            "title": row["title"],
            "genre": "Hip-Hop",
            "license": "local only",
            "bpm": float(row["bpm"]) if row.get("bpm") else None,
            "text": "\n".join(str(line["text"]) for line in lines),
            "lines": lines,
            "words": [],
            "audio": audio.name,
        }
        (OWN / f"{audio.stem}.ref.json").write_text(json.dumps(reference, indent=1, ensure_ascii=False))
        print(f"ok  {row['artist']} – {row['title']} ({len(lines)} lines)")
    for name in missing:
        print(f"--  no synced lyrics within {MAX_DURATION_GAP:.0f} s of the file length: {name}")


if __name__ == "__main__":
    main()
