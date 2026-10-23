from __future__ import annotations

import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import numpy as np
import tqdm

from nocap.audio import gap_repair
from nocap.audio.transcriber import TranscriptWord
from nocap.library import LibraryStore
from nocap.pipeline import ProgressEvent
from nocap.pipeline.progress import scaled, throttled, track_progress
from nocap.web.state import SessionState


class TrackProgressTest(unittest.TestCase):
    def test_iterating_and_updating_report_fractions(self) -> None:
        seen: list[float] = []
        with track_progress(seen.append):
            for _ in tqdm.tqdm(range(4), unit="seconds"):  # Demucs style
                pass
            with tqdm.tqdm(total=200, unit="frames", disable=True) as bar:  # Whisper style
                bar.update(50)
                bar.update(150)
        self.assertEqual([0.25, 0.5, 0.75, 1.0, 0.25, 1.0], seen)

    def test_original_tqdm_comes_back_and_a_raising_callback_stops_the_loop(self) -> None:
        original = tqdm.tqdm
        done = []

        def cancel(_fraction: float) -> None:
            raise KeyboardInterrupt  # stands in for the analysis being cancelled

        with self.assertRaises(KeyboardInterrupt):
            with track_progress(cancel):
                for item in tqdm.tqdm(range(10)):
                    done.append(item)
        self.assertEqual([0], done)
        self.assertIs(original, tqdm.tqdm)

    def test_throttled_and_scaled(self) -> None:
        sent: list[int] = []
        report = scaled(throttled(sent.append), 0.5, 1.0)
        for fraction in (0.0, 0.01, 0.03, 0.04, 0.5, 0.3, 1.0):
            report(fraction)
        self.assertEqual([50, 52, 75, 100], sent)  # 51 is under the 2-point step; 0.3 would go backwards


class GapRepairProgressTest(unittest.TestCase):
    def test_reports_each_hole_and_the_end(self) -> None:
        sr = gap_repair.SAMPLE_RATE
        audio = np.random.default_rng(0).normal(0, 0.2, 30 * sr).astype(np.float32)
        words = [TranscriptWord("yo", t, t + 0.4) for t in (*np.arange(0, 5, 0.5), *np.arange(12, 15, 0.5), *np.arange(25, 30, 0.5))]
        seen: list[float] = []
        gap_repair.repair(audio, words, lambda clip: [], on_progress=seen.append)
        self.assertEqual([0.5, 1.0, 1.0], seen)


class FindingsInStreamTest(unittest.TestCase):
    def test_step_findings_reach_the_event_stream(self) -> None:
        from nocap.web.app import create_app

        def fake_analyze(_path, _options, reporter):
            reporter(ProgressEvent("beat", "BPM: 99", True, info={"bpm": 99}))
            reporter(ProgressEvent("separate", "", pct=40))
            raise ValueError("stop here")

        with tempfile.TemporaryDirectory() as tmp:
            app = create_app(Path(tmp), LibraryStore(Path(tmp) / "data"), SessionState())
            with mock.patch("nocap.web.analysis_routes.analyze_track", fake_analyze), \
                 mock.patch("nocap.audio.separator.is_available", return_value=False):
                response = app.test_client().post(
                    "/api/analyze", data={"audio": (io.BytesIO(b"fake"), "song.mp3")}, content_type="multipart/form-data",
                )
                events = [json.loads(line[6:]) for line in response.get_data(as_text=True).splitlines() if line.startswith("data: ")]
        progress = [event for event in events if event["type"] == "progress"]
        self.assertEqual({"bpm": 99}, progress[0]["info"])
        self.assertEqual(("separate", 40), (progress[1]["step"], progress[1]["pct"]))
        self.assertNotIn("info", progress[1])


if __name__ == "__main__":
    unittest.main()
