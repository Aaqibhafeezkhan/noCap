import type { Graphics } from 'pixi.js';
import { FLOW_DIMS, rowHeight, rowTop } from '../layout';
import { CANVAS } from '../theme';
import type { RenderState, RowRange } from './types';

/** Row backgrounds, beat grid and the optional context layers for the drawn rows. */
export function drawRows(graphics: Graphics, state: RenderState, range: RowRange) {
  const { layout, flowmap, layers } = state;
  const left = FLOW_DIMS.labelW;
  for (let index = range.first; index <= range.last; index += 1) {
    const bar = flowmap.bars[index];
    const top = rowTop(layout, index);
    const height = rowHeight(layout, index);
    const selected = isSelected(state, bar.bar_no);
    if (bar.empty) {
      // A bar without words: a thin, quiet row so instrumental stretches stay visible.
      graphics.rect(left, top, layout.gridW, height).fill(selected ? CANVAS.rowSelected : CANVAS.emptyRow);
      drawGrid(graphics, state, top, height, false);
    } else {
      graphics.rect(left, top, layout.gridW, height).fill(selected ? CANVAS.rowSelected : index % 2 ? CANVAS.rowB : CANVAS.rowA);
      if (layers.energy) {
        const alpha = Math.min(0.12, Math.max(0, bar.rms_avg) * 0.12);
        if (alpha > 0) graphics.rect(left, top, layout.gridW, height).fill({ color: CANVAS.energy, alpha });
      }
      drawGrid(graphics, state, top, height, true);
      if (layers.onsets) drawOnsets(graphics, state, bar.bar_no, top, height);
      if (layers.density) drawDensity(graphics, state, bar.density, top, height);
    }
    graphics.moveTo(left, top + height).lineTo(left + layout.gridW, top + height).stroke({ color: CANVAS.rowLine, width: 1 });
  }
}

export function isSelected(state: RenderState, barNo: number): boolean {
  return !!state.selection && barNo >= state.selection.start && barNo <= state.selection.end;
}

function drawGrid(graphics: Graphics, state: RenderState, top: number, height: number, subdivisions: boolean) {
  const { layout } = state;
  const showSubdivisions = subdivisions && layout.beatW >= 60;
  for (let beat = 0; beat < layout.signature; beat += 1) {
    const x = FLOW_DIMS.labelW + beat * layout.beatW;
    graphics.moveTo(x, top).lineTo(x, top + height).stroke({ color: CANVAS.beatLine, width: 1 });
    if (!showSubdivisions) continue;
    for (let sub = 1; sub < FLOW_DIMS.subdivs; sub += 1) {
      const sx = x + (sub / FLOW_DIMS.subdivs) * layout.beatW;
      graphics.moveTo(sx, top + height * 0.3).lineTo(sx, top + height).stroke({ color: CANVAS.subLine, width: 1 });
    }
  }
}

function drawOnsets(graphics: Graphics, state: RenderState, barNo: number, top: number, height: number) {
  const { layout } = state;
  for (const beat of state.beatsByBar.get(barNo) || []) {
    const strength = Math.min(1, Math.max(0, beat.onset_strength));
    if (strength <= 0.15) continue;
    const x = FLOW_DIMS.labelW + (beat.beat_no - 1) * layout.beatW;
    graphics.moveTo(x, top + 3).lineTo(x, top + height - 3)
      .stroke({ color: CANVAS.onset, width: 1 + strength * 2, alpha: 0.12 + strength * 0.35 });
  }
}

function drawDensity(graphics: Graphics, state: RenderState, density: number, top: number, rowH: number) {
  const { layout } = state;
  const x = FLOW_DIMS.labelW + layout.gridW + 8;
  const width = FLOW_DIMS.densW - 14;
  const height = Math.max(3, Math.min(8, rowH * 0.18));
  const y = top + (rowH - height) / 2;
  const pct = Math.min(1, density / state.maxDensity);
  graphics.roundRect(x, y, width, height, height / 2).fill(CANVAS.densityTrack);
  if (pct > 0) graphics.roundRect(x, y, Math.max(height, width * pct), height, height / 2).fill({ color: CANVAS.textMuted, alpha: 0.35 + pct * 0.5 });
}
