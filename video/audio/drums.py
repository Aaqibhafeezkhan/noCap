"""Trap drum kit for the promo: kick, 808 with glide, clap, hats (with rolls), crash and perc."""

from __future__ import annotations

import numpy as np

from synth import SR, bandpass, highpass, lowpass, noise, note_hz, saturate, seconds


def kick() -> np.ndarray:
    """Short, punchy kick that sits on top of the 808's transient."""
    t = seconds(0.22)
    freq = 55 + 160 * np.exp(-t / 0.025)
    body = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t / 0.07)
    click = highpass(noise(0.22), 2500) * np.exp(-t / 0.003) * 0.5
    return saturate(body + click, 2.0) * 0.9


def eight08(midi: int, length: float, glide_to: int | None = None, glide_at: float = 0.6, decay: float | None = None) -> np.ndarray:
    """Tuned 808: sine with a small pitch drop, long decay and saturation for laptop speakers.
    With `glide_to`, the pitch slides there over the last part of the note."""
    t = seconds(length)
    f0, f1 = note_hz(midi), note_hz(glide_to if glide_to is not None else midi)
    p = np.clip((t / length - glide_at) / (1 - glide_at), 0, 1) if glide_to is not None else np.zeros_like(t)
    glide = f0 * (f1 / f0) ** (p**0.7)
    freq = glide * (1 + 0.6 * np.exp(-t / 0.012))
    tone = np.sin(2 * np.pi * np.cumsum(freq) / SR)
    env = np.minimum(1, t / 0.002) * np.exp(-t / (decay or max(0.4, length * 0.9))) * np.minimum(1, (length - t) / 0.03).clip(0)
    tone = tone + 0.35 * np.sin(2 * np.pi * np.cumsum(2 * freq) / SR)
    driven = saturate(tone * env, 3.0)
    return lowpass(driven, 2200) * 0.85


def clap() -> np.ndarray:
    """Layered clap: three quick noise bursts, then a short tail, plus a snare body."""
    t = seconds(0.4)
    bursts = np.zeros_like(t)
    for offset in (0.0, 0.009, 0.019):
        local = np.clip(t - offset, 0, None)
        bursts += (t >= offset) * np.exp(-local / (0.006 if offset < 0.019 else 0.11))
    body = np.sin(2 * np.pi * 200 * t) * np.exp(-t / 0.04) * 0.35
    return saturate(bandpass(noise(0.4), 900, 7500) * bursts + body, 1.6) * 0.85


def hat(open_: bool = False) -> np.ndarray:
    length = 0.35 if open_ else 0.05
    t = seconds(length)
    metal = sum(np.sign(np.sin(2 * np.pi * f * t)) for f in (3140, 4410, 5873, 7350)) / 4
    tone = highpass(noise(length) * 0.7 + metal * 0.5, 7500, 4)
    return tone * np.exp(-t / (0.12 if open_ else 0.012)) * 0.45


def crash() -> np.ndarray:
    t = seconds(2.4)
    return highpass(noise(2.4), 4500, 2) * np.exp(-t / 0.7) * 0.35


def rim() -> np.ndarray:
    t = seconds(0.08)
    return bandpass(noise(0.08) * 0.4 + np.sin(2 * np.pi * 1750 * t), 1200, 4000) * np.exp(-t / 0.015) * 0.5


def reverse_crash(length: float) -> np.ndarray:
    """A crash played backwards: swells into the next downbeat."""
    t = seconds(length)
    swell = highpass(noise(length), 3500, 2) * np.exp(-(length - t) / (length * 0.35))
    return lowpass(swell, 12000) * 0.35


def hat_roll(division: int, beats: float, gain_from: float, gain_to: float) -> list[tuple[float, float]]:
    """(offset in beats, gain) for a roll of `division` notes per beat with a velocity ramp."""
    count = max(1, int(round(division * beats)))
    return [(i / division, gain_from + (gain_to - gain_from) * i / max(1, count - 1)) for i in range(count)]
