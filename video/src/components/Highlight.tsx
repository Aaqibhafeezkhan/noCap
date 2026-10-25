import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS } from '../theme';
import marks from '../marks.json';
import { barOf, bars } from '../timeline';

/** A glowing outline drawn over the app (CSS px of the recording), between two bar positions. */
type Mark = { from: number; to: number; x: number; y: number; w: number; h: number };

const pocket = barOf(marks.scenes.pocket + 1.1);
const inspector = barOf(marks.clicks[2] + 2.2);

const MARKS: Mark[] = [
  // Pocket: the tooltip's timing row ("33 ms behind").
  { from: pocket, to: pocket + 0.5, x: 348, y: 512, w: 192, h: 26 },
  // Inspector: the selected bar's lyrics, coloured by rhyme group.
  { from: inspector, to: inspector + 0.7, x: 1128, y: 428, w: 304, h: 76 },
];

function Outline({ mark }: { mark: Mark }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const from = bars(mark.from);
  const to = bars(mark.to);
  if (frame < from || frame > to) return null;
  const grow = spring({ frame: frame - from, fps, config: { damping: 14 } });
  const fade = interpolate(frame, [to - 6, to], [1, 0], { extrapolateLeft: 'clamp' });
  return (
    <div
      style={{
        position: 'absolute',
        left: mark.x,
        top: mark.y,
        width: mark.w,
        height: mark.h,
        borderRadius: 8,
        border: `1.5px solid ${COLORS.accent}`,
        boxShadow: `0 0 0 4px rgba(255, 61, 0, 0.18), 0 0 24px rgba(255, 61, 0, 0.45)`,
        transform: `scale(${1.25 - 0.25 * grow})`,
        opacity: Math.min(1, grow * 1.5) * fade,
      }}
    />
  );
}

export function Highlights() {
  return (
    <>
      {MARKS.map((mark) => (
        <Outline key={`${mark.from}-${mark.x}`} mark={mark} />
      ))}
    </>
  );
}

/** Bar positions where an outline pops in, for the sound effects. */
export const HIGHLIGHT_BARS = MARKS.map((m) => m.from);
