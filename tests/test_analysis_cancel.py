from __future__ import annotations

import io
import json
import tempfile
import threading
import unittest
from pathlib import Path
from unittest import mock

from nocap.library import LibraryStore
from nocap.pipeline import ProgressEvent
from nocap.web.analysis_jobs import AnalysisCancelled, CancelRegistry, cancellable
from nocap.web.state import SessionState


class CancelRegistryTest(unittest.TestCase):
    def test_cancel_sets_flag_until_closed(self) -> None:
        jobs = CancelRegistry()
        event = jobs.open("abc")
        self.assertTrue(jobs.cancel("abc"))
        self.assertTrue(event.is_set())
        jobs.close("abc")
        self.assertFalse(jobs.cancel("abc"))

    def test_cancellable_reporter_raises_after_cancel(self) -> None:
        seen: list[ProgressEvent] = []
        event = threading.Event()
        report = cancellable(seen.append, event)
        report(ProgressEvent("load", "x"))
        event.set()
        with self.assertRaises(AnalysisCancelled):
            report(ProgressEvent("beat", "y"))
        self.assertEqual(["load"], [item.step for item in seen])


class AnalyzeRouteCancelTest(unittest.TestCase):
    def test_cancel_endpoint_stops_running_analysis(self) -> None:
        from nocap.web.app import create_app

        started = threading.Event()

        def fake_analyze(_path, _options, reporter):
            reporter(ProgressEvent("load", "loading"))
            started.set()
            for _ in range(500):
                threading.Event().wait(0.01)
                reporter(ProgressEvent("transcribe", "", pct=1))
            raise AssertionError("analysis was not cancelled")

        with tempfile.TemporaryDirectory() as tmp:
            app = create_app(Path(tmp), LibraryStore(Path(tmp) / "data"), SessionState())
            client = app.test_client()
            with mock.patch("nocap.web.analysis_routes.analyze_track", fake_analyze), \
                 mock.patch("nocap.audio.separator.is_available", return_value=False):
                response = client.post(
                    "/api/analyze",
                    data={"audio": (io.BytesIO(b"fake"), "song.mp3")},
                    content_type="multipart/form-data",
                    buffered=False,
                )
                stream = response.response
                first = _event(next(stream))
                self.assertEqual("started", first["type"])
                self.assertTrue(started.wait(2))
                cancel = client.post(f"/api/analyze/{first['track_id']}/cancel")
                self.assertEqual(200, cancel.status_code)
                kinds = [_event(chunk)["type"] for chunk in stream]
                self.assertEqual("cancelled", kinds[-1])
                self.assertFalse((Path(tmp) / "data" / "audio" / first["track_id"]).exists())

    def test_cancel_unknown_job_is_404(self) -> None:
        from nocap.web.app import create_app

        with tempfile.TemporaryDirectory() as tmp:
            app = create_app(Path(tmp), LibraryStore(Path(tmp) / "data"), SessionState())
            self.assertEqual(404, app.test_client().post("/api/analyze/nope/cancel").status_code)


def _event(chunk: bytes | str) -> dict:
    text = chunk.decode() if isinstance(chunk, bytes) else chunk
    return json.loads(text.strip().removeprefix("data: "))


if __name__ == "__main__":
    unittest.main()
