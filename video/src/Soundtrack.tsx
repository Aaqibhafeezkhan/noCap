import { Audio, Sequence, staticFile } from 'remotion';
import { WHOOSHES } from './camera';
import { HIGHLIGHT_BARS } from './components/Highlight';
import marks from './marks.json';
import { INTRO_HIT } from './scenes/Intro';
import { OUTRO_BEATS } from './scenes/Outro';
import { FPS, OUTRO_START, SCENES, bars, editFrame } from './timeline';

type Hit = { at: number; sound: 'click' | 'whoosh' | 'pop' | 'riser' | 'impact' | 'chime'; volume: number };

const RISER_SECONDS = 2.6;

/** Every sound effect with the frame it starts on. */
function hits(): Hit[] {
  const list: Hit[] = [
    { at: INTRO_HIT, sound: 'impact', volume: 0.8 },
    { at: bars(2) - Math.round(RISER_SECONDS * FPS), sound: 'riser', volume: 0.45 },
    { at: OUTRO_START + OUTRO_BEATS.logo, sound: 'chime', volume: 0.5 },
  ];
  for (const bar of WHOOSHES) list.push({ at: bars(bar) - 4, sound: 'whoosh', volume: 0.42 });
  for (const scene of SCENES) list.push({ at: bars(scene.startBar) + 6, sound: 'pop', volume: 0.3 });
  for (const bar of HIGHLIGHT_BARS) list.push({ at: bars(bar), sound: 'pop', volume: 0.4 });
  for (const t of marks.clicks) {
    const at = editFrame(t);
    if (at !== null) list.push({ at, sound: 'click', volume: 0.7 });
  }
  for (const key of ['button', 'url'] as const) list.push({ at: OUTRO_START + OUTRO_BEATS[key], sound: 'pop', volume: 0.32 });
  return list.filter((h) => h.at >= 0);
}

export function Soundtrack() {
  return (
    <>
      <Audio src={staticFile('audio/beat.wav')} volume={0.62} />
      {hits().map((hit, i) => (
        <Sequence key={i} from={hit.at} layout="none">
          <Audio src={staticFile(`audio/${hit.sound}.wav`)} volume={hit.volume} />
        </Sequence>
      ))}
    </>
  );
}
