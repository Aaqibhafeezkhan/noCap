from __future__ import annotations

import json
import sqlite3
import zlib
from typing import Any

BAR_COLUMNS = ("density", "syncopation_score", "pocket_offset", "timing_variance", "stressed_ratio", "syllable_count", "local_bpm", "rms_avg")
SECTION_COLUMNS = ("start_bar", "end_bar", "avg_density", "syncopation_score", "local_bpm", "rms_avg")


def pack_flowmap(flowmap: dict[str, Any]) -> bytes:
    return zlib.compress(json.dumps(flowmap, ensure_ascii=False, separators=(",", ":")).encode("utf-8"), 6)


def unpack_flowmap(blob: bytes) -> dict[str, Any]:
    return json.loads(zlib.decompress(blob).decode("utf-8"))


def bar_density(flowmap: dict[str, Any]) -> list[float]:
    """Per-bar density, rounded, for the library card mini-map."""
    return [round(float(bar.get("density", 0) or 0), 2) for bar in flowmap.get("bars", [])]


def insert_analysis(conn: sqlite3.Connection, track: dict[str, Any], flowmap: dict[str, Any], analyzed_at: str) -> None:
    """Insert one track and everything derived from its flowmap. Call inside a transaction."""
    meta = flowmap.get("metadata", {})
    conn.execute(
        """INSERT INTO tracks (id, title, created_at, bpm, duration, bar_count, syllable_count,
                               audio_file, vocals_file, summary_json, bar_density_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            track["id"], track["title"], track["created_at"],
            float(meta.get("bpm") or 0), float(meta.get("duration") or 0),
            len(flowmap.get("bars", [])), len(flowmap.get("syllables", [])),
            track.get("audio_file"), track.get("vocals_file"),
            json.dumps(flowmap.get("summary", {})), json.dumps(bar_density(flowmap)),
        ),
    )
    conn.execute(
        "INSERT INTO analyses (track_id, schema_version, flowmap_zlib, analyzed_at) VALUES (?, ?, ?, ?)",
        (track["id"], int(flowmap.get("schema_version") or 0), pack_flowmap(flowmap), analyzed_at),
    )
    conn.executemany(
        f"INSERT OR REPLACE INTO bars (track_id, bar_no, {', '.join(BAR_COLUMNS)}) VALUES (?, ?, {', '.join('?' * len(BAR_COLUMNS))})",
        [(track["id"], int(bar.get("bar_no", index + 1)), *(bar.get(key) for key in BAR_COLUMNS)) for index, bar in enumerate(flowmap.get("bars", []))],
    )
    conn.executemany(
        f"INSERT INTO sections (track_id, idx, {', '.join(SECTION_COLUMNS)}) VALUES (?, ?, {', '.join('?' * len(SECTION_COLUMNS))})",
        [(track["id"], index, *(section.get(key) for key in SECTION_COLUMNS)) for index, section in enumerate(flowmap.get("sections", []))],
    )


def track_payload(row: sqlite3.Row, has_audio: bool, has_vocals: bool) -> dict[str, Any]:
    """The library entry in the shape the frontend already expects (former metadata.json)."""
    return {
        "id": row["id"],
        "title": row["title"],
        "created_at": row["created_at"],
        "bpm": row["bpm"],
        "duration": row["duration"],
        "bars": row["bar_count"],
        "syllables": row["syllable_count"],
        "summary": json.loads(row["summary_json"] or "{}"),
        "bar_density": json.loads(row["bar_density_json"] or "[]"),
        "has_audio": has_audio,
        "has_vocals": has_vocals,
    }
