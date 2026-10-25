import { Easing, interpolate } from 'remotion';
import marks from './marks.json';
import { BAR, HEIGHT, SOURCE, WIDTH, barOf } from './timeline';

/** Camera over the app window: `x`/`y` is the point of the app (CSS px) at the centre
 *  of the frame, `zoom` 1 shows the whole window. */
export type Shot = { x: number; y: number; zoom: number };
type Key = Shot & { at: number };

/** The app window's size on screen at zoom 1. */
export const WINDOW_SCALE = 1500 / SOURCE.width;
const VIEW_CENTER = { x: WIDTH / 2, y: HEIGHT / 2 - 10 };

const WHOLE: Shot = { x: 720, y: 450, zoom: 1 };
const [dropzone, toast, barClick, , edit, , save, exportMenu] = marks.clicks.map(barOf);

// Keyframes in bars from the start of the video; moves ease between consecutive keys.
// Keys tied to a click use the bar where that click lands in the edit.
const KEYS: Key[] = [
  { at: 4, ...WHOLE },
  { at: dropzone + 0.15, ...WHOLE },
  { at: dropzone + 0.6, x: 430, y: 330, zoom: 1.7 },
  { at: barOf(marks.scenes.open - 1.4), x: 430, y: 330, zoom: 1.7 },
  { at: toast - 0.25, x: 720, y: 760, zoom: 1.45 },
  { at: toast + 0.15, x: 720, y: 760, zoom: 1.45 },
  { at: toast + 0.6, ...WHOLE },
  { at: 9.3, ...WHOLE },
  { at: 10, x: 560, y: 380, zoom: 1.28 },
  { at: 10.55, x: 520, y: 300, zoom: 1.75 },
  { at: 11.6, x: 640, y: 300, zoom: 1.75 },
  { at: 12, x: 520, y: 470, zoom: 1.8 },
  { at: 12.4, x: 470, y: 470, zoom: 2.05 },
  { at: 13.5, x: 640, y: 470, zoom: 2.05 },
  { at: barClick - 0.3, x: 520, y: 440, zoom: 1.5 },
  { at: barClick + 0.2, x: 520, y: 440, zoom: 1.5 },
  { at: barClick + 0.8, x: 1060, y: 340, zoom: 1.85 },
  { at: 16, x: 1060, y: 340, zoom: 1.85 },
  { at: 16.45, x: 760, y: 260, zoom: 1.6 },
  { at: 16.95, x: 560, y: 250, zoom: 1.6 },
  { at: 17.25, x: 560, y: 250, zoom: 1.6 },
  { at: 17.75, x: 600, y: 360, zoom: 1.3 },
  { at: 18.2, x: 720, y: 330, zoom: 1.3 },
  { at: edit - 0.2, x: 760, y: 300, zoom: 1.45 },
  { at: edit + 0.35, x: 720, y: 390, zoom: 1.9 },
  { at: save + 0.1, x: 760, y: 360, zoom: 1.9 },
  { at: exportMenu - 0.15, x: 820, y: 300, zoom: 1.75 },
  { at: 21.75, x: 820, y: 300, zoom: 1.75 },
  { at: 22.1, x: 720, y: 420, zoom: 1.12 },
  { at: 23.3, x: 720, y: 400, zoom: 1.3 },
  { at: 24, x: 720, y: 400, zoom: 1.42 },
  { at: 24.4, ...WHOLE },
];

const ease = Easing.bezier(0.7, 0, 0.3, 1);

/** Keeps the window filling the frame when zoomed in, so no background shows at the edges. */
function clamp(shot: Shot): Shot {
  const scale = WINDOW_SCALE * shot.zoom;
  const halfW = VIEW_CENTER.x / scale;
  const halfH = VIEW_CENTER.y / scale;
  const fit = (v: number, half: number, size: number) => (half * 2 >= size ? v : Math.min(size - half, Math.max(half, v)));
  return { zoom: shot.zoom, x: fit(shot.x, halfW, SOURCE.width), y: fit(shot.y, halfH, SOURCE.height) };
}

const FRAME_KEYS = KEYS.map((k) => ({ ...k, at: k.at * BAR }));

export function shotAt(frame: number): Shot {
  const keys = FRAME_KEYS;
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

/** Screen position of the app's top-left corner and its scale for a shot. */
export function placement(shot: Shot) {
  const scale = WINDOW_SCALE * shot.zoom;
  return { x: VIEW_CENTER.x - shot.x * scale, y: VIEW_CENTER.y - shot.y * scale, scale };
}

/** How fast the picture moves at a frame (screen px per frame), for motion blur. */
export function velocity(frame: number): { x: number; y: number; zoom: number } {
  const a = placement(shotAt(frame - 0.5));
  const b = placement(shotAt(frame + 0.5));
  // A point at the centre of the screen moves by the translation plus the scaling around it.
  const cx = (WIDTH / 2 - a.x) / a.scale;
  const cy = (HEIGHT / 2 - a.y) / a.scale;
  return { x: b.x + cx * b.scale - WIDTH / 2, y: b.y + cy * b.scale - HEIGHT / 2, zoom: b.scale / a.scale - 1 };
}

/** Quick, big camera moves (bar at their midpoint) that get a whip sound. */
export const WHIPS = KEYS.slice(1)
  .map((b, i) => ({ a: KEYS[i], b }))
  .filter(({ a, b }) => b.at - a.at < 0.8 && (Math.hypot(a.x - b.x, a.y - b.y) > 150 || Math.abs(Math.log(a.zoom / b.zoom)) > 0.3))
  .map(({ a, b }) => (a.at + b.at) / 2);

/** Keys must ascend; a click landing elsewhere in a new recording would break the order. */
export const KEY_ORDER_OK = KEYS.every((k, i) => i === 0 || k.at > KEYS[i - 1].at);
