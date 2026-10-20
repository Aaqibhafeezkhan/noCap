"""Writes the promo's soundtrack: a 17-bar boom-bap beat at 92 BPM (the demo verse's tempo).

Bars 0–1 intro (filtered keys, building hats), bars 2–13 the groove under the feature
scenes, bars 14–16 the outro (crash, then keys ringing out). Cuts in the edit land on
bar lines, so the timing here must match `src/timeline.ts`.

usage: python video/audio/make_beat.py [out.wav]
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import soundfile as sf

from synth import BAR, BEAT, RNG, SR, bandpass, bass, crash, hat, keys, kick, lowpass, master, place, snare

BARS = 17
TAIL = 1.2
SWING = 0.58  # share of an 8th note given to the first 16th
CHORDS = [  # (bass root, chord) — Am7, Fmaj7, C, G
    (33, [57, 60, 64, 67]),
    (29, [53, 57, 60, 64]),
    (36, [55, 60, 64, 67]),
    (31, [55, 59, 62, 67]),
]
KICKS = (0, 7, 10)
SNARES = (4, 12)


def step_time(bar: int, step: int) -> float:
    eighth, sixteenth = divmod(step, 2)
    return bar * BAR + eighth * BEAT / 2 + sixteenth * BEAT * SWING


def drums(track: np.ndarray, bar: int, *, fill: bool = False) -> None:
    for s in KICKS:
        place(track, kick(), step_time(bar, s), 0.9 if s == 0 else 0.75)
    for s in SNARES:
        place(track, snare(), step_time(bar, s), 0.8, pan=0.05)
    for s in range(16):
        if fill and s >= 13:
            place(track, snare(), step_time(bar, s), 0.35 + 0.1 * (s - 13), pan=0.1)
            continue
        if s == 14 and bar % 4 == 3:
            place(track, hat(open_=True), step_time(bar, s), 0.45, pan=-0.25)
        elif s % 2 == 0:
            place(track, hat(), step_time(bar, s), 0.55 if s % 4 == 0 else 0.42, pan=-0.25)
        elif bar % 2 == 1:
            place(track, hat(), step_time(bar, s), 0.18, pan=-0.25)


def bassline(track: np.ndarray, bar: int) -> None:
    root, _ = CHORDS[bar % 4]
    for s, length in ((0, BEAT * 1.6), (7, BEAT * 0.7), (10, BEAT * 1.4)):
        place(track, bass(root + (12 if s == 7 else 0), length), step_time(bar, s), 0.8)


def chords(track: np.ndarray, bar: int) -> None:
    _, notes = CHORDS[bar % 4]
    place(track, keys(notes, BEAT * 2.2), step_time(bar, 0), 1.0, pan=0.2)
    place(track, keys(notes[1:], BEAT * 0.9), step_time(bar, 11), 0.7, pan=0.2)


def crackle(length: float) -> np.ndarray:
    n = int(length * SR)
    pops = np.zeros(n)
    idx = RNG.integers(0, n, int(length * 14))
    pops[idx] = RNG.uniform(-1, 1, len(idx))
    hiss = RNG.uniform(-1, 1, n) * 0.04
    return bandpass(pops + hiss, 1200, 8000) * 0.05


def build() -> np.ndarray:
    total = BARS * BAR + TAIL
    n = int(total * SR)
    drum_bus, bass_bus, keys_bus = (np.zeros((n, 2)) for _ in range(3))

    for bar in range(BARS):
        chords(keys_bus, bar)
        if bar == 1:  # intro: hats creep in under the logo
            for s in range(0, 12, 2):
                place(drum_bus, hat(), step_time(bar, s), 0.25 + 0.03 * s, pan=-0.25)
        if 2 <= bar <= 15:
            drums(drum_bus, bar, fill=bar in (13,))
            bassline(bass_bus, bar)
    place(drum_bus, crash(), step_time(2, 0), 0.7, pan=0.3)
    place(drum_bus, crash(), step_time(14, 0), 0.8, pan=0.3)
    place(drum_bus, kick(), step_time(16, 0), 0.9)
    place(bass_bus, bass(CHORDS[0][0], BEAT * 4), step_time(16, 0), 0.8)

    # Intro filter sweep: keys open up over the first two bars.
    intro_end = int(2 * BAR * SR)
    muffled = np.stack([lowpass(keys_bus[:, c], 500) for c in range(2)], axis=1)
    sweep = np.clip(np.arange(n) / intro_end, 0, 1)[:, None] ** 2
    keys_bus = muffled * (1 - sweep) + keys_bus * sweep

    mix = drum_bus + bass_bus * 0.9 + keys_bus * 1.1
    mix += crackle(total)[:, None]
    fade = np.clip((total - np.arange(n) / SR) / 2.5, 0, 1)[:, None]
    return master(mix * fade, peak_db=-1.0)


if __name__ == "__main__":
    out = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).parents[1] / "public" / "audio" / "beat.wav")
    out.parent.mkdir(parents=True, exist_ok=True)
    audio = build()
    sf.write(out, audio, SR, subtype="PCM_16")
    rms = 20 * np.log10(np.sqrt(np.mean(audio**2)))
    print(f"{out}: {len(audio) / SR:.2f}s, peak {20 * np.log10(np.max(np.abs(audio))):.1f} dBFS, rms {rms:.1f} dBFS")
