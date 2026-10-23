import type { Graphics } from 'pixi.js';
import type { FlowMap, FlowSyllable } from '../../types';
import { rhymeColor } from '../colors';
import { FLOW_DIMS, rowHeight, rowTop, type SyllableRect } from '../layout';
import { CANVAS } from '../theme';
import type { HoverState, RenderState, RowRange } from './types';

/** Hovered block plus every block of the same rhyme group in the drawn rows. */
export function drawHover(graphics: Graphics, state: RenderState, range: RowRange, hover: HoverState) {
  graphics.clear();
  if (hover.rowIndex !== null && !hover.rect) {
    graphics.rect(FLOW_DIMS.labelW, rowTop(state.layout, hover.rowIndex), state.layout.gridW, rowHeight(state.layout, hover.rowIndex)).fill({ color: 0xffffff, alpha: 0.025 });
  }
  const rect = hover.rect;
  if (!rect) return;
  const group = rect.syllable.rhyme_group;
  if (group) {
    const color = rhymeColor(state.styles, group);
    for (let index = range.first; index <= range.last; index += 1) {
      for (const other of state.rows[index] || []) {
        if (other !== rect && other.syllable.rhyme_group === group) outline(graphics, other, color, 1.5, 0.85);
      }
    }
  }
  outline(graphics, rect, 0xffffff, 2, 1);
}

function outline(graphics: Graphics, rect: SyllableRect, color: number, width: number, alpha: number) {
  graphics.roundRect(rect.x - 2.5, rect.y - 2.5, rect.width + 5, rect.height + 5, 5).stroke({ color, width, alpha });
}

/** Builds a time index once per track so the per-frame lookup is a binary search. */
export function syllableTimeIndex(rows: SyllableRect[][]): SyllableRect[] {
  return rows.flat().filter((rect) => rect.syllable.center_time >= 0).sort((left, right) => left.syllable.center_time - right.syllable.center_time);
}

export function findActiveRect(index: SyllableRect[], time: number): SyllableRect | null {
  let low = 0;
  let high = index.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const syllable: FlowSyllable = index[mid].syllable;
    if (time < syllable.start) high = mid - 1;
    else if (time > syllable.end) low = mid + 1;
    else return index[mid];
  }
  return null;
}

export function findBeatIndex(flowmap: FlowMap, time: number): number {
  let low = 0;
  let high = flowmap.beats.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (flowmap.beats[mid].time <= time) low = mid;
    else high = mid - 1;
  }
  return low;
}

/** Playhead line inside the current bar and a glow on the syllable being sung.
 *  Returns the row index of the current bar so the stage can follow it. */
export function drawPlayhead(graphics: Graphics, state: RenderState, rowOf: Map<number, number>, timeIndex: SyllableRect[], time: number): number | null {
  graphics.clear();
  const { flowmap, layout } = state;
  if (flowmap.beats.length === 0 || time <= 0) return null;
  const beatIndex = findBeatIndex(flowmap, time);
  const beat = flowmap.beats[beatIndex];
  const rowIndex = rowOf.get(beat.bar_no);
  if (rowIndex === undefined) return null;
  const top = rowTop(layout, rowIndex);
  const height = rowHeight(layout, rowIndex);
  const nextTime = flowmap.beats[beatIndex + 1]?.time ?? beat.time + 60 / (flowmap.metadata.bpm || 90);
  const frac = nextTime > beat.time ? Math.min(1, Math.max(0, (time - beat.time) / (nextTime - beat.time))) : 0;
  const x = FLOW_DIMS.labelW + (beat.beat_no - 1 + frac) * layout.beatW;
  graphics.rect(FLOW_DIMS.labelW, top, layout.gridW, height).fill({ color: CANVAS.accent, alpha: 0.07 });
  graphics.moveTo(x, top).lineTo(x, top + height).stroke({ color: 0xffffff, width: 1.5, alpha: 0.85 });
  const active = findActiveRect(timeIndex, time);
  if (active) {
    const color = rhymeColor(state.styles, active.syllable.rhyme_group);
    const glow = active.syllable.rhyme_group ? color : 0xffffff;
    graphics.roundRect(active.x - 4, active.y - 4, active.width + 8, active.height + 8, 6).fill({ color: glow, alpha: 0.22 }).stroke({ color: glow, width: 2 });
  }
  return rowIndex;
}
