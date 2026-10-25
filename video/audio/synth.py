"""Small synth toolkit for the promo soundtrack (numpy + scipy only): filters, a reverb,
sidechain ducking, an FM bell and a soft pad. Drums live in `drums.py`."""

from __future__ import annotations

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48_000
BPM = 140
BEAT = 60 / BPM
BAR = 4 * BEAT
RNG = np.random.default_rng(140)


def seconds(n: float) -> np.ndarray:
    return np.arange(int(n * SR)) / SR


def lowpass(x: np.ndarray, hz: float, order: int = 2) -> np.ndarray:
    return sosfilt(butter(order, hz, "low", fs=SR, output="sos"), x, axis=0)


def highpass(x: np.ndarray, hz: float, order: int = 2) -> np.ndarray:
    return sosfilt(butter(order, hz, "high", fs=SR, output="sos"), x, axis=0)


def bandpass(x: np.ndarray, lo: float, hi: float, order: int = 2) -> np.ndarray:
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x, axis=0)


def noise(n: float) -> np.ndarray:
    return RNG.uniform(-1, 1, int(n * SR))


def note_hz(midi: float) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


def saturate(x: np.ndarray, drive: float) -> np.ndarray:
    """Soft clipping that keeps the level about the same."""
    return np.tanh(drive * x) / np.tanh(drive)


def bell(midi: int, length: float) -> np.ndarray:
    """Dark FM bell, the usual trap lead: a sine carrier with a decaying 3.5x modulator."""
    t = seconds(length)
    f = note_hz(midi)
    index = 2.2 * np.exp(-t / 0.25) + 0.3
    mod = np.sin(2 * np.pi * f * 3.5 * t) * index
    tone = np.sin(2 * np.pi * f * t + mod) + 0.25 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.15)
    env = np.minimum(1, t / 0.003) * np.exp(-t / 0.9) * np.minimum(1, (length - t) / 0.02).clip(0)
    return tone * env * 0.5


def pad(midis: list[int], length: float) -> np.ndarray:
    """Slow, detuned saw chord under the bell, filtered dark."""
    t = seconds(length)
    out = np.zeros_like(t)
    for m in midis:
        for detune in (-0.08, 0.0, 0.08):
            phase = (note_hz(m + detune) * t) % 1.0
            out += 2 * phase - 1
    env = np.minimum(1, t / 0.35) * np.minimum(1, (length - t) / 0.4).clip(0)
    return lowpass(out, 900, 2) * env * (0.06 / len(midis))


def reverb(x: np.ndarray, length: float = 2.2, decay: float = 0.55, mix: float = 0.25) -> np.ndarray:
    """Stereo convolution reverb from decaying, decorrelated noise. `x` is (n, 2)."""
    t = seconds(length)
    wet = np.zeros_like(x)
    for c in range(2):
        ir = lowpass(RNG.standard_normal(len(t)), 6000) * np.exp(-t / (decay / 3))
        ir[: int(0.012 * SR)] = 0  # pre-delay
        wet[:, c] = fftconvolve(x[:, c], ir / np.sqrt(np.sum(ir**2)), mode="full")[: len(x)]
    return x * (1 - mix) + highpass(wet, 250) * mix


def duck(track: np.ndarray, hits: list[float], depth: float = 0.6, release: float = 0.18) -> np.ndarray:
    """Sidechain: pull `track` down after each hit time and let it recover."""
    gain = np.ones(len(track))
    t = seconds(release * 4)
    curve = 1 - depth * np.exp(-t / release) * np.minimum(1, t / 0.004 + 0.3)
    for at in hits:
        start = int(at * SR)
        if start >= len(gain):
            continue
        end = min(len(gain), start + len(curve))
        gain[start:end] = np.minimum(gain[start:end], curve[: end - start])
    return track * gain[:, None]


def place(track: np.ndarray, sound: np.ndarray, at: float, gain: float = 1.0, pan: float = 0.0) -> None:
    """Adds a mono sound into a stereo track at `at` seconds; pan -1 (left) … 1 (right)."""
    start = int(at * SR)
    if start >= len(track) or start < 0:
        return
    end = min(len(track), start + len(sound))
    piece = sound[: end - start] * gain
    track[start:end, 0] += piece * np.sqrt((1 - pan) / 2) * np.sqrt(2)
    track[start:end, 1] += piece * np.sqrt((1 + pan) / 2) * np.sqrt(2)


def sweep_lowpass(x: np.ndarray, start_hz: float, end_hz: float, blocks: int = 64) -> np.ndarray:
    """Lowpass whose cutoff moves from `start_hz` to `end_hz` (exponentially) over `x`."""
    out = np.zeros_like(x)
    edges = np.linspace(0, len(x), blocks + 1).astype(int)
    for i in range(blocks):
        hz = start_hz * (end_hz / start_hz) ** (i / (blocks - 1))
        a, b = max(0, edges[i] - 2048), edges[i + 1]
        out[edges[i] : b] = lowpass(x[a:b], hz)[edges[i] - a :]
    return out


def master(track: np.ndarray, peak_db: float = -1.0, drive: float = 1.4) -> np.ndarray:
    """Glue saturation, then scale so the loudest sample sits at `peak_db`."""
    shaped = saturate(track / np.max(np.abs(track)), drive)
    return shaped / np.max(np.abs(shaped)) * 10 ** (peak_db / 20)
