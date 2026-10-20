import { Easing, interpolate } from 'remotion';
import { HEIGHT, SOURCE, WIDTH, bars } from './timeline';

/** Camera over the app window: `x`/`y` is the point of the app (CSS px) at the centre
 *  of the frame, `zoom` 1 shows the whole window. */
export type Shot = { x: number; y: number; zoom: number };
type Key = Shot & { at: number };

/** The app window's size on screen at zoom 1. */
export const WINDOW_SCALE = 1500 / SOURCE.width;
const VIEW_CENTER = { x: WIDTH / 2, y: HEIGHT / 2 - 10 };

const WHOLE: Shot = { x: 720, y: 450, zoom: 1 };

// Keyframes in bars from the start of the video; moves ease between consecutive keys.
const KEYS: Key[] = [
  { at: 2, ...WHOLE },
  { at: 2.9, ...WHOLE },
  { at: 4, x: 560, y: 380, zoom: 1.28 },
  { at: 4.35, x: 520, y: 300, zoom: 1.75 },
  { at: 5.6, x: 640, y: 300, zoom: 1.75 },
  { at: 6, x: 520, y: 420, zoom: 1.5 },
  { at: 6.6, x: 520, y: 420, zoom: 1.5 },
  { at: 7.2, x: 1060, y: 340, zoom: 1.85 },
  { at: 8, x: 1060, y: 340, zoom: 1.85 },
  { at: 8.4, x: 470, y: 470, zoom: 2.05 },
  { at: 9.1, x: 640, y: 470, zoom: 2.05 },
  { at: 9.6, x: 520, y: 480, zoom: 2.05 },
  { at: 10, x: 520, y: 480, zoom: 2.05 },
  { at: 10.45, x: 760, y: 260, zoom: 1.6 },
  { at: 10.95, x: 560, y: 250, zoom: 1.6 },
  { at: 11.25, x: 560, y: 250, zoom: 1.6 },
  { at: 11.75, x: 600, y: 360, zoom: 1.3 },
  { at: 12, x: 620, y: 360, zoom: 1.3 },
  { at: 12.4, x: 720, y: 420, zoom: 1.12 },
  { at: 13.3, x: 720, y: 400, zoom: 1.3 },
  { at: 14, x: 720, y: 400, zoom: 1.42 },
  { at: 14.4, ...WHOLE },
];

const ease = Easing.bezier(0.65, 0, 0.35, 1);

/** Keeps the window filling the frame when zoomed in, so no background shows at the edges. */
function clamp(shot: Shot): Shot {
  const scale = WINDOW_SCALE * shot.zoom;
  const halfW = VIEW_CENTER.x / scale;
  const halfH = VIEW_CENTER.y / scale;
  const fit = (v: number, half: number, size: number) => (half * 2 >= size ? v : Math.min(size - half, Math.max(half, v)));
  return { zoom: shot.zoom, x: fit(shot.x, halfW, SOURCE.width), y: fit(shot.y, halfH, SOURCE.height) };
}

export function shotAt(frame: number): Shot {
  const keys = KEYS.map((k) => ({ ...k, at: bars(k.at) }));
  if (frame <= keys[0].at) return clamp(keys[0]);
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    if (frame <= b.at) {
      const p = interpolate(frame, [a.at, b.at], [0, 1], { easing: ease });
      const mix = (u: number, v: number) => u + (v - u) * p;
      // Zoom moves in log space so push-ins feel even.
      const zoom = Math.exp(mix(Math.log(a.zoom), Math.log(b.zoom)));
      return clamp({ x: mix(a.x, b.x), y: mix(a.y, b.y), zoom });
    }
  }
  return clamp(keys[keys.length - 1]);
}

/** CSS transform placing the app (in its own CSS px) on screen for a shot. */
export function transformFor(shot: Shot): string {
  const scale = WINDOW_SCALE * shot.zoom;
  const tx = VIEW_CENTER.x - shot.x * scale;
  const ty = VIEW_CENTER.y - shot.y * scale;
  return `translate(${tx}px, ${ty}px) scale(${scale})`;
}

/** Big camera moves, in bars, that get a whoosh. */
export const WHOOSHES = [2.9, 4, 6.6, 8, 10, 12, 14];
