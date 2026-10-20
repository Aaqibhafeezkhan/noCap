import type { Graphics } from 'pixi.js';
import { rhymeColor } from '../colors';
import type { SyllableRect } from '../layout';
import { CANVAS } from '../theme';
import type { TextPool } from './textPool';
import type { RenderState, RowRange } from './types';

const POCKET_MIN_MS = 10;

/** Syllable blocks. Text mode: stressed = filled + bold text, unstressed = outline +
 *  regular text, rhyme letter above, pocket notch below. Block mode: plain blocks
 *  where height separates stressed from unstressed. */
export function drawBlocks(graphics: Graphics, pool: TextPool, state: RenderState, range: RowRange) {
  const { layout } = state;
  const fontSize = Math.min(13, Math.max(10, Math.round(layout.barH * 0.24)));
  for (let index = range.first; index <= range.last; index += 1) {
    for (const rect of state.rows[index] || []) {
      const look = blockLook(state, rect);
      if (!layout.showText) {
        graphics.roundRect(rect.x, rect.y, rect.width, rect.height, 2).fill({ color: look.color, alpha: look.dimmed ? 0.5 : rect.syllable.stress ? 1 : 0.55 });
        continue;
      }
      drawTextBlock(graphics, pool, rect, look, fontSize);
      if (!look.dimmed) drawPocketNotch(graphics, rect);
    }
  }
}

interface BlockLook {
  color: number;
  dimmed: boolean;
  rhymed: boolean;
  letter: string;
}

export function blockLook(state: RenderState, rect: SyllableRect): BlockLook {
  const group = rect.syllable.rhyme_group;
  const dimmed = !!state.activeRhyme && group !== state.activeRhyme;
  const style = group ? state.styles.get(group) : undefined;
  return {
    color: dimmed ? CANVAS.dimmed : rhymeColor(state.styles, group),
    dimmed,
    rhymed: !!group,
    letter: style?.label || '',
  };
}

function drawTextBlock(graphics: Graphics, pool: TextPool, rect: SyllableRect, look: BlockLook, fontSize: number) {
  const stressed = rect.syllable.stress;
  const radius = 4;
  if (stressed) {
    graphics.roundRect(rect.x, rect.y, rect.width, rect.height, radius).fill({ color: look.color, alpha: look.dimmed ? 0.6 : 1 });
  } else {
    graphics.roundRect(rect.x + 0.5, rect.y + 0.5, rect.width - 1, rect.height - 1, radius)
      .fill({ color: look.color, alpha: look.dimmed ? 0.12 : 0.16 })
      .stroke({ color: look.color, width: 1.25, alpha: look.dimmed ? 0.4 : 0.9 });
  }
  const text = fitLabel(rect.label, rect.width - 6, fontSize);
  if (text) {
    const tint = textTint(stressed, look);
    pool.place(stressed ? 'bold' : 'regular', text, rect.x + rect.width / 2, rect.y + rect.height / 2, tint, {
      size: fontSize,
      anchorX: 0.5,
      anchorY: 0.5,
      alpha: look.dimmed ? 0.55 : 1,
    });
  }
  if (look.rhymed && look.letter && !look.dimmed && rect.width >= 12) {
    pool.place('tag', look.letter, rect.x + 1, rect.y - 11, look.color, { alpha: 0.9 });
  }
}

function textTint(stressed: boolean, look: BlockLook): number {
  if (look.dimmed) return CANVAS.textMuted;
  if (!stressed) return look.rhymed ? look.color : CANVAS.textMuted;
  return look.rhymed ? CANVAS.textOnFill : CANVAS.text;
}

/** Thin line from the block centre to the nearest 16th grid line: blue when the
 *  syllable lands ahead of the grid, orange when it lands behind. */
function drawPocketNotch(graphics: Graphics, rect: SyllableRect) {
  if (Math.abs(rect.pocketMs) < POCKET_MIN_MS) return;
  const centerX = rect.cx;
  const gridX = centerX + rect.pocketDx;
  const y = rect.y + rect.height + 4;
  const color = rect.pocketMs < 0 ? CANVAS.pocketAhead : CANVAS.pocketBehind;
  graphics.moveTo(gridX, y - 2).lineTo(gridX, y + 2).stroke({ color, width: 1, alpha: 0.9 });
  graphics.moveTo(gridX, y).lineTo(centerX, y).stroke({ color, width: 1.5, alpha: 0.85 });
}

/** Cuts the label to what fits, using an average glyph width instead of measuring. */
export function fitLabel(label: string, room: number, fontSize: number): string {
  if (!label || room < fontSize * 0.55) return '';
  const glyph = fontSize * 0.58;
  const max = Math.floor(room / glyph);
  if (label.length <= max) return label;
  return max >= 2 ? label.slice(0, max) : label.slice(0, 1);
}
