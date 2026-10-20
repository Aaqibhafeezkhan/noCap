// Canvas colours and fonts for the Pixi flow map. These mirror the CSS tokens in
// styles/tokens.css — keep both in sync when changing the palette.

/** Eight rhyme colours for the strongest groups, chosen for a dark background. Every pair
 *  stays at least ΔE 16 apart under protanopia, deuteranopia and tritanopia simulation
 *  (Machado 2009 matrices); letters on the blocks are the second, colour-free cue. */
export const RHYME_PALETTE = [
  0xff4f9a, // A pink
  0x3fb8ff, // B blue
  0x5ee6a0, // C green
  0xffd23f, // D yellow
  0xb266ff, // E violet
  0xff8a3d, // F orange
  0xeaff00, // G lime
  0xccffff, // H ice
] as const;

export const FEATURED_RHYMES = RHYME_PALETTE.length;

export const CANVAS = {
  bg: 0x0b0b0d,
  rowA: 0x0f0f12,
  rowB: 0x121216,
  rowSelected: 0x1d1a1a,
  header: 0x0d0d10,
  labelBg: 0x0d0d10,
  beatLine: 0x2c2c34,
  subLine: 0x1d1d24,
  rowLine: 0x1b1b21,
  label: 0x8a8a94,
  labelStrong: 0xf2f2f3,
  unrhymed: 0x3a3a42,
  otherRhyme: 0x6a6a76,
  dimmed: 0x26262c,
  textOnFill: 0x0b0b0d,
  text: 0xf2f2f3,
  textMuted: 0xb4b4bd,
  accent: 0xff3d00,
  energy: 0xffb000,
  onset: 0xfff1a8,
  densityTrack: 0x18181d,
  pocketAhead: 0x3fb8ff,
  pocketBehind: 0xff8a3d,
  markerSwitch: 0x3fb8ff,
  markerCut: 0xff3d00,
  markerDrift: 0xffd23f,
  markerPocket: 0x5ee6a0,
} as const;

export const FONT_UI = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
export const FONT_MONO = '"JetBrains Mono", "SF Mono", ui-monospace, monospace';

export async function loadCanvasFonts(): Promise<void> {
  if (!('fonts' in document)) return;
  try {
    await Promise.all([
      document.fonts.load('500 12px Inter'),
      document.fonts.load('700 12px Inter'),
      document.fonts.load('500 11px "JetBrains Mono"'),
    ]);
  } catch {
    // Falls back to system fonts; the canvas still renders.
  }
}
