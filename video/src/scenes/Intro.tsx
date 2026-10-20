import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../theme';
import { BEAT, bars } from '../timeline';

export const INTRO_HIT = 6; // frame the icon lands on (impact sound)
const WORDMARK_AT = 24;
const TAGLINE_AT = 54;
const TAGLINE = 'See how a rapper rides the beat.';
const BLOCKS = [COLORS.pink, COLORS.text2, COLORS.pink, COLORS.blue, COLORS.text2, COLORS.yellow, COLORS.green, COLORS.pink];

/** Logo hit, wordmark, tagline and a row of syllable blocks ticking in on the beat. */
export function Intro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const end = bars(2);
  const icon = spring({ frame: frame - INTRO_HIT, fps, config: { damping: 11, mass: 0.7 } });
  const ring = interpolate(frame, [INTRO_HIT, INTRO_HIT + 24], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const pulse = frame > INTRO_HIT ? Math.exp(-((frame % BEAT) / BEAT) * 3) : 0;
  const exit = interpolate(frame, [bars(1.75), end], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: 1 - exit, transform: `scale(${1 + exit * 0.18})` }}>
      <div style={{ position: 'relative', width: 230, height: 230, marginBottom: 34 }}>
        <div
          style={{
            position: 'absolute',
            inset: -40,
            borderRadius: '50%',
            border: `2px solid ${COLORS.accent}`,
            transform: `scale(${0.6 + ring * 1.4})`,
            opacity: (1 - ring) * 0.8,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: -60,
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(255,61,0,${0.35 + pulse * 0.25}) 0%, transparent 65%)`,
            opacity: icon,
          }}
        />
        <Img src={staticFile('app-icon.png')} style={{ position: 'absolute', inset: 0, width: 230, height: 230, transform: `scale(${icon})` }} />
      </div>
      <div style={{ display: 'flex', fontFamily: FONTS.display, fontWeight: 700, fontSize: 132, letterSpacing: '-0.04em', color: COLORS.text, lineHeight: 1 }}>
        {'noCap'.split('').map((ch, i) => {
          const p = spring({ frame: frame - WORDMARK_AT - i * 3, fps, config: { damping: 14 } });
          return (
            <span key={i} style={{ display: 'inline-block', opacity: p, transform: `translateY(${(1 - p) * 40}px)`, color: i >= 2 ? COLORS.accent : COLORS.text }}>
              {ch}
            </span>
          );
        })}
      </div>
      <div style={{ marginTop: 26, fontFamily: FONTS.body, fontWeight: 400, fontSize: 40, color: COLORS.text2 }}>
        {TAGLINE.split(' ').map((word, i) => {
          const p = spring({ frame: frame - TAGLINE_AT - i * 2, fps, config: { damping: 18 } });
          return (
            <span key={i} style={{ display: 'inline-block', marginRight: '0.28em', opacity: p, transform: `translateY(${(1 - p) * 16}px)` }}>
              {word}
            </span>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 44, height: 18 }}>
        {BLOCKS.map((color, i) => {
          const at = bars(1) + i * (BEAT / 2);
          const p = spring({ frame: frame - at, fps, config: { damping: 12, mass: 0.5 } });
          return <div key={i} style={{ width: 36 + (i % 3) * 14, height: 18, borderRadius: 5, background: color, opacity: p, transform: `scaleX(${p})` }} />;
        })}
      </div>
    </AbsoluteFill>
  );
}
