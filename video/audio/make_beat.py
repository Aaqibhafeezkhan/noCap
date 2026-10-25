"""Writes the promo's soundtrack: a 30-bar trap beat at 140 BPM in F minor, and
`src/beatmap.json` with every kick, clap and section start so the edit can hit them.

Bars 0–3   hook: the bell melody muffled, opening up; hats creep in; a gap before the drop
Bar  4     drop (crash), full beat under the feature scenes
Bars 18–21 Lyrics: breakdown (long 808s, half-time hats), then a clap roll back in
Bar  22    second drop: Report and the outro
Bar  28    last hit; the bell rings out

Cuts in the edit land on bar lines, so `src/timeline.ts` uses the same BPM and bars.

usage: python video/audio/make_beat.py [out.wav]
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

from drums import clap, crash, eight08, hat, kick, reverse_crash
from patterns import CHORDS, STEP, bass_808, chords, drums, melody, step_time
from synth import BAR, BEAT, BPM, SR, duck, master, place, reverb, sweep_lowpass

BARS = 30
TAIL = 2.4
DROPS = (4, 22)
BREAKDOWN = range(18, 22)
GAPS = ((3, 3.5), (21, 3.5))  # (bar, beat): silence from here to the next downbeat


def build() -> tuple[np.ndarray, dict]:
    total = BARS * BAR + TAIL
    n = int(total * SR)
    drum_bus, bass_bus, lead_bus, fx_bus = (np.zeros((n, 2)) for _ in range(4))
    kicks: list[float] = []
    claps: list[float] = []

    for bar in range(BARS - 2):
        melody(lead_bus, bar, gain=0.75 if bar in BREAKDOWN else 1.0)
        chords(lead_bus, bar, gain=1.4 if bar in BREAKDOWN else 1.0)
        if bar < 4:
            if bar >= 2:
                for s in range(0, 16, 2 if bar == 2 else 1):
                    place(drum_bus, hat(), step_time(bar, s), 0.12 + 0.025 * s, pan=-0.3)
            continue
        half = bar in BREAKDOWN and bar < 20
        drums(drum_bus, bar, kicks, claps, half=half)
        bass_808(bass_bus, bar, sustain=bar in BREAKDOWN and bar < 21)
    clap_roll(drum_bus, 21, claps)

    for bar in (*DROPS, 10, 14, 18, 24):
        place(fx_bus, crash(), step_time(bar, 0), 0.75 if bar in DROPS else 0.45, pan=0.3)
    for bar in DROPS:
        rc = reverse_crash(BAR)
        place(fx_bus, rc, step_time(bar, 0) - len(rc) / SR, 0.8, pan=-0.2)
    finale(drum_bus, bass_bus, lead_bus, fx_bus, kicks)

    # Hook: the lead opens up from muffled to bright over the first four bars.
    hook = int(4 * BAR * SR)
    lead_bus[:hook] = sweep_lowpass(lead_bus[:hook], 500, 9000) * 1.8
    lead_bus = duck(reverb(lead_bus, mix=0.3), kicks, depth=0.45)
    bass_bus = duck(bass_bus, claps, depth=0.2, release=0.1)

    music = drum_bus + bass_bus * 0.55 + lead_bus * 1.35
    for bar, beat in GAPS:
        a, b = int((bar * BAR + beat * BEAT) * SR), int((bar + 1) * BAR * SR)
        fade_out = int(0.01 * SR)
        music[a : a + fade_out] *= np.linspace(1, 0, fade_out)[:, None]
        music[a + fade_out : b] = 0.0
    mix = music + fx_bus
    fade = np.clip((total - np.arange(n) / SR) / 2.0, 0, 1)[:, None]
    beatmap = {
        "bpm": BPM,
        "bars": BARS,
        "kicks": sorted(round(k, 4) for k in kicks),
        "claps": sorted(round(c, 4) for c in claps),
        "drops": [round(d * BAR, 4) for d in DROPS],
        "gaps": [round(b * BAR + beat * BEAT, 4) for b, beat in GAPS],
    }
    return master(mix * fade, peak_db=-1.0, drive=1.6), beatmap


def clap_roll(bus: np.ndarray, bar: int, claps: list[float]) -> None:
    """Build back in: claps in 8ths, then 16ths, then 32nds, rising in level."""
    times = [i * 2 * STEP for i in range(4)] + [8 * STEP + i * STEP for i in range(4)] + [12 * STEP + i * STEP / 2 for i in range(4)]
    for i, offset in enumerate(times):
        at = step_time(bar, 0) + offset
        place(bus, clap(), at, 0.35 + 0.04 * i, pan=0.05)
        claps.append(at)


def finale(drum_bus: np.ndarray, bass_bus: np.ndarray, lead_bus: np.ndarray, fx_bus: np.ndarray, kicks: list[float]) -> None:
    """Bar 28: one last hit, a long 808 sliding down, the bell ringing out."""
    at = step_time(28, 0)
    place(drum_bus, kick(), at, 1.0)
    kicks.append(at)
    place(drum_bus, clap(), at, 0.6)
    place(fx_bus, crash(), at, 0.9, pan=0.3)
    root = CHORDS[0][0]
    place(bass_bus, eight08(root + 12, 2 * BAR, glide_to=root, glide_at=0.35, decay=0.9), at, 0.95)
    melody(lead_bus, 28, gain=0.9)
    chords(lead_bus, 28, gain=1.2)


if __name__ == "__main__":
    root = Path(__file__).parents[1]
    out = Path(sys.argv[1] if len(sys.argv) > 1 else root / "public" / "audio" / "beat.wav")
    out.parent.mkdir(parents=True, exist_ok=True)
    audio, beatmap = build()
    sf.write(out, audio, SR, subtype="PCM_16")
    (root / "src" / "beatmap.json").write_text(json.dumps(beatmap, indent=1) + "\n")
    rms = 20 * np.log10(np.sqrt(np.mean(audio**2)))
    print(f"{out}: {len(audio) / SR:.2f}s, peak {20 * np.log10(np.max(np.abs(audio))):.1f} dBFS, rms {rms:.1f} dBFS")
