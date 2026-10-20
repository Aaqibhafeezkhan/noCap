import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../theme';

type Props = { index: number; kicker: string; text: string; length: number };

/** Lower-third caption: a numbered kicker, then the line rising word by word.
 *  Rendered inside a Sequence, so frame 0 is the scene's first frame. */
export function Caption({ index, kicker, text, length }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = interpolate(frame, [length - 8, length - 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.cubic),
  });
  const bar = spring({ frame: frame - 2, fps, config: { damping: 20 } });
  const words = text.split(' ');

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill
        style={{
          background: 'linear-gradient(to top, rgba(6,6,8,0.92) 0%, rgba(6,6,8,0.7) 22%, rgba(6,6,8,0) 42%)',
          opacity: interpolate(frame, [0, 6], [0, 1], { extrapolateRight: 'clamp' }) * (1 - out),
        }}
      />
      <div style={{ position: 'absolute', left: 120, bottom: 92, opacity: 1 - out, transform: `translateY(${out * 24}px)` }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            fontFamily: FONTS.mono,
            fontWeight: 500,
            fontSize: 22,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: COLORS.accent,
            marginBottom: 18,
          }}
        >
          <span style={{ color: COLORS.text2 }}>{String(index).padStart(2, '0')}</span>
          <span style={{ width: 48 * bar, height: 2, background: COLORS.accent, display: 'inline-block' }} />
          <span style={{ opacity: bar, transform: `translateX(${(1 - bar) * -12}px)` }}>{kicker}</span>
        </div>
        <div style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 64, lineHeight: 1.1, color: COLORS.text, letterSpacing: '-0.02em' }}>
          {words.map((word, i) => {
            const rise = spring({ frame: frame - 4 - i * 2, fps, config: { damping: 16, mass: 0.6 } });
            return (
              <span key={i} style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom', paddingBottom: 14, marginBottom: -14, marginRight: '0.26em' }}>
                <span style={{ display: 'inline-block', transform: `translateY(${(1 - rise) * 110}%)` }}>{word}</span>
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}
