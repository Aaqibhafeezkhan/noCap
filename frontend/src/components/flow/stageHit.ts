import { FLOW_DIMS, rowAtY, rowTop, type SyllableRect } from '../../flow/layout';
import type { MarkerKind } from '../../flow/markers';
import { hitPlayButton, markerAt } from '../../flow/pixi/chrome';
import type { RenderState } from '../../flow/pixi/types';

export interface StageHit {
  rowIndex: number | null;
  rect: SyllableRect | null;
  onPlayButton: boolean;
  marker: MarkerKind | null;
  onDensity: boolean;
}

const EMPTY: StageHit = { rowIndex: null, rect: null, onPlayButton: false, marker: null, onDensity: false };

/** Resolves a point in canvas (viewport) coordinates against the scrolled content. */
export function hitAt(state: RenderState, viewX: number, viewY: number, scrollX: number, scrollY: number): StageHit {
  if (viewY < FLOW_DIMS.headerH) return EMPTY;
  const { layout } = state;
  const contentY = viewY + scrollY;
  const rowIndex = rowAtY(layout, state.flowmap.bars.length, contentY);
  if (rowIndex === null) return EMPTY;
  const middle = rowTop(layout, rowIndex) + layout.barH / 2;
  if (viewX < FLOW_DIMS.labelW) {
    return {
      ...EMPTY,
      rowIndex,
      onPlayButton: layout.barH >= 26 && hitPlayButton(viewX, contentY, middle),
      marker: markerAt(state, rowIndex, viewX),
    };
  }
  const contentX = viewX + scrollX;
  const densityX = FLOW_DIMS.labelW + layout.gridW;
  if (contentX >= densityX) return { ...EMPTY, rowIndex, onDensity: state.layers.density };
  const rect = (state.rows[rowIndex] || []).find((item) => (
    contentX >= item.x - 2 && contentX <= item.x + item.width + 2 && contentY >= item.y - 2 && contentY <= item.y + item.height + 2
  )) || null;
  return { ...EMPTY, rowIndex, rect };
}
