import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../theme';

/** Moments (frames from the outro start) where elements land, for the sound effects. */
export const OUTRO_BEATS = { logo: 12, line: 26, button: 40, url: 52 };

function useLand(at: number) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - at, fps, config: { damping: 15 } });
}

function DownloadButton() {
  const p = useLand(OUTRO_BEATS.button);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '22px 40px',
        borderRadius: 999,
        background: `linear-gradient(180deg, ${COLORS.accent2}, ${COLORS.accent})`,
        boxShadow: '0 18px 60px rgba(255,61,0,0.45), inset 0 1px 0 rgba(255,255,255,0.3)',
        fontFamily: FONTS.body,
        fontWeight: 600,
        fontSize: 34,
        color: '#fff',
        opacity: p,
        transform: `translateY(${(1 - p) * 30}px) scale(${0.9 + 0.1 * p})`,
      }}
    >
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v12M6 10l6 6 6-6M4 21h16" />
      </svg>
      Download for macOS
    </div>
  );
}

/** Closing card over the receding app: logo, line, download button and the site. */
export function Outro() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const logo = useLand(OUTRO_BEATS.logo);
  const line = useLand(OUTRO_BEATS.line);
  const url = useLand(OUTRO_BEATS.url);
  const dim = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(frame, [durationInFrames - 24, durationInFrames - 1], [0, 1], { extrapolateLeft: 'clamp' });

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 60% 55% at 50% 50%, rgba(10,10,11,0.82) 0%, rgba(10,10,11,0.55) 100%)', opacity: dim }} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 30, opacity: logo, transform: `scale(${0.8 + 0.2 * logo})` }}>
          <Img src={staticFile('app-icon.png')} style={{ width: 150, height: 150 }} />
          <div style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 120, letterSpacing: '-0.04em', color: COLORS.text, lineHeight: 1 }}>
            no<span style={{ color: COLORS.accent }}>Cap</span>
          </div>
        </div>
        <div
          style={{
            marginTop: 30,
            fontFamily: FONTS.body,
            fontSize: 40,
            color: COLORS.text2,
            opacity: line,
            transform: `translateY(${(1 - line) * 20}px)`,
          }}
        >
          Free & open source · macOS on Apple Silicon
        </div>
        <div style={{ marginTop: 58 }}>
          <DownloadButton />
        </div>
        <div
          style={{
            marginTop: 34,
            fontFamily: FONTS.mono,
            fontWeight: 500,
            fontSize: 30,
            color: COLORS.text,
            letterSpacing: '0.02em',
            opacity: url,
            transform: `translateY(${(1 - url) * 14}px)`,
          }}
        >
          fatihserhatturan.github.io/noCap
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: '#000', opacity: fadeOut }} />
    </AbsoluteFill>
  );
}
