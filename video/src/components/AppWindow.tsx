import { AbsoluteFill, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { shotAt, transformFor } from '../camera';
import { COLORS } from '../theme';
import { FPS, OUTRO_START, SCENES, SOURCE, bars, footage } from '../timeline';
import marks from '../marks.json';
import { Highlights } from './Highlight';

const CLIP = staticFile('clips/walkthrough.mp4');

/** The recorded app in a window, filmed by the camera. Each scene plays its own
 *  stretch of the one continuous recording, sped up to fit its bars. */
export function AppWindow() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = bars(SCENES[0].startBar);

  // Window flies in on the first downbeat, and recedes behind the closing card.
  const enter = spring({ frame: frame - start, fps, config: { damping: 18, mass: 0.8 } });
  const leave = interpolate(frame, [OUTRO_START + 8, OUTRO_START + 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const scale = (0.86 + 0.14 * enter) * (1 - 0.12 * leave);
  const lift = (1 - enter) * 120;

  return (
    <AbsoluteFill
      style={{
        opacity: Math.min(1, enter * 1.4) * (1 - 0.75 * leave),
        filter: `blur(${leave * 10}px)`,
        transform: `translateY(${lift}px) scale(${scale})`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: SOURCE.width,
          height: SOURCE.height,
          transformOrigin: '0 0',
          transform: transformFor(shotAt(frame)),
          borderRadius: 14,
          overflow: 'hidden',
          background: COLORS.bg,
          boxShadow: '0 0 0 1px rgba(255,255,255,0.10), 0 40px 120px rgba(0,0,0,0.7), 0 0 160px rgba(255,61,0,0.12)',
        }}
      >
        {SCENES.map((scene) => {
          const { from, rate } = footage(scene);
          return (
            <Sequence key={scene.id} from={bars(scene.startBar)} durationInFrames={bars(scene.bars)} layout="none">
              <OffthreadVideo
                src={CLIP}
                muted
                trimBefore={Math.round(from * FPS)}
                playbackRate={rate}
                style={{ position: 'absolute', inset: 0, width: SOURCE.width, height: SOURCE.height }}
              />
            </Sequence>
          );
        })}
        {/* After the last scene, hold the final shot under the closing card. */}
        <Sequence from={OUTRO_START} layout="none">
          <OffthreadVideo
            src={CLIP}
            muted
            trimBefore={Math.round((marks.duration - 0.45) * FPS)}
            playbackRate={0.04}
            style={{ position: 'absolute', inset: 0, width: SOURCE.width, height: SOURCE.height }}
          />
        </Sequence>
        <Highlights />
      </div>
    </AbsoluteFill>
  );
}
