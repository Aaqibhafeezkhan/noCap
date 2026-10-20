import { BitmapFontManager, BitmapText, Container, TextStyle } from 'pixi.js';
import { FONT_MONO, FONT_UI } from '../theme';

export type TextKind = 'bold' | 'regular' | 'tag' | 'label' | 'labelStrong' | 'header';

const STYLE_SPECS: Record<TextKind, { fontFamily: string; fontSize: number; fontWeight: '400' | '500' | '600' | '700' }> = {
  bold: { fontFamily: FONT_UI, fontSize: 12, fontWeight: '700' },
  regular: { fontFamily: FONT_UI, fontSize: 12, fontWeight: '500' },
  tag: { fontFamily: FONT_MONO, fontSize: 9, fontWeight: '500' },
  label: { fontFamily: FONT_MONO, fontSize: 11, fontWeight: '400' },
  labelStrong: { fontFamily: FONT_MONO, fontSize: 11, fontWeight: '700' },
  header: { fontFamily: FONT_MONO, fontSize: 11, fontWeight: '500' },
};

// Glyph atlases are rendered once per family/weight and scaled per size, so render them
// sharp enough for retina screens and the largest label size.
BitmapFontManager.defaultOptions.resolution = Math.max(2, window.devicePixelRatio || 1) * 1.5;

/** Text for one canvas layer, rebuilt on every redraw.
 *
 *  Reusing text objects across redraws is unreliable in Pixi v8: a canvas Text kept a
 *  stale texture after its string changed, and a BitmapText that was emptied and
 *  refilled (zooming out and back in) stopped rendering. BitmapText draws from a shared
 *  glyph atlas, so creating fresh ones per redraw is cheap; redraws only happen when the
 *  visible rows, zoom or selection change. Colour comes from `tint`, so a few cached
 *  styles cover every rhyme colour. */
export class TextPool {
  readonly container = new Container();
  private readonly styles = new Map<string, TextStyle>();

  begin() {
    for (const child of this.container.removeChildren()) child.destroy();
  }

  place(kind: TextKind, text: string, x: number, y: number, tint: number, options: { size?: number; anchorX?: number; anchorY?: number; alpha?: number } = {}) {
    const item = new BitmapText({ text, style: this.style(kind, options.size) });
    item.anchor.set(options.anchorX ?? 0, options.anchorY ?? 0);
    item.position.set(Math.round(x), Math.round(y));
    item.tint = tint;
    item.alpha = options.alpha ?? 1;
    this.container.addChild(item);
    return item;
  }

  /** Kept so callers can mark the end of a redraw; nothing is pooled any more. */
  end() {}

  private style(kind: TextKind, size?: number): TextStyle {
    const fontSize = size ?? STYLE_SPECS[kind].fontSize;
    const key = `${kind}:${fontSize}`;
    let style = this.styles.get(key);
    if (!style) {
      style = new TextStyle({ ...STYLE_SPECS[kind], fontSize, fill: 0xffffff });
      this.styles.set(key, style);
    }
    return style;
  }
}
