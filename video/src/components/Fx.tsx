import { AbsoluteFill, interpolate, random, useCurrentFrame } from 'remotion';
import { COLORS } from '../theme';
import { BAR, bars } from '../timeline';

/** SVG filter for the app layer: directional motion blur (`blurX`/`blurY` in px) and an
 *  RGB split (`split` px; red one way, green and blue the other). */
export function FxFilter({ id, blurX, blurY, split }: { id: string; blurX: number; blurY: number; split: number }) {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }}>
      <filter id={id} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
        <feGaussianBlur in="SourceGraphic" stdDeviation={`${blurX} ${blurY}`} result="blur" />
        <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red" />
        <feOffset in="red" dx={split} result="redShift" />
        <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="cyan" />
        <feOffset in="cyan" dx={-split} result="cyanShift" />
        <feBlend in="redShift" in2="cyanShift" mode="screen" />
      </filter>
    </svg>
  );
}

/** Film grain: fresh noise every other frame, kept faint. */
export function Grain({ opacity = 0.07 }: { opacity?: number }) {
  const frame = useCurrentFrame();
  const seed = Math.floor(frame / 2) % 97;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'overlay', opacity }}>
      <svg width="100%" height="100%">
        <filter id={`grain-${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
      </svg>
    </AbsoluteFill>
  );
}

export function Vignette() {
  return <AbsoluteFill style={{ pointerEvents: 'none', background: 'radial-gradient(ellipse 75% 70% at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)' }} />;
}

/** Warm light sweeping across the frame for about a bar, starting at `atBar`. */
function Leak({ atBar, frame }: { atBar: number; frame: number }) {
  const start = bars(atBar) - 4;
  const length = BAR;
  if (frame < start || frame > start + length) return null;
  const p = (frame - start) / length;
  const side = random(`leak-${atBar}`) > 0.5;
  const x = side ? interpolate(p, [0, 1], [-10, 70]) : interpolate(p, [0, 1], [110, 30]);
  const opacity = Math.sin(Math.PI * p) * 0.3;
  return (
    <AbsoluteFill
      style={{
        mixBlendMode: 'screen',
        opacity,
        background: `radial-gradient(ellipse 45% 85% at ${x}% ${side ? 20 : 80}%, ${COLORS.accent2} 0%, rgba(255,79,154,0.5) 35%, transparent 70%)`,
        filter: 'blur(30px)',
      }}
    />
  );
}

export function LightLeaks({ atBars }: { atBars: number[] }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {atBars.map((bar) => (
        <Leak key={bar} atBar={bar} frame={frame} />
      ))}
    </AbsoluteFill>
  );
}

/** White-hot flash with a burst of glow, for the drops. */
export function Flash({ length = 14 }: { length?: number }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 2, length], [0, 0.6, 0], { extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ pointerEvents: 'none', background: 'radial-gradient(circle at 50% 45%, #fff 0%, rgba(255,61,0,0.6) 40%, transparent 75%)', opacity }} />;
}
