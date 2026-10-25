import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from 'remotion';
import { DROPS, GAPS } from './beat';
import { AppWindow } from './components/AppWindow';
import { Background } from './components/Background';
import { Caption } from './components/Caption';
import { Flash, Grain, LightLeaks, Vignette } from './components/Fx';
import { Hook } from './scenes/Hook';
import { Outro } from './scenes/Outro';
import { Soundtrack } from './Soundtrack';
import { DURATION, HOOK_BARS, OUTRO_BAR, OUTRO_START, SCENES, bars } from './timeline';

/** The beat drops out for half a beat before each drop: the picture goes dark with it. */
function Blackouts() {
  const frame = useCurrentFrame();
  const dark = GAPS.reduce((most, gap, i) => {
    const end = i === 0 ? bars(HOOK_BARS) : DROPS[1];
    const depth = i === 0 ? 1 : 0.85;
    return Math.max(most, interpolate(frame, [gap - 1, gap, end - 1, end], [0, depth, depth, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  }, 0);
  return <AbsoluteFill style={{ background: '#000', opacity: dark, pointerEvents: 'none' }} />;
}

export function Promo() {
  return (
    <AbsoluteFill>
      <Background />
      <Sequence durationInFrames={bars(HOOK_BARS)}>
        <Hook gap={GAPS[0]} />
      </Sequence>
      {/* Uses absolute frames: the camera and footage are timed from the start of the video. */}
      <AppWindow />
      {SCENES.map((scene, i) => (
        <Sequence key={scene.id} from={bars(scene.startBar)} durationInFrames={bars(scene.startBar + scene.bars) - bars(scene.startBar)}>
          <Caption index={i + 1} kicker={scene.kicker} text={scene.caption} length={bars(scene.startBar + scene.bars) - bars(scene.startBar)} />
        </Sequence>
      ))}
      <LightLeaks atBars={[...SCENES.map((s) => s.startBar), OUTRO_BAR, 28]} />
      {[...DROPS, bars(28)].map((at) => (
        <Sequence key={at} from={at} durationInFrames={16}>
          <Flash />
        </Sequence>
      ))}
      <Sequence from={OUTRO_START} durationInFrames={DURATION - OUTRO_START}>
        <Outro />
      </Sequence>
      <Blackouts />
      <Vignette />
      <Grain />
      <Soundtrack />
    </AbsoluteFill>
  );
}
