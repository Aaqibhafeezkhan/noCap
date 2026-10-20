from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

# Each entry upgrades the schema by one version; ``PRAGMA user_version`` records how
# many have run. Append new migrations — never edit a released one.
MIGRATIONS: list[str] = [
    """
    CREATE TABLE tracks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        bpm REAL NOT NULL DEFAULT 0,
        duration REAL NOT NULL DEFAULT 0,
        bar_count INTEGER NOT NULL DEFAULT 0,
        syllable_count INTEGER NOT NULL DEFAULT 0,
        audio_file TEXT,
        vocals_file TEXT,
        summary_json TEXT NOT NULL DEFAULT '{}',
        bar_density_json TEXT NOT NULL DEFAULT '[]'
    );
    CREATE INDEX tracks_created_at ON tracks(created_at);

    CREATE TABLE analyses (
        track_id TEXT PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
        schema_version INTEGER NOT NULL,
        flowmap_zlib BLOB NOT NULL,
        analyzed_at TEXT NOT NULL
    );

    CREATE TABLE bars (
        track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
        bar_no INTEGER NOT NULL,
        density REAL, syncopation_score REAL, pocket_offset REAL, timing_variance REAL,
        stressed_ratio REAL, syllable_count INTEGER, local_bpm REAL, rms_avg REAL,
        PRIMARY KEY (track_id, bar_no)
    );
    CREATE INDEX bars_density ON bars(density);

    CREATE TABLE sections (
        track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
        idx INTEGER NOT NULL,
        start_bar INTEGER, end_bar INTEGER, avg_density REAL, syncopation_score REAL,
        local_bpm REAL, rms_avg REAL,
        PRIMARY KEY (track_id, idx)
    );

    CREATE TABLE legacy_imports (
        source_path TEXT PRIMARY KEY,
        track_id TEXT,
        imported_at TEXT NOT NULL
    );
    """,
]


def connect(path: Path) -> sqlite3.Connection:
    """Open the library database. PRAGMAs are per connection, so set them every time."""
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=5.0, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn


def migrate(conn: sqlite3.Connection) -> None:
    version = conn.execute("PRAGMA user_version").fetchone()[0]
    for number, script in enumerate(MIGRATIONS[version:], start=version + 1):
        with transaction(conn):
            for statement in _statements(script):
                conn.execute(statement)
            conn.execute(f"PRAGMA user_version = {number}")


@contextmanager
def transaction(conn: sqlite3.Connection) -> Iterator[sqlite3.Connection]:
    """BEGIN IMMEDIATE … COMMIT, rolled back on any exception (autocommit connection)."""
    conn.execute("BEGIN IMMEDIATE")
    try:
        yield conn
    except BaseException:
        conn.execute("ROLLBACK")
        raise
    conn.execute("COMMIT")


def _statements(script: str) -> list[str]:
    return [part.strip() for part in script.split(";") if part.strip()]
