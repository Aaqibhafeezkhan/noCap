import marks from './marks.json';

/** The edit runs on the beat: 92 BPM, every scene starts on a bar line. Must match
 *  `audio/make_beat.py`. */
export const FPS = 30;
export const BPM = 92;
export const BEAT = (60 / BPM) * FPS;
export const BAR = BEAT * 4;
export const WIDTH = 1920;
export const HEIGHT = 1080;

export const bars = (n: number) => Math.round(n * BAR);

/** Footage size in CSS pixels (recorded at 2x). */
export const SOURCE = { width: 1440, height: 900 };

export type SceneId = 'flow' | 'rhymes' | 'inspect' | 'pocket' | 'zoom' | 'report';

export type Scene = {
  id: SceneId;
  kicker: string;
  caption: string;
  startBar: number;
  bars: number;
};

export const INTRO_BARS = 2;
export const OUTRO_BARS = 3;

export const SCENES: Scene[] = [
  { id: 'flow', kicker: 'Flow map', caption: 'Every syllable, on the beat grid.', startBar: 2, bars: 2 },
  { id: 'rhymes', kicker: 'Rhymes', caption: 'Rhyme groups light up together.', startBar: 4, bars: 2 },
  { id: 'inspect', kicker: 'Inspector', caption: 'Open any bar: metrics, lyrics, similar flow.', startBar: 6, bars: 2 },
  { id: 'pocket', kicker: 'Pocket', caption: 'Ahead of the beat or behind it, to the millisecond.', startBar: 8, bars: 2 },
  { id: 'zoom', kicker: 'Smart zoom', caption: 'From every syllable to the whole verse.', startBar: 10, bars: 2 },
  { id: 'report', kicker: 'Report', caption: 'The whole flow, at a glance.', startBar: 12, bars: 2 },
];

export const OUTRO_START = bars(INTRO_BARS + SCENES.reduce((sum, s) => sum + s.bars, 0));
export const DURATION = OUTRO_START + bars(OUTRO_BARS) + 30;

const ORDER: (SceneId | 'end')[] = ['flow', 'rhymes', 'inspect', 'pocket', 'zoom', 'report', 'end'];

/** Where a scene's footage starts in the recording and how fast it plays so the
 *  recorded segment fills the scene exactly. */
export function footage(scene: Scene) {
  const from = marks.scenes[scene.id];
  const next = marks.scenes[ORDER[ORDER.indexOf(scene.id) + 1]];
  const length = Math.min(next, marks.duration) - from;
  const frames = bars(scene.bars);
  return { from, rate: length / (frames / FPS) };
}

/** Composition frame at which a moment of the recording (in seconds) appears. */
export function editFrame(sourceSeconds: number): number | null {
  for (const scene of SCENES) {
    const { from, rate } = footage(scene);
    const offset = (sourceSeconds - from) / rate;
    if (offset >= 0 && offset < bars(scene.bars) / FPS) return bars(scene.startBar) + Math.round(offset * FPS);
  }
  return null;
}
