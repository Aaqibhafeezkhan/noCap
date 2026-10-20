from __future__ import annotations

import json
import logging
import shutil
from datetime import datetime, timezone
from pathlib import Path

from .db import transaction
from .store import LibraryStore

log = logging.getLogger(__name__)


def import_legacy(store: LibraryStore, dirs: list[Path]) -> list[str]:
    """Copy tracks from the old one-folder-per-track layout into ``store``.

    Audio is copied, never moved, and the old folders are left alone. Every source
    folder is recorded, so later starts skip it; broken folders are logged and skipped.
    Returns the ids of the tracks imported in this run.
    """
    imported: list[str] = []
    for root in dirs:
        if not root.is_dir():
            continue
        for folder in sorted(path for path in root.iterdir() if path.is_dir()):
            try:
                track_id = _import_folder(store, folder)
            except Exception as exc:  # noqa: BLE001 - one bad folder must not block the rest
                log.warning("Skipping legacy track %s: %s", folder, exc)
                continue
            if track_id:
                imported.append(track_id)
    return imported


def _import_folder(store: LibraryStore, folder: Path) -> str | None:
    source = str(folder.resolve())
    with store.connection() as conn:
        if conn.execute("SELECT 1 FROM legacy_imports WHERE source_path = ?", (source,)).fetchone():
            return None
    flowmap_path = folder / "flowmap.json"
    if not flowmap_path.exists():
        return None
    flowmap = json.loads(flowmap_path.read_text(encoding="utf-8"))
    meta_path = folder / "metadata.json"
    meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
    track_id = folder.name
    if store.read_metadata(track_id) is not None:
        _remember(store, source, None)  # same track already present (e.g. imported from the other folder)
        return None

    target = store.track_dir(track_id)
    target.mkdir(parents=True, exist_ok=True)
    try:
        mix = _copy_mix(folder, target)
        vocals = _copy(folder / "vocals.wav", target / "vocals.wav")
        title = meta.get("title") or flowmap.get("metadata", {}).get("title") or track_id
        created_at = meta.get("created_at") or datetime.now(timezone.utc).isoformat()
        with store.connection() as conn, transaction(conn):
            store.add_track(track_id, title, flowmap, mix, vocals, created_at, conn=conn)
            conn.execute(
                "INSERT INTO legacy_imports (source_path, track_id, imported_at) VALUES (?, ?, ?)",
                (source, track_id, datetime.now(timezone.utc).isoformat()),
            )
    except BaseException:
        shutil.rmtree(target, ignore_errors=True)
        raise
    log.info("Imported legacy track %s (%s)", track_id, title)
    return track_id


def _copy_mix(folder: Path, target: Path) -> str | None:
    for candidate in sorted(folder.glob("audio.*")):
        return _copy(candidate, target / f"mix{candidate.suffix}")
    return None


def _copy(source: Path, destination: Path) -> str | None:
    if not source.exists():
        return None
    shutil.copy2(source, destination)
    return destination.name


def _remember(store: LibraryStore, source: str, track_id: str | None) -> None:
    with store.connection() as conn, transaction(conn):
        conn.execute(
            "INSERT OR IGNORE INTO legacy_imports (source_path, track_id, imported_at) VALUES (?, ?, ?)",
            (source, track_id, datetime.now(timezone.utc).isoformat()),
        )
