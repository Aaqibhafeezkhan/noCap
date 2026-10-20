from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from nocap.library import LibraryStore
from nocap.library.importer import import_legacy
from nocap.library.paths import DATA_DIR_ENV, data_dir


def _legacy_track(root: Path, track_id: str, title: str = "Old") -> Path:
    folder = root / track_id
    folder.mkdir(parents=True)
    flowmap = {"metadata": {"title": title, "bpm": 90, "duration": 3, "audio_path": "/gone.wav"}, "bars": [{"bar_no": 1, "density": 2}], "syllables": []}
    (folder / "flowmap.json").write_text(json.dumps(flowmap))
    (folder / "metadata.json").write_text(json.dumps({"title": title, "created_at": "2026-01-01T00:00:00+00:00"}))
    (folder / "audio.wav").write_bytes(b"mix")
    (folder / "vocals.wav").write_bytes(b"vox")
    return folder


class LegacyImportTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        base = Path(self.tmp.name)
        self.legacy = base / "legacy"
        self.store = LibraryStore(base / "data")

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_imports_copies_audio_and_keeps_old_folder(self) -> None:
        folder = _legacy_track(self.legacy, "abc")
        self.assertEqual(["abc"], import_legacy(self.store, [self.legacy]))
        [track] = self.store.list_tracks()
        self.assertEqual(("abc", "Old", "2026-01-01T00:00:00+00:00"), (track["id"], track["title"], track["created_at"]))
        self.assertTrue(track["has_audio"] and track["has_vocals"])
        self.assertEqual(b"mix", (self.store.track_dir("abc") / "mix.wav").read_bytes())
        self.assertTrue((folder / "audio.wav").exists())

    def test_second_run_does_not_duplicate(self) -> None:
        _legacy_track(self.legacy, "abc")
        import_legacy(self.store, [self.legacy])
        self.assertEqual([], import_legacy(self.store, [self.legacy]))
        self.assertEqual(1, len(self.store.list_tracks()))

    def test_same_track_in_two_old_folders_is_imported_once(self) -> None:
        other = Path(self.tmp.name) / "legacy2"
        _legacy_track(self.legacy, "abc")
        _legacy_track(other, "abc")
        self.assertEqual(["abc"], import_legacy(self.store, [self.legacy, other]))
        self.assertEqual(1, len(self.store.list_tracks()))

    def test_broken_folder_is_skipped(self) -> None:
        broken = self.legacy / "bad"
        broken.mkdir(parents=True)
        (broken / "flowmap.json").write_text("{not json")
        _legacy_track(self.legacy, "good")
        with self.assertLogs("nocap.library.importer", level="WARNING"):
            self.assertEqual(["good"], import_legacy(self.store, [self.legacy]))
        self.assertFalse(self.store.track_dir("bad").exists())

    def test_missing_legacy_dir_is_fine(self) -> None:
        self.assertEqual([], import_legacy(self.store, [Path(self.tmp.name) / "nowhere"]))


class DataDirTest(unittest.TestCase):
    def test_env_override(self) -> None:
        with mock.patch.dict(os.environ, {DATA_DIR_ENV: "/tmp/nocap-test"}):
            self.assertEqual(Path("/tmp/nocap-test"), data_dir())

    def test_dev_and_packaged_use_separate_folders(self) -> None:
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop(DATA_DIR_ENV, None)
            dev = data_dir()
            with mock.patch("nocap.library.paths.is_packaged", return_value=True):
                packaged = data_dir()
        self.assertEqual("noCap-dev", dev.name)
        self.assertEqual("noCap", packaged.name)


if __name__ == "__main__":
    unittest.main()
