import type { ReactNode } from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../theme';
import { BEAT, OUTRO_BAR, bars } from '../timeline';

/** Moments (frames from the outro start) where elements land, for the sound effects. */
export const OUTRO_BEATS = {
  logo: 0,
  line: Math.round(BEAT * 2),
  mac: bars(1),
  windows: bars(1) + Math.round(BEAT * 2),
  free: bars(2),
  url: bars(2) + Math.round(BEAT * 2),
  final: bars(28 - OUTRO_BAR),
};

function useLand(at: number, damping = 15) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - at, fps, config: { damping } });
}

const APPLE = (
  <svg width="44" height="44" viewBox="0 0 24 24" fill="#fff">
    <path d="M16.37 12.6c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.76 2.28-1.6 2.78-.41 6.9 1.15 9.16.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.38-3.69zM14.1 5.86c.63-.77 1.06-1.83.94-2.89-.91.04-2.01.61-2.66 1.37-.58.67-1.09 1.75-.96 2.79 1.02.08 2.05-.52 2.68-1.27z" />
  </svg>
);
const WINDOWS = (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="#fff">
    <path d="M3 5.1 10.4 4v7.2H3zM11.3 3.9 21 2.5v8.7h-9.7zM3 12.1h7.4v7.2L3 18.2zM11.3 12.1H21v8.7l-9.7-1.4z" />
  </svg>
);

function PlatformCard({ at, icon, name, detail, badge }: { at: number; icon: ReactNode; name: string; detail: string; badge?: string }) {
  const p = useLand(at, 13);
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 22,
        width: 520,
        padding: '26px 32px',
        borderRadius: 22,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
        border: '1px solid rgba(255,255,255,0.14)',
        boxShadow: '0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)',
        opacity: p,
        transform: `translateY(${(1 - p) * 60}px) rotateX(${(1 - p) * 40}deg)`,
      }}
    >
      <div style={{ width: 76, height: 76, borderRadius: 18, display: 'grid', placeItems: 'center', background: `linear-gradient(180deg, ${COLORS.accent2}, ${COLORS.accent})`, boxShadow: '0 12px 40px rgba(255,61,0,0.45)' }}>
        {icon}
      </div>
      <div>
        <div style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 44, color: COLORS.text, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{name}</div>
        <div style={{ fontFamily: FONTS.body, fontSize: 25, color: COLORS.text2, marginTop: 6 }}>{detail}</div>
      </div>
      {badge && (
        <div style={{ position: 'absolute', top: -16, right: 22, padding: '6px 14px', borderRadius: 999, background: COLORS.accent, fontFamily: FONTS.mono, fontWeight: 500, fontSize: 18, letterSpacing: '0.1em', color: '#fff' }}>
          {badge}
        </div>
      )}
    </div>
  );
}

/** Closing card over the receding app: logo, line, a download card per platform, the site. */
export function Outro() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const logo = useLand(OUTRO_BEATS.logo, 11);
  const line = useLand(OUTRO_BEATS.line);
  const free = useLand(OUTRO_BEATS.free);
  const url = useLand(OUTRO_BEATS.url);
  const final = frame >= OUTRO_BEATS.final ? Math.exp(-(frame - OUTRO_BEATS.final) / 8) : 0;
  const dim = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(frame, [durationInFrames - 30, durationInFrames - 1], [0, 1], { extrapolateLeft: 'clamp' });

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 65% 60% at 50% 50%, rgba(10,10,11,0.86) 0%, rgba(10,10,11,0.6) 100%)', opacity: dim }} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', perspective: 1200, transform: `scale(${1 + final * 0.03})` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, opacity: Math.min(1, logo * 2), transform: `scale(${1.6 - 0.6 * logo})` }}>
          <Img src={staticFile('app-icon.png')} style={{ width: 132, height: 132 }} />
          <div style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 116, letterSpacing: '-0.04em', color: COLORS.text, lineHeight: 1 }}>
            no<span style={{ color: COLORS.accent }}>Cap</span>
          </div>
        </div>
        <div style={{ marginTop: 22, fontFamily: FONTS.body, fontSize: 38, color: COLORS.text2, opacity: line, transform: `translateY(${(1 - line) * 20}px)` }}>
          See how a rapper rides the beat.
        </div>
        <div style={{ display: 'flex', gap: 32, marginTop: 64 }}>
          <PlatformCard at={OUTRO_BEATS.mac} icon={APPLE} name="macOS" detail="Apple Silicon · M1 or later" />
          <PlatformCard at={OUTRO_BEATS.windows} icon={WINDOWS} name="Windows" detail="Windows 10 & 11 · 64-bit" badge="NEW" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginTop: 52 }}>
          <div style={{ padding: '10px 22px', borderRadius: 999, border: `1px solid ${COLORS.accent}`, color: COLORS.accent, fontFamily: FONTS.mono, fontWeight: 500, fontSize: 24, letterSpacing: '0.08em', opacity: free, transform: `scale(${0.8 + 0.2 * free})` }}>
            FREE & OPEN SOURCE
          </div>
          <div style={{ fontFamily: FONTS.mono, fontWeight: 500, fontSize: 30, color: COLORS.text, opacity: url, transform: `translateX(${(1 - url) * -20}px)` }}>
            fatihserhatturan.github.io/noCap
          </div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 50%, rgba(255,120,60,0.5), transparent 60%)', opacity: final * 0.6, mixBlendMode: 'screen' }} />
      <AbsoluteFill style={{ background: '#000', opacity: fadeOut }} />
    </AbsoluteFill>
  );
}
