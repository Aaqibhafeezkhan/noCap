import { Audio, Sequence, staticFile } from 'remotion';
import { DROPS, GAPS } from './beat';
import { WHIPS } from './camera';
import { HIGHLIGHT_BARS } from './components/Highlight';
import marks from './marks.json';
import { LOGO_FRAME, WORD_FRAMES } from './scenes/Hook';
import { OUTRO_BEATS } from './scenes/Outro';
import { FPS, OUTRO_START, SCENES, bars, editFrame } from './timeline';

type Sound = 'click' | 'whoosh' | 'pop' | 'riser' | 'impact' | 'chime' | 'subdrop' | 'glitch' | 'whip' | 'tick';
type Hit = { at: number; sound: Sound; volume: number };

const RISER_SECONDS = 3.4;

/** Every sound effect with the frame it starts on. */
function hits(): Hit[] {
  const list: Hit[] = [
    { at: LOGO_FRAME, sound: 'impact', volume: 0.45 },
    { at: OUTRO_START + OUTRO_BEATS.logo, sound: 'chime', volume: 0.45 },
    { at: OUTRO_START + OUTRO_BEATS.final, sound: 'subdrop', volume: 0.3 },
  ];
  for (const at of WORD_FRAMES) list.push({ at, sound: 'tick', volume: 0.3 });
  for (const gap of GAPS) list.push({ at: gap - Math.round(RISER_SECONDS * FPS), sound: 'riser', volume: 0.35 });
  for (const at of DROPS) {
    list.push({ at, sound: 'subdrop', volume: 0.3 });
    list.push({ at, sound: 'glitch', volume: 0.3 });
  }
  for (const bar of WHIPS) list.push({ at: bars(bar) - 4, sound: 'whip', volume: 0.38 });
  for (const scene of SCENES) list.push({ at: bars(scene.startBar) + 4, sound: 'pop', volume: 0.2 });
  for (const bar of HIGHLIGHT_BARS) list.push({ at: bars(bar), sound: 'pop', volume: 0.35 });
  for (const t of marks.clicks) {
    const at = editFrame(t);
    if (at !== null) list.push({ at, sound: 'click', volume: 0.45 });
  }
  for (const key of ['mac', 'windows', 'free', 'url'] as const) list.push({ at: OUTRO_START + OUTRO_BEATS[key], sound: 'pop', volume: 0.3 });
  return list.filter((h) => h.at >= 0);
}

export function Soundtrack() {
  return (
    <>
      <Audio src={staticFile('audio/beat.wav')} volume={0.6} />
      {hits().map((hit, i) => (
        <Sequence key={i} from={hit.at} layout="none">
          <Audio src={staticFile(`audio/${hit.sound}.wav`)} volume={hit.volume} />
        </Sequence>
      ))}
    </>
  );
}
