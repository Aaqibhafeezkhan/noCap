from __future__ import annotations

import threading

from nocap.pipeline import ProgressEvent


class AnalysisCancelled(Exception):
    """Raised inside the analysis thread when the user cancels the job."""


class CancelRegistry:
    """Tracks one cancel flag per running analysis, keyed by track id."""

    def __init__(self) -> None:
        self._events: dict[str, threading.Event] = {}
        self._lock = threading.Lock()

    def open(self, track_id: str) -> threading.Event:
        event = threading.Event()
        with self._lock:
            self._events[track_id] = event
        return event

    def cancel(self, track_id: str) -> bool:
        with self._lock:
            event = self._events.get(track_id)
        if event is None:
            return False
        event.set()
        return True

    def close(self, track_id: str) -> None:
        with self._lock:
            self._events.pop(track_id, None)


def cancellable(forward, cancel_event: threading.Event):
    """Wrap a progress reporter so every progress tick is also a cancel checkpoint.

    The pipeline reports at each step boundary and on every Whisper progress tick,
    so raising here stops the job at the next checkpoint. A step that does not
    report (vocal separation) runs to its end before the cancel takes effect.
    """

    def report(event: ProgressEvent) -> None:
        if cancel_event.is_set():
            raise AnalysisCancelled()
        forward(event)

    return report
