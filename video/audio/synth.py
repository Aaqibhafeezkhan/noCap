"""Small drum-machine and synth toolkit for the promo soundtrack (numpy + scipy only)."""

from __future__ import annotations

import numpy as np
from scipy.signal import butter, sosfilt

SR = 48_000
BPM = 92
BEAT = 60 / BPM
BAR = 4 * BEAT
RNG = np.random.default_rng(92)


def seconds(n: float) -> np.ndarray:
    return np.arange(int(n * SR)) / SR


def lowpass(x: np.ndarray, hz: float, order: int = 2) -> np.ndarray:
    return sosfilt(butter(order, hz, "low", fs=SR, output="sos"), x)


def highpass(x: np.ndarray, hz: float, order: int = 2) -> np.ndarray:
    return sosfilt(butter(order, hz, "high", fs=SR, output="sos"), x)


def bandpass(x: np.ndarray, lo: float, hi: float, order: int = 2) -> np.ndarray:
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def noise(n: float) -> np.ndarray:
    return RNG.uniform(-1, 1, int(n * SR))


def kick() -> np.ndarray:
    t = seconds(0.45)
    freq = 45 + 85 * np.exp(-t / 0.035)
    body = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t / 0.16)
    click = highpass(noise(0.45), 1800) * np.exp(-t / 0.004) * 0.35
    return np.tanh(1.6 * (body + click)) * 0.95


def snare() -> np.ndarray:
    t = seconds(0.35)
    tone = np.sin(2 * np.pi * 185 * t) * np.exp(-t / 0.05) * 0.5
    rattle = bandpass(noise(0.35), 1500, 9000) * np.exp(-t / 0.09)
    room = lowpass(noise(0.35), 3000) * np.exp(-t / 0.16) * 0.18
    return np.tanh(1.4 * (tone + rattle + room)) * 0.8


def hat(open_: bool = False) -> np.ndarray:
    length = 0.32 if open_ else 0.06
    t = seconds(length)
    decay = 0.09 if open_ else 0.014
    return highpass(noise(length), 7000, 4) * np.exp(-t / decay) * 0.5


def crash() -> np.ndarray:
    t = seconds(2.2)
    return highpass(noise(2.2), 4000, 2) * np.exp(-t / 0.6) * 0.32


def note_hz(midi: float) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


def bass(midi: int, length: float) -> np.ndarray:
    t = seconds(length)
    f = note_hz(midi)
    tone = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)
    env = np.minimum(1, t / 0.008) * np.exp(-t / (length * 0.9))
    return np.tanh(1.8 * tone * env) * 0.55


def keys(midis: list[int], length: float) -> np.ndarray:
    """Soft electric-piano chord: a few decaying partials with slow tremolo."""
    t = seconds(length)
    out = np.zeros_like(t)
    for m in midis:
        f = note_hz(m)
        out += (np.sin(2 * np.pi * f * t) + 0.18 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.3)) * np.exp(-t / 1.6)
    trem = 1 + 0.12 * np.sin(2 * np.pi * 4.2 * t)
    env = np.minimum(1, t / 0.01) * np.minimum(1, (length - t) / 0.08).clip(0)
    return lowpass(out * trem * env, 2400) * (0.22 / max(1, len(midis) ** 0.5))


def place(track: np.ndarray, sound: np.ndarray, at: float, gain: float = 1.0, pan: float = 0.0) -> None:
    """Adds a mono sound into a stereo track at `at` seconds; pan -1 (left) … 1 (right)."""
    start = int(at * SR)
    if start >= len(track):
        return
    end = min(len(track), start + len(sound))
    piece = sound[: end - start] * gain
    track[start:end, 0] += piece * np.sqrt((1 - pan) / 2) * np.sqrt(2)
    track[start:end, 1] += piece * np.sqrt((1 + pan) / 2) * np.sqrt(2)


def master(track: np.ndarray, peak_db: float = -1.0) -> np.ndarray:
    """Soft-clips, then scales so the loudest sample sits at `peak_db`."""
    shaped = np.tanh(track * 1.1)
    return shaped / np.max(np.abs(shaped)) * 10 ** (peak_db / 20)
