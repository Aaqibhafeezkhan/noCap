from __future__ import annotations

import shutil
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .db import connect, migrate, transaction
from .rows import insert_analysis, track_payload, unpack_flowmap


class LibraryStore:
    """Track library: one SQLite database for metadata and analyses, audio as files.

    Layout under ``root``::

        library.db              tracks, analyses (zlib flowmap), bars, sections
        audio/<track_id>/       mix.<ext>, vocals.wav

    Audio stays outside the database: SQLite reads blobs above ~100 KB slower than
    plain files, and the WAVs are ~12 MB each.
    """

    def __init__(self, root: Path) -> None:
        self.root = root
        self.db_path = root / "library.db"
        with self.connection():
            pass  # creates the folder and runs migrations once

    def list_tracks(self) -> list[dict[str, Any]]:
        with self.connection() as conn:
            rows = conn.execute("SELECT * FROM tracks ORDER BY created_at DESC").fetchall()
        return [self._payload(row) for row in rows]

    def read_metadata(self, track_id: str) -> dict[str, Any] | None:
        with self.connection() as conn:
            row = conn.execute("SELECT * FROM tracks WHERE id = ?", (track_id,)).fetchone()
        return self._payload(row) if row else None

    def save_track(self, *, track_id: str, title: str, flowmap: dict[str, Any], tmp_audio: Path, audio_suffix: str, mix_audio=None, vocals_audio=None):
        audio_dir = self.track_dir(track_id)
        audio_dir.mkdir(parents=True, exist_ok=True)
        try:
            audio_path = self._write_mix(audio_dir, tmp_audio, audio_suffix, mix_audio)
            vocals_path = self._write_vocals(audio_dir, vocals_audio)
            flowmap["metadata"]["audio_path"] = str(audio_path)
            self.add_track(track_id, title, flowmap, audio_path.name, vocals_path.name if vocals_path else None, _now())
        except BaseException:
            shutil.rmtree(audio_dir, ignore_errors=True)
            raise
        return self.read_metadata(track_id), audio_path, vocals_path

    def add_track(self, track_id: str, title: str, flowmap: dict[str, Any], audio_file: str | None, vocals_file: str | None, created_at: str, conn: sqlite3.Connection | None = None) -> None:
        """Insert a track whose audio already sits in ``track_dir(track_id)`` — one transaction."""
        track = {"id": track_id, "title": title, "created_at": created_at, "audio_file": audio_file, "vocals_file": vocals_file}
        if conn is not None:
            insert_analysis(conn, track, flowmap, _now())
            return
        with self.connection() as own, transaction(own):
            insert_analysis(own, track, flowmap, _now())

    def load_track(self, track_id: str):
        with self.connection() as conn:
            row = conn.execute(
                "SELECT t.*, a.flowmap_zlib FROM tracks t JOIN analyses a ON a.track_id = t.id WHERE t.id = ?",
                (track_id,),
            ).fetchone()
        if row is None:
            raise FileNotFoundError(track_id)
        flowmap = unpack_flowmap(row["flowmap_zlib"])
        audio_path = self._file(track_id, row["audio_file"])
        vocals_path = self._file(track_id, row["vocals_file"])
        # Paths are resolved now, so moving the data folder never breaks playback.
        flowmap.setdefault("metadata", {})["audio_path"] = str(audio_path) if audio_path else ""
        return flowmap, audio_path or Path(""), vocals_path if vocals_path and vocals_path.exists() else None, self._payload(row)

    def delete_track(self, track_id: str) -> None:
        with self.connection() as conn, transaction(conn):
            deleted = conn.execute("DELETE FROM tracks WHERE id = ?", (track_id,)).rowcount
        if not deleted:
            raise FileNotFoundError(track_id)
        shutil.rmtree(self.track_dir(track_id), ignore_errors=True)

    def track_dir(self, track_id: str) -> Path:
        return self.root / "audio" / track_id

    def connection(self):
        """Open a short-lived connection (migrated, closed on exit): `with store.connection() as conn`."""
        conn = connect(self.db_path)
        migrate(conn)
        return _Closing(conn)

    def _payload(self, row: sqlite3.Row) -> dict[str, Any]:
        audio = self._file(row["id"], row["audio_file"])
        vocals = self._file(row["id"], row["vocals_file"])
        return track_payload(row, bool(audio and audio.exists()), bool(vocals and vocals.exists()))

    def _file(self, track_id: str, name: str | None) -> Path | None:
        return self.track_dir(track_id) / name if name else None

    def _write_mix(self, audio_dir: Path, tmp_audio: Path, audio_suffix: str, mix_audio) -> Path:
        if mix_audio is None:
            audio_path = audio_dir / f"mix{audio_suffix}"
            shutil.move(str(tmp_audio), audio_path)
            return audio_path
        import soundfile as sf

        audio_path = audio_dir / "mix.wav"
        sf.write(audio_path, mix_audio.y, mix_audio.sr)
        tmp_audio.unlink(missing_ok=True)
        return audio_path

    def _write_vocals(self, audio_dir: Path, vocals_audio) -> Path | None:
        if vocals_audio is None:
            return None
        import soundfile as sf

        vocals_path = audio_dir / "vocals.wav"
        sf.write(vocals_path, vocals_audio.y, vocals_audio.sr)
        return vocals_path


class _Closing:
    """``with store.connection() as conn`` that closes the connection on exit."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self.conn = conn

    def __enter__(self) -> sqlite3.Connection:
        return self.conn

    def __exit__(self, *exc) -> None:
        self.conn.close()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
