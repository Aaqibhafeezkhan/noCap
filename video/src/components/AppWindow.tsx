import { AbsoluteFill, Freeze, interpolate, OffthreadVideo, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { drop, kick, shake } from '../beat';
import { placement, shotAt, velocity } from '../camera';
import { COLORS } from '../theme';
import { FPS, OUTRO_START, SCENES, SOURCE, bars, sourceTime } from '../timeline';
import { FxFilter } from './Fx';
import { Highlights } from './Highlight';

const CLIP = staticFile('clips/walkthrough.mp4');

/** The recorded app in a window, filmed by the camera. The recording is time-remapped
 *  frame by frame (`sourceTime`), which gives every scene its speed ramp. The window
 *  swings in in 3D on the drop, punches on kicks, and gets motion blur and an RGB split
 *  from camera moves and drops. */
export function AppWindow() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = bars(SCENES[0].startBar);

  const enter = spring({ frame: frame - start, fps, config: { damping: 16, mass: 0.9, stiffness: 90 } });
  const leave = interpolate(frame, [OUTRO_START, OUTRO_START + 24], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const tiltX = (1 - enter) * 32 + leave * 24 + Math.sin(frame / 70) * 1.2;
  const tiltY = (1 - enter) * -26 + leave * -10 + Math.sin(frame / 95) * 1.6;
  const depth = (1 - enter) * -700 - leave * 500;
  const punch = 1 + kick(frame) * 0.012 + drop(frame) * 0.04;
  const jolt = shake(frame);

  const v = velocity(frame);
  const blurX = Math.min(14, Math.abs(v.x) * 0.2 + Math.abs(v.zoom) * 60);
  const blurY = Math.min(14, Math.abs(v.y) * 0.2 + Math.abs(v.zoom) * 60);
  const split = drop(frame) * 14 + Math.min(4, Math.hypot(v.x, v.y) * 0.025);
  const filtered = blurX + blurY > 0.6 || split > 0.5;
  const place = placement(shotAt(frame));
  if (frame < start) return null;

  return (
    <AbsoluteFill
      style={{
        perspective: 1600,
        opacity: Math.min(1, enter * 1.6) * (1 - 0.7 * leave),
        filter: leave > 0 ? `blur(${leave * 12}px)` : undefined,
      }}
    >
      {filtered && <FxFilter id="app-fx" blurX={blurX} blurY={blurY} split={split} />}
      <AbsoluteFill
        style={{
          transform: `translate(${jolt.x}px, ${jolt.y}px) translateZ(${depth}px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(${punch})`,
          filter: filtered ? 'url(#app-fx)' : undefined,
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: SOURCE.width,
            height: SOURCE.height,
            transformOrigin: '0 0',
            transform: `translate(${place.x}px, ${place.y}px) scale(${place.scale})`,
            borderRadius: 14,
            overflow: 'hidden',
            background: COLORS.bg,
            boxShadow: '0 0 0 1px rgba(255,255,255,0.10), 0 50px 140px rgba(0,0,0,0.75), 0 0 180px rgba(255,61,0,0.16)',
          }}
        >
          <Freeze frame={Math.round(sourceTime(frame) * FPS)}>
            <OffthreadVideo src={CLIP} muted style={{ position: 'absolute', inset: 0, width: SOURCE.width, height: SOURCE.height }} />
          </Freeze>
          <Highlights />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
