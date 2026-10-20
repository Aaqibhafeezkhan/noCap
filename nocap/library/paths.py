from __future__ import annotations

import os
import sys
from pathlib import Path

APP_NAME = "noCap"
DATA_DIR_ENV = "NOCAP_DATA_DIR"
_PROJECT_ROOT = Path(__file__).resolve().parents[2]


def is_packaged() -> bool:
    """True inside the PyInstaller-built desktop app."""
    return bool(getattr(sys, "frozen", False))


def data_dir() -> Path:
    """Per-user data folder: the OS's standard app-data location.

    The packaged app and development runs use separate folders so experiments never
    touch a real library. ``NOCAP_DATA_DIR`` overrides both (tests, custom setups).
    """
    override = os.environ.get(DATA_DIR_ENV)
    if override:
        return Path(override).expanduser()
    name = APP_NAME if is_packaged() else f"{APP_NAME}-dev"
    return _user_data_root() / name


def _user_data_root() -> Path:
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support"
    if sys.platform.startswith("win"):
        return Path(os.environ.get("APPDATA") or Path.home() / "AppData" / "Roaming")
    return Path(os.environ.get("XDG_DATA_HOME") or Path.home() / ".local" / "share")


def legacy_dirs() -> list[Path]:
    """Folders used by earlier versions (one directory of JSON files per track)."""
    dirs = [Path.home() / ".nocap_library" / "tracks"]
    if not is_packaged():
        dirs.append(_PROJECT_ROOT / ".nocap_library" / "tracks")
    return dirs
