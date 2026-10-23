"""Live progress from libraries that only report through tqdm.

Demucs (its chunk loop) and Whisper, both MLX and PyTorch (their frame loop), drive a
``tqdm.tqdm`` progress bar that they look up at call time. While ``track_progress`` is
active that bar is replaced by a silent tracker that turns ``update`` calls into a
0–1 fraction for the analysis screen. If the callback raises (the user cancelled),
the exception stops the library's loop right there.

Only one analysis runs at a time, so swapping the module attribute is safe.
"""
from __future__ import annotations

import contextlib
from typing import Any, Callable, Iterator

import tqdm as tqdm_module

Callback = Callable[[float], None]


class _Tracker:
    """Just enough of the tqdm interface for Demucs and Whisper; prints nothing."""

    def __init__(self, callback: Callback, iterable: Any = None, total: float | None = None, **_options: Any) -> None:
        self._callback = callback
        self.iterable = iterable
        if total is None and iterable is not None and hasattr(iterable, "__len__"):
            total = len(iterable)
        self.total = total
        self.n = 0

    def __iter__(self) -> Iterator[Any]:
        for item in self.iterable:
            yield item
            self.update(1)

    def update(self, n: float = 1) -> None:
        self.n += n
        if self.total:
            self._callback(min(1.0, self.n / self.total))

    def __enter__(self) -> "_Tracker":
        return self

    def __exit__(self, *_exc: Any) -> bool:
        return False

    def close(self) -> None:
        pass

    def refresh(self, *_args: Any, **_kwargs: Any) -> None:
        pass

    def set_description(self, *_args: Any, **_kwargs: Any) -> None:
        pass

    def set_postfix(self, *_args: Any, **_kwargs: Any) -> None:
        pass


@contextlib.contextmanager
def track_progress(callback: Callback) -> Iterator[None]:
    original = tqdm_module.tqdm
    tqdm_module.tqdm = lambda *args, **kwargs: _Tracker(callback, *args, **kwargs)
    try:
        yield
    finally:
        tqdm_module.tqdm = original


def scaled(callback: Callback, start: float, end: float) -> Callback:
    """Map a sub-task's 0–1 onto ``start``–``end`` of its step."""
    return lambda fraction: callback(start + (end - start) * fraction)


def throttled(emit: Callable[[int], None], every: int = 2) -> Callback:
    """Report whole percentages, only when they moved ``every`` points (and never backwards)."""
    last = [-every]

    def report(fraction: float) -> None:
        pct = int(max(0.0, min(1.0, fraction)) * 100)
        if pct >= last[0] + every or (pct == 100 and last[0] < 100):
            last[0] = pct
            emit(pct)

    return report
