from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from nocap.audio.demucs_models import bundled_demucs_dir


class DemucsModelsTest(unittest.TestCase):
    def test_bundled_dir_is_used_when_resources_hold_the_weights(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp) / "demucs_models"
            (repo / "checkpoints").mkdir(parents=True)
            (repo / "checkpoints" / "955717e8-8726e21a.th").write_bytes(b"")
            with mock.patch.dict(os.environ, {"NOCAP_RESOURCES": tmp}):
                self.assertEqual(repo, bundled_demucs_dir())

    def test_resources_without_weights_falls_back_to_download(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            with mock.patch.dict(os.environ, {"NOCAP_RESOURCES": tmp}):
                self.assertIsNone(bundled_demucs_dir())

    def test_dev_mode_has_no_bundled_dir(self) -> None:
        env = {k: v for k, v in os.environ.items() if k != "NOCAP_RESOURCES"}
        with mock.patch.dict(os.environ, env, clear=True):
            self.assertIsNone(bundled_demucs_dir())


if __name__ == "__main__":
    unittest.main()
