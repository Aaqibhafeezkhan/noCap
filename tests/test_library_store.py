from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from nocap.library import LibraryStore


class LibraryStoreBarDensityTest(unittest.TestCase):
    def test_old_metadata_is_backfilled_once(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            track = root / "t1"
            track.mkdir()
            (track / "metadata.json").write_text(json.dumps({"title": "Old", "created_at": "2026-01-01"}))
            (track / "flowmap.json").write_text(json.dumps({"bars": [{"density": 1.234}, {"density": 0}, {}]}))

            tracks = LibraryStore(root).list_tracks()

            self.assertEqual([1.23, 0.0, 0.0], tracks[0]["bar_density"])
            stored = json.loads((track / "metadata.json").read_text())
            self.assertEqual([1.23, 0.0, 0.0], stored["bar_density"])
            self.assertEqual("Old", stored["title"])

    def test_missing_flowmap_leaves_metadata_untouched(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "t2").mkdir()
            (root / "t2" / "metadata.json").write_text(json.dumps({"title": "Broken"}))

            tracks = LibraryStore(root).list_tracks()

            self.assertNotIn("bar_density", tracks[0])


if __name__ == "__main__":
    unittest.main()
