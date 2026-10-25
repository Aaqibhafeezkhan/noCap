"""Writes the promo's sound effects as short WAV files.

click  – UI click under each recorded mouse click
whoosh – scene transitions and camera moves
pop    – a highlight or caption popping in
riser  – builds into the drop
impact – big hits (the drop, the logo)
chime  – the closing card
subdrop – a falling sub under the drops
glitch – digital stutter on the hard cuts
whip   – fast whip-pan between feature scenes
tick   – a word of kinetic type landing

usage: python video/audio/make_sfx.py [out_dir]
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import soundfile as sf

from synth import SR, bandpass, highpass, lowpass, noise, seconds


def click() -> np.ndarray:
    t = seconds(0.08)
    tick = highpass(noise(0.08), 2500) * np.exp(-t / 0.003)
    body = np.sin(2 * np.pi * 1400 * t) * np.exp(-t / 0.012) * 0.5
    return (tick + body) * 0.7


def whoosh(length: float = 0.55) -> np.ndarray:
    t = seconds(length)
    x = noise(length)
    # Sweep a band-pass upward by crossfading three bands, shaped by a swell.
    low, mid, high = bandpass(x, 200, 900), bandpass(x, 700, 2500), bandpass(x, 2000, 7000)
    p = t / length
    swept = low * (1 - p) ** 2 + mid * 2 * p * (1 - p) + high * p**2
    env = np.sin(np.pi * p) ** 1.5
    return swept * env * 1.6


def pop() -> np.ndarray:
    t = seconds(0.12)
    freq = 520 + 700 * np.exp(-t / 0.018)
    return np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t / 0.035) * 0.8


def riser(length: float = 3.4) -> np.ndarray:
    t = seconds(length)
    p = t / length
    tone = np.sin(2 * np.pi * np.cumsum(180 + 700 * p**2) / SR) * 0.25
    air = highpass(noise(length), 1500) * 0.5
    air = lowpass(air, 9000) * p**2
    env = p**2.2 * np.minimum(1, (length - t) / 0.03)
    return (tone + air) * env


def impact() -> np.ndarray:
    t = seconds(1.6)
    freq = 38 + 90 * np.exp(-t / 0.06)
    sub = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t / 0.5)
    hit = lowpass(noise(1.6), 2500) * np.exp(-t / 0.05) * 0.5
    return np.tanh(1.5 * (sub + hit)) * 0.9


def chime() -> np.ndarray:
    t = seconds(2.0)
    partials = ((880, 1.0, 0.9), (1320, 0.5, 0.6), (1760, 0.3, 0.4), (2640, 0.15, 0.25))
    out = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t / d) for f, a, d in partials)
    return out * np.minimum(1, t / 0.004) * 0.45


def subdrop() -> np.ndarray:
    t = seconds(1.8)
    freq = 30 + 70 * np.exp(-t / 0.35)
    return np.tanh(2.2 * np.sin(2 * np.pi * np.cumsum(freq) / SR)) * np.exp(-t / 0.7) * np.minimum(1, t / 0.005)


def glitch() -> np.ndarray:
    """Stuttered, bit-crushed noise and a square blip: 8 short slices."""
    out = []
    for i in range(8):
        n = int(SR * 0.018)
        tt = np.arange(n) / SR
        f = [220, 880, 440, 1760, 330, 1320, 660, 2640][i]
        sq = np.sign(np.sin(2 * np.pi * f * tt)) * 0.4 + noise(n / SR) * 0.3
        out.append(np.round(sq * 6) / 6 * (0.9 - i * 0.08))
        out.append(np.zeros(int(SR * 0.006)))
    return highpass(np.concatenate(out), 200)


def whip() -> np.ndarray:
    return whoosh(0.28) * 1.2


def tick() -> np.ndarray:
    t = seconds(0.05)
    return (highpass(noise(0.05), 4000) * np.exp(-t / 0.002) + np.sin(2 * np.pi * 2200 * t) * np.exp(-t / 0.006) * 0.4) * 0.6


SOUNDS = {
    "click": click, "whoosh": whoosh, "pop": pop, "riser": riser, "impact": impact, "chime": chime,
    "subdrop": subdrop, "glitch": glitch, "whip": whip, "tick": tick,
}

if __name__ == "__main__":
    out_dir = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).parents[1] / "public" / "audio")
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, make in SOUNDS.items():
        sound = make()
        sound = sound / np.max(np.abs(sound)) * 10 ** (-1 / 20)
        sf.write(out_dir / f"{name}.wav", np.stack([sound, sound], axis=1), SR, subtype="PCM_16")
        print(f"{name}.wav  {len(sound) / SR:.2f}s")
