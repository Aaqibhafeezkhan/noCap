import beatmap from './beatmap.json';
import marks from './marks.json';

/** The edit runs on the beat: 140 BPM, every scene starts on a bar line. Tempo and
 *  bar count come from `audio/make_beat.py` (via beatmap.json). */
export const FPS = 30;
export const BPM = beatmap.bpm;
export const BEAT = (60 / BPM) * FPS;
export const BAR = BEAT * 4;
export const WIDTH = 1920;
export const HEIGHT = 1080;

export const bars = (n: number) => Math.round(n * BAR);

/** Footage size in CSS pixels (recorded at 2x). */
export const SOURCE = { width: 1440, height: 900 };

type Mark = keyof typeof marks.scenes;

export type Scene = {
  id: string;
  kicker: string;
  caption: string;
  startBar: number;
  bars: number;
  /** The stretch of the recording this scene plays, between two marks. */
  from: Mark;
  to: Mark;
};

export const HOOK_BARS = 4;
export const OUTRO_BAR = 24;

export const SCENES: Scene[] = [
  { id: 'drop', kicker: 'Analyze', caption: 'Drop a track. Watch it listen.', startBar: 4, bars: 3, from: 'drop', to: 'open' },
  { id: 'flow', kicker: 'Flow map', caption: 'Every syllable, on the beat.', startBar: 7, bars: 3, from: 'open', to: 'rhymes' },
  { id: 'rhymes', kicker: 'Rhymes', caption: 'Rhyme groups light up together.', startBar: 10, bars: 2, from: 'rhymes', to: 'pocket' },
  { id: 'pocket', kicker: 'Pocket', caption: 'Ahead of the beat, or behind it.', startBar: 12, bars: 2, from: 'pocket', to: 'inspect' },
  { id: 'inspect', kicker: 'Inspector', caption: 'Open any bar. See why it hits.', startBar: 14, bars: 2, from: 'inspect', to: 'zoom' },
  { id: 'zoom', kicker: 'Smart zoom', caption: 'One syllable, or the whole verse.', startBar: 16, bars: 2, from: 'zoom', to: 'lyrics' },
  { id: 'lyrics', kicker: 'New · Lyrics', caption: 'Read it. Fix it. Export it.', startBar: 18, bars: 4, from: 'lyrics', to: 'report' },
  { id: 'report', kicker: 'Report', caption: 'The whole flow, at a glance.', startBar: 22, bars: 2, from: 'report', to: 'end' },
];

export const OUTRO_START = bars(OUTRO_BAR);
/** All bars of the beat, plus its tail ringing out (TAIL in make_beat.py). */
export const DURATION = Math.round(beatmap.bars * BAR + 2.4 * FPS);

/** Seconds → frames for times from the beatmap. */
export const frameOf = (seconds: number) => Math.round(seconds * FPS);

const RAMP = 0.35;
const LAST = marks.duration - 0.6;

/** Speed ramp: each scene eases out of the cut, rushes through the middle and eases
 *  into the next cut (speed 1 − RAMP at the ends, 1 + RAMP in the middle). */
function ramp(p: number): number {
  return p - (RAMP / (2 * Math.PI)) * Math.sin(2 * Math.PI * p);
}

/** Moment of the recording (seconds) shown at a composition frame. */
export function sourceTime(frame: number): number {
  const scene = SCENES.find((s) => frame >= bars(s.startBar) && frame < bars(s.startBar + s.bars));
  if (!scene) return frame < bars(SCENES[0].startBar) ? marks.scenes.drop : LAST;
  const from = marks.scenes[scene.from];
  const to = Math.min(marks.scenes[scene.to], LAST);
  const p = (frame - bars(scene.startBar)) / (bars(scene.startBar + scene.bars) - bars(scene.startBar));
  return from + (to - from) * ramp(p);
}

/** Composition frame at which a moment of the recording (in seconds) appears. */
export function editFrame(sourceSeconds: number): number | null {
  const first = bars(SCENES[0].startBar);
  const last = bars(OUTRO_BAR);
  for (let frame = first; frame < last; frame++) {
    if (sourceTime(frame) >= sourceSeconds) return frame;
  }
  return null;
}

/** The same, in bars (for camera keys). */
export const barOf = (sourceSeconds: number) => (editFrame(sourceSeconds) ?? 0) / BAR;
