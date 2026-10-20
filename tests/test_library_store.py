from __future__ import annotations

import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from nocap.library import LibraryStore


def _flowmap(bars: int = 3) -> dict:
    return {
        "schema_version": 2,
        "metadata": {"title": "Song", "bpm": 92.0, "duration": 10.5, "audio_path": "/old/place.wav"},
        "syllables": [{"word": "a"}, {"word": "b"}],
        "bars": [{"bar_no": index + 1, "density": 1.234 * index, "syllable_count": index} for index in range(bars)],
        "sections": [{"start_bar": 1, "end_bar": bars, "avg_density": 1.0}],
        "summary": {"avg_density": 1.1},
    }


class LibraryStoreTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.store = LibraryStore(self.root)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def _save(self, track_id: str = "t1") -> None:
        upload = self.root / f"{track_id}.mp3"
        upload.write_bytes(b"mp3")
        self.store.save_track(track_id=track_id, title="Song", flowmap=_flowmap(), tmp_audio=upload, audio_suffix=".mp3")

    def test_save_list_and_open_round_trip(self) -> None:
        self._save()
        [track] = self.store.list_tracks()
        self.assertEqual("Song", track["title"])
        self.assertEqual(3, track["bars"])
        self.assertEqual([0.0, 1.23, 2.47], track["bar_density"])
        self.assertEqual({"avg_density": 1.1}, track["summary"])
        self.assertTrue(track["has_audio"])
        self.assertFalse(track["has_vocals"])
        flowmap, audio, vocals, meta = self.store.load_track("t1")
        self.assertEqual(self.store.track_dir("t1") / "mix.mp3", audio)
        self.assertEqual(str(audio), flowmap["metadata"]["audio_path"])
        self.assertIsNone(vocals)
        self.assertEqual("t1", meta["id"])

    def test_bars_and_sections_are_queryable(self) -> None:
        self._save()
        with self.store.connection() as conn:
            top = conn.execute("SELECT bar_no FROM bars ORDER BY density DESC LIMIT 1").fetchone()[0]
            sections = conn.execute("SELECT count(*) FROM sections").fetchone()[0]
        self.assertEqual(3, top)
        self.assertEqual(1, sections)

    def test_delete_removes_rows_and_audio(self) -> None:
        self._save()
        self.store.delete_track("t1")
        self.assertEqual([], self.store.list_tracks())
        self.assertFalse(self.store.track_dir("t1").exists())
        with self.store.connection() as conn:
            self.assertEqual(0, conn.execute("SELECT count(*) FROM bars").fetchone()[0])
            self.assertEqual(0, conn.execute("SELECT count(*) FROM analyses").fetchone()[0])
        with self.assertRaises(FileNotFoundError):
            self.store.delete_track("t1")

    def test_failed_insert_leaves_no_audio_or_rows(self) -> None:
        upload = self.root / "x.mp3"
        upload.write_bytes(b"mp3")
        with mock.patch("nocap.library.store.insert_analysis", side_effect=sqlite3.OperationalError("boom")):
            with self.assertRaises(sqlite3.OperationalError):
                self.store.save_track(track_id="t2", title="X", flowmap=_flowmap(), tmp_audio=upload, audio_suffix=".mp3")
        self.assertFalse(self.store.track_dir("t2").exists())
        self.assertEqual([], self.store.list_tracks())

    def test_missing_track_raises(self) -> None:
        with self.assertRaises(FileNotFoundError):
            self.store.load_track("nope")
        self.assertIsNone(self.store.read_metadata("nope"))

    def test_schema_version_is_recorded(self) -> None:
        with self.store.connection() as conn:
            self.assertEqual(1, conn.execute("PRAGMA user_version").fetchone()[0])
            self.assertEqual("wal", conn.execute("PRAGMA journal_mode").fetchone()[0])


if __name__ == "__main__":
    unittest.main()
