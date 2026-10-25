import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../theme';
import { BEAT, bars } from '../timeline';

type Line = { beat: number; words: string[]; accent: string[] };

/** The opening question, one line per bar, every word on an eighth note. */
const LINES: Line[] = [
  { beat: 0, words: ['Flow', 'is', 'the', 'hardest', 'part'], accent: ['Flow'] },
  { beat: 4, words: ['of', 'rap', 'to', 'explain.'], accent: [] },
  { beat: 8, words: ['So', 'we', 'put', 'it', 'on', 'a', 'grid.'], accent: ['grid.'] },
];
/** The logo lands on bar 3's downbeat (impact sound). */
export const LOGO_FRAME = bars(3);
/** Frames where each word lands (tick sounds). */
export const WORD_FRAMES = LINES.flatMap((line) => line.words.map((_, i) => Math.round((line.beat + i / 2) * BEAT)));
const BLOCKS = [COLORS.pink, COLORS.text2, COLORS.pink, COLORS.blue, COLORS.text2, COLORS.yellow, COLORS.green, COLORS.pink];

function KineticLine({ line, end }: { line: Line; end: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(line.beat * BEAT);
  if (frame < start - 2 || frame > end + 8) return null;
  const out = interpolate(frame, [end - 3, end + 5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', top: 410, left: 0, right: 0, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', padding: '0 140px' }}>
      {line.words.map((word, i) => {
        const at = start + Math.round((i / 2) * BEAT);
        const rise = spring({ frame: frame - at, fps, config: { damping: 14, mass: 0.55, stiffness: 160 } });
        const hit = Math.exp(-Math.max(0, frame - at) / 4) * (frame >= at ? 1 : 0);
        const accent = line.accent.includes(word);
        return (
          <span key={i} style={{ display: 'inline-block', overflow: 'hidden', paddingBottom: 18, marginBottom: -18, marginRight: 34 }}>
            <span
              style={{
                display: 'inline-block',
                fontFamily: FONTS.display,
                fontWeight: 700,
                fontSize: 128,
                letterSpacing: '-0.035em',
                lineHeight: 1.05,
                color: accent ? COLORS.accent : COLORS.text,
                textShadow: accent ? `0 0 ${40 + hit * 60}px rgba(255,61,0,0.55)` : undefined,
                transform: `translateY(${(1 - rise) * 110 - out * 115}%) scale(${1 + hit * 0.06})`,
              }}
            >
              {word}
            </span>
          </span>
        );
      })}
    </div>
  );
}

/** A bar of the grid: 16 slots, with syllable blocks snapping in on the eighths. */
function GridBar() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = bars(2);
  const show = interpolate(frame, [start, start + 8, bars(3) - 4, bars(3) + 2], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  if (show === 0) return null;
  const width = 1100;
  return (
    <div style={{ position: 'absolute', top: 620, left: (1920 - width) / 2, width, height: 70, opacity: show }}>
      {Array.from({ length: 17 }, (_, i) => (
        <div key={i} style={{ position: 'absolute', left: (i / 16) * width, top: 0, bottom: 0, width: i % 4 === 0 ? 2 : 1, background: i % 4 === 0 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)' }} />
      ))}
      {BLOCKS.map((color, i) => {
        const p = spring({ frame: frame - start - Math.round((i / 2) * BEAT), fps, config: { damping: 12, mass: 0.45 } });
        return (
          <div
            key={i}
            style={{
              position: 'absolute', top: 16, height: 38, left: (i * 2 / 16) * width + 6, width: width / 8 - 12 - (i % 3) * 18,
              borderRadius: 8, background: color, opacity: p, transform: `translateY(${(1 - p) * -60}px) scaleX(${0.4 + 0.6 * p})`,
              boxShadow: `0 0 24px ${color}66`,
            }}
          />
        );
      })}
    </div>
  );
}

/** Bar 3: the logo slams in, then everything cuts out on the gap before the drop. */
function Logo({ gap }: { gap: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < LOGO_FRAME - 1 || frame >= gap) return null;
  const land = spring({ frame: frame - LOGO_FRAME, fps, config: { damping: 10, mass: 0.6 } });
  const ring = interpolate(frame, [LOGO_FRAME, LOGO_FRAME + 20], [0, 1], { extrapolateRight: 'clamp' });
  const line = spring({ frame: frame - LOGO_FRAME - Math.round(BEAT * 1.5), fps, config: { damping: 18 } });
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', border: `3px solid ${COLORS.accent}`, transform: `scale(${0.3 + ring * 1.6})`, opacity: (1 - ring) * 0.9 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 36, transform: `scale(${2.2 - 1.2 * land})`, opacity: Math.min(1, land * 2) }}>
        <Img src={staticFile('app-icon.png')} style={{ width: 190, height: 190 }} />
        <div style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 170, letterSpacing: '-0.045em', color: COLORS.text, lineHeight: 1 }}>
          no<span style={{ color: COLORS.accent }}>Cap</span>
        </div>
      </div>
      <div style={{ marginTop: 34, fontFamily: FONTS.body, fontSize: 42, color: COLORS.text2, opacity: line, transform: `translateY(${(1 - line) * 18}px)` }}>
        See how a rapper rides the beat.
      </div>
    </AbsoluteFill>
  );
}

export function Hook({ gap }: { gap: number }) {
  return (
    <AbsoluteFill>
      {LINES.map((line, i) => (
        <KineticLine key={i} line={line} end={i + 1 < LINES.length ? Math.round(LINES[i + 1].beat * BEAT) : LOGO_FRAME} />
      ))}
      <GridBar />
      <Logo gap={gap} />
    </AbsoluteFill>
  );
}
