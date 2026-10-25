"""One bar of each part of the trap beat (F minor, 140 BPM, straight 16ths)."""

from __future__ import annotations

import numpy as np

from drums import clap, eight08, hat, hat_roll, kick, rim
from synth import BAR, BEAT, RNG, bell, pad, place

CHORDS = [  # (808 root, pad chord): Fm, Db, Ab, Eb
    (29, [53, 56, 60]),
    (25, [49, 53, 56]),
    (32, [56, 60, 63]),
    (27, [51, 55, 58]),
]
MELODY = [  # (16th step, note) per bar of the four-bar loop
    [(0, 84), (3, 80), (6, 77), (10, 79), (12, 80)],
    [(0, 85), (3, 80), (6, 77), (10, 80), (12, 77)],
    [(0, 84), (3, 80), (6, 75), (10, 77), (12, 80)],
    [(0, 82), (3, 79), (6, 75), (8, 79), (10, 82), (14, 79)],
]
EIGHT08 = [(0, 6), (7, 3), (10, 6)]  # (step, length in steps)
STEP = BEAT / 4


def step_time(bar: int, step: float) -> float:
    return bar * BAR + step * STEP


def human() -> float:
    return float(RNG.uniform(-0.004, 0.004))


def melody(bus: np.ndarray, bar: int, gain: float = 1.0) -> None:
    notes = MELODY[bar % 4]
    for i, (step, midi) in enumerate(notes):
        end = notes[i + 1][0] if i + 1 < len(notes) else 16
        place(bus, bell(midi, (end - step) * STEP + 0.25), step_time(bar, step), 0.55 * gain, pan=0.15 if i % 2 else -0.15)


def chords(bus: np.ndarray, bar: int, gain: float = 1.0) -> None:
    place(bus, pad(CHORDS[bar % 4][1], 16 * STEP + 0.3), step_time(bar, 0), gain)


def bass_808(bus: np.ndarray, bar: int, *, sustain: bool = False) -> None:
    root = CHORDS[bar % 4][0]
    next_root = CHORDS[(bar + 1) % 4][0]
    if sustain:  # breakdown: one long note per bar
        place(bus, eight08(root, 16 * STEP), step_time(bar, 0), 0.9)
        return
    for step, length in EIGHT08:
        glide = bar % 4 == 3 and step == 10
        note = eight08(root + (12 if glide else 0), length * STEP, glide_to=next_root + 12 if glide else None)
        place(bus, note, step_time(bar, step), 0.95)


def drums(bus: np.ndarray, bar: int, kicks: list[float], claps: list[float], *, half: bool = False) -> None:
    """Kick under every 808 start, clap on beat 3, hats with a different roll each bar."""
    if not half:
        for step, _ in EIGHT08:
            at = step_time(bar, step)
            place(bus, kick(), at, 0.9)
            kicks.append(at)
    at = step_time(bar, 8)
    place(bus, clap(), at, 0.85, pan=0.03)
    claps.append(at)
    if bar % 2 == 1 and not half:
        place(bus, rim(), step_time(bar, 14) + human(), 0.35, pan=0.4)
    hats(bus, bar, half=half)


def hats(bus: np.ndarray, bar: int, *, half: bool = False) -> None:
    variant = bar % 4
    roll_from = {1: 3.0, 2: 3.5, 3: 2.0}.get(variant, 4.0) if not half else 4.0
    for s in range(0, 16, 4 if half else 2):
        if s / 4 >= roll_from:
            break
        place(bus, hat(), step_time(bar, s) + human(), 0.5 if s % 4 == 0 else 0.34, pan=-0.3)
    if half or variant == 0:
        return
    rolls = {
        1: hat_roll(3, 1.0, 0.25, 0.5),  # triplets on beat 4
        2: hat_roll(8, 0.5, 0.18, 0.55),  # 1/32 on the last half beat
        3: hat_roll(4, 1.0, 0.3, 0.45) + [(1 + o, g) for o, g in hat_roll(8, 1.0, 0.2, 0.6)],
    }[variant]
    for offset, gain in rolls:
        place(bus, hat(), step_time(bar, 0) + (roll_from + offset) * BEAT + human(), gain, pan=-0.3)
    if variant == 3:
        place(bus, hat(open_=True), step_time(bar, 14), 0.3, pan=0.3)
