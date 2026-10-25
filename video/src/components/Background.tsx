import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { COLORS } from '../theme';
import { kick } from '../beat';

/** Dark stage with a slow red glow that pumps with the kick, plus a faint grid. */
export function Background() {
  const frame = useCurrentFrame();
  const pulse = kick(frame) * 0.12;
  const drift = Math.sin(frame / 90) * 60;
  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 55% at ${50 + drift / 40}% -8%, rgba(255, 61, 0, ${0.32 + pulse}) 0%, rgba(255, 61, 0, 0.06) 45%, transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 50% 40% at ${85 - drift / 50}% 110%, rgba(255, 79, 154, 0.12) 0%, transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 80% 70% at 50% 40%, black 30%, transparent 80%)',
        }}
      />
    </AbsoluteFill>
  );
}
