import type { FlowBar, FlowMap, FlowSyllable } from '../types';
import { syllableLabels } from './syllableText';

export const FLOW_DIMS = {
  labelW: 64,
  headerH: 28,
  densW: 40,
  subdivs: 4,
  minBeatW: 80,
  baseBarH: 56,
  minBarH: 16,
  maxBarH: 72,
  /** Rows shorter than this hide syllable text and fall back to plain blocks. */
  textMinBarH: 40,
};

/** Longest block, in beats. */
const MAX_BLOCK_BEATS = 0.9;

export const ZOOM_LEVELS = [0.3, 0.5, 0.75, 1, 1.5, 2, 3] as const;
export const DEFAULT_ZOOM = 1;

export interface FlowLayout {
  /** Total scrollable content size. */
  width: number;
  height: number;
  beatW: number;
  barH: number;
  signature: number;
  zoom: number;
  showText: boolean;
  gridW: number;
  /** Top of every row plus the bottom of the last one (rows.length + 1 entries). Bars
   *  without words get a thin row, so rows are not all ``barH`` tall. */
  rowTops: number[];
}

export interface SyllableRect {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Where the syllable's centre falls on the grid (blocks can be clipped at the bar edge). */
  cx: number;
  /** Signed distance (px) from `cx` to the nearest 16th-note grid line. */
  pocketDx: number;
  /** Same offset in milliseconds; negative = ahead of the grid. */
  pocketMs: number;
  label: string;
  syllable: FlowSyllable;
}

export function computeLayout(flowmap: FlowMap, viewportW: number, zoom: number): FlowLayout {
  const signature = flowmap.metadata.time_signature || 4;
  const fitBeatW = Math.max(FLOW_DIMS.minBeatW, Math.floor((viewportW - FLOW_DIMS.labelW - FLOW_DIMS.densW - 8) / signature));
  const beatW = zoom > 1 ? Math.round(fitBeatW * zoom) : fitBeatW;
  const barH = zoom >= 1
    ? Math.min(FLOW_DIMS.maxBarH, Math.round(FLOW_DIMS.baseBarH + (zoom - 1) * 8))
    : Math.max(FLOW_DIMS.minBarH, Math.round(FLOW_DIMS.baseBarH * zoom));
  const gridW = signature * beatW;
  const rowTops = [FLOW_DIMS.headerH];
  for (const bar of flowmap.bars) rowTops.push(rowTops[rowTops.length - 1] + (bar.empty ? emptyRowH(barH) : barH));
  return {
    width: FLOW_DIMS.labelW + gridW + FLOW_DIMS.densW,
    height: rowTops[rowTops.length - 1] + 8,
    beatW,
    barH,
    signature,
    zoom,
    showText: barH >= FLOW_DIMS.textMinBarH,
    gridW,
    rowTops,
  };
}

/** Height of a row for a bar without words. */
export function emptyRowH(barH: number): number {
  return Math.max(8, Math.round(barH * 0.35));
}

export function rowTop(layout: FlowLayout, rowIndex: number): number {
  const { rowTops } = layout;
  return rowTops[Math.max(0, Math.min(rowIndex, rowTops.length - 1))];
}

export function rowHeight(layout: FlowLayout, rowIndex: number): number {
  return rowTop(layout, rowIndex + 1) - rowTop(layout, rowIndex);
}

/** Row under a content y (binary search over the row tops). */
export function rowAtY(layout: FlowLayout, rowCount: number, y: number): number | null {
  const { rowTops } = layout;
  if (y < rowTops[0] || y >= rowTops[Math.min(rowCount, rowTops.length - 1)]) return null;
  let low = 0;
  let high = Math.min(rowCount, rowTops.length - 1) - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (rowTops[mid] <= y) low = mid;
    else high = mid - 1;
  }
  return low;
}

/** Syllable blocks per bar row. Width follows the syllable's sung duration and is
 *  trimmed so neighbouring blocks never overlap. */
export function buildSyllableRows(flowmap: FlowMap, layout: FlowLayout): SyllableRect[][] {
  const labels = syllableLabels(flowmap.syllables);
  const byBar = groupSyllablesByBar(flowmap.syllables);
  return flowmap.bars.map((bar, rowIndex) => {
    const syllables = [...(byBar.get(bar.bar_no) || [])].sort((a, b) => a.beat_no + a.beat_pos - (b.beat_no + b.beat_pos));
    const rects = syllables.map((syllable) => blockFor(syllable, bar, flowmap, layout, rowIndex, labels.get(syllable) || ''));
    for (let index = 0; index < rects.length - 1; index += 1) {
      const room = rects[index + 1].x - rects[index].x - 2;
      rects[index].width = Math.max(4, Math.min(rects[index].width, room));
    }
    return rects;
  });
}

function blockFor(syllable: FlowSyllable, bar: FlowBar, flowmap: FlowMap, layout: FlowLayout, rowIndex: number, label: string): SyllableRect {
  const beatSec = 60 / (bar.local_bpm > 0 ? bar.local_bpm : flowmap.metadata.bpm || 90);
  const position = syllable.beat_no - 1 + syllable.beat_pos;
  const centerX = FLOW_DIMS.labelW + position * layout.beatW;
  // Whisper word ends often run into the following pause, so a held syllable is
  // capped at one beat; blocks are also kept inside the bar's grid.
  const duration = Math.max(0, syllable.end - syllable.start);
  const minW = layout.showText ? 10 : 6;
  const width = Math.max(minW, Math.min(layout.beatW * MAX_BLOCK_BEATS, (duration / beatSec) * layout.beatW));
  const gridLeft = FLOW_DIMS.labelW + 1;
  const gridRight = FLOW_DIMS.labelW + layout.gridW - 1;
  const left = Math.max(gridLeft, Math.min(centerX - width / 2, gridRight - minW));
  const right = Math.min(gridRight, Math.max(centerX + width / 2, left + minW));
  // Text mode reserves 13px above the block for the rhyme letter and ~11px below for the pocket notch.
  const fullH = layout.showText ? layout.barH - 24 : layout.barH - 8;
  const height = layout.showText || syllable.stress ? fullH : Math.max(3, Math.round(fullH * 0.55));
  const top = rowTop(layout, rowIndex);
  const gridStep = 1 / FLOW_DIMS.subdivs;
  const offsetBeats = syllable.beat_pos - Math.round(syllable.beat_pos / gridStep) * gridStep;
  return {
    x: Math.round(left),
    y: layout.showText ? top + 13 : top + Math.round((layout.barH - height) / 2),
    width: Math.round(right - left),
    height,
    cx: centerX,
    pocketDx: -offsetBeats * layout.beatW,
    pocketMs: Math.round(offsetBeats * beatSec * 1000),
    label,
    syllable,
  };
}

export function groupSyllablesByBar(syllables: FlowSyllable[]): Map<number, FlowSyllable[]> {
  const byBar = new Map<number, FlowSyllable[]>();
  for (const syllable of syllables) {
    const group = byBar.get(syllable.bar_no);
    if (group) group.push(syllable);
    else byBar.set(syllable.bar_no, [syllable]);
  }
  return byBar;
}

export function barIndexMap(bars: FlowBar[]): Map<number, number> {
  const map = new Map<number, number>();
  bars.forEach((bar, index) => map.set(bar.bar_no, index));
  return map;
}

export function nextZoom(zoom: number, direction: 1 | -1): number {
  const index = ZOOM_LEVELS.findIndex((level) => level >= zoom - 1e-6);
  const current = index < 0 ? ZOOM_LEVELS.length - 1 : index;
  const next = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, current + direction));
  return ZOOM_LEVELS[next];
}
