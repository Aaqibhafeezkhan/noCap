import type { Graphics } from 'pixi.js';
import { FLOW_DIMS, rowHeight, rowTop } from '../layout';
import type { MarkerKind } from '../markers';
import { CANVAS } from '../theme';
import { isSelected } from './rows';
import type { TextPool } from './textPool';
import type { HoverState, RenderState, RowRange } from './types';

export const PLAY_BUTTON = { x: 11, radius: 9 };
const MARKER_X0 = 22;
const MARKER_STEP = 9;

/** Beat numbers and subdivision ticks; lives in a layer that only scrolls sideways. */
export function drawHeader(graphics: Graphics, pool: TextPool, state: RenderState) {
  const { layout } = state;
  graphics.rect(0, 0, layout.width, FLOW_DIMS.headerH).fill(CANVAS.header);
  graphics.moveTo(0, FLOW_DIMS.headerH - 0.5).lineTo(layout.width, FLOW_DIMS.headerH - 0.5).stroke({ color: CANVAS.beatLine, width: 1 });
  for (let beat = 0; beat < layout.signature; beat += 1) {
    const x = FLOW_DIMS.labelW + beat * layout.beatW;
    graphics.moveTo(x, 6).lineTo(x, FLOW_DIMS.headerH).stroke({ color: CANVAS.beatLine, width: 1 });
    for (let sub = 1; sub < FLOW_DIMS.subdivs && layout.beatW >= 60; sub += 1) {
      const sx = x + (sub / FLOW_DIMS.subdivs) * layout.beatW;
      graphics.moveTo(sx, FLOW_DIMS.headerH - 6).lineTo(sx, FLOW_DIMS.headerH).stroke({ color: CANVAS.subLine, width: 1 });
    }
    pool.place('header', String(beat + 1), x + 8, 8, CANVAS.label);
  }
}

/** Bar numbers, context markers, selection edge and the hover play button.
 *  Lives in a layer that only scrolls vertically, so it stays visible when zoomed in. */
export function drawLabels(graphics: Graphics, pool: TextPool, state: RenderState, range: RowRange, hover: HoverState) {
  const { layout, flowmap } = state;
  const top = rowTop(layout, range.first);
  const bottom = rowTop(layout, range.last + 1);
  graphics.rect(0, top, FLOW_DIMS.labelW, bottom - top).fill(CANVAS.labelBg);
  graphics.moveTo(FLOW_DIMS.labelW - 0.5, top).lineTo(FLOW_DIMS.labelW - 0.5, bottom).stroke({ color: CANVAS.beatLine, width: 1 });
  for (let index = range.first; index <= range.last; index += 1) {
    const bar = flowmap.bars[index];
    const rowY = rowTop(layout, index);
    const height = rowHeight(layout, index);
    const middle = rowY + height / 2;
    const compact = height < 26;
    const selected = isSelected(state, bar.bar_no);
    if (selected) graphics.rect(0, rowY, 3, height).fill({ color: CANVAS.accent, alpha: state.loop ? 1 : 0.8 });
    // Thin rows (bars without words, or zoomed out) number only every 4th bar.
    const showNumber = selected || (bar.empty ? height >= 14 || bar.bar_no % 4 === 1 : !compact || bar.bar_no % 4 === 1);
    if (showNumber) {
      const color = selected ? CANVAS.labelStrong : bar.empty ? CANVAS.otherRhyme : CANVAS.label;
      pool.place(selected ? 'labelStrong' : 'label', String(bar.bar_no), FLOW_DIMS.labelW - 8, middle, color, {
        anchorX: 1,
        anchorY: 0.5,
        size: compact ? 9 : 11,
      });
    }
    if (state.layers.markers && !bar.empty) {
      (state.markers.get(bar.bar_no) || []).forEach((marker, slot) => drawMarker(graphics, marker.kind, MARKER_X0 + slot * MARKER_STEP, middle));
    }
    if (hover.rowIndex === index && !compact && !bar.empty) drawPlayButton(graphics, middle, hover.onPlayButton);
  }
}

function drawMarker(graphics: Graphics, kind: MarkerKind, x: number, y: number) {
  if (kind === 'switch') {
    graphics.moveTo(x - 2, y - 4).lineTo(x + 3, y).lineTo(x - 2, y + 4).stroke({ color: CANVAS.markerSwitch, width: 1.6 });
  } else if (kind === 'cut') {
    graphics.rect(x - 3, y - 3, 6, 6).fill(CANVAS.markerCut);
  } else if (kind === 'drift') {
    graphics.poly([x, y - 4, x + 4, y + 3.5, x - 4, y + 3.5]).fill(CANVAS.markerDrift);
  } else {
    graphics.circle(x, y, 3.2).fill(CANVAS.markerPocket);
  }
}

function drawPlayButton(graphics: Graphics, centerY: number, active: boolean) {
  const { x, radius } = PLAY_BUTTON;
  graphics.circle(x, centerY, radius - 1).fill({ color: active ? CANVAS.accent : 0xffffff, alpha: active ? 1 : 0.1 });
  graphics.poly([x - 2.5, centerY - 4, x - 2.5, centerY + 4, x + 4, centerY]).fill({ color: 0xffffff, alpha: active ? 1 : 0.85 });
}

export function hitPlayButton(x: number, y: number, rowMiddle: number): boolean {
  return Math.hypot(x - PLAY_BUTTON.x, y - rowMiddle) <= PLAY_BUTTON.radius + 1;
}

export function markerAt(state: RenderState, rowIndex: number, x: number): MarkerKind | null {
  if (!state.layers.markers) return null;
  const markers = state.markers.get(state.flowmap.bars[rowIndex]?.bar_no) || [];
  const slot = Math.round((x - MARKER_X0) / MARKER_STEP);
  return Math.abs(x - (MARKER_X0 + slot * MARKER_STEP)) <= 5 ? markers[slot]?.kind ?? null : null;
}
