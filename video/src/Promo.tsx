import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from 'remotion';
import { AppWindow } from './components/AppWindow';
import { Background } from './components/Background';
import { Caption } from './components/Caption';
import { Intro } from './scenes/Intro';
import { Outro } from './scenes/Outro';
import { Soundtrack } from './Soundtrack';
import { DURATION, INTRO_BARS, OUTRO_START, SCENES, bars } from './timeline';

/** Flash of light when the app first appears on the downbeat. */
function RevealFlash() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 2, 14], [0, 0.55, 0], { extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 45%, #fff 0%, rgba(255,61,0,0.6) 40%, transparent 75%)', opacity }} />;
}

export function Promo() {
  return (
    <AbsoluteFill>
      <Background />
      <Sequence durationInFrames={bars(INTRO_BARS)}>
        <Intro />
      </Sequence>
      {/* Uses absolute frames: the camera and footage are timed from the start of the video. */}
      <AppWindow />
      {SCENES.map((scene, i) => (
        <Sequence key={scene.id} from={bars(scene.startBar)} durationInFrames={bars(scene.bars)}>
          <Caption index={i + 1} kicker={scene.kicker} text={scene.caption} length={bars(scene.bars)} />
        </Sequence>
      ))}
      <Sequence from={bars(INTRO_BARS)} durationInFrames={16}>
        <RevealFlash />
      </Sequence>
      <Sequence from={OUTRO_START} durationInFrames={DURATION - OUTRO_START}>
        <Outro />
      </Sequence>
      <Soundtrack />
    </AbsoluteFill>
  );
}
