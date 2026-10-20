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

interface Bucket {
  items: BitmapText[];
  used: number;
}

// Glyph atlases are rendered once per family/weight and scaled per size, so render them
// sharp enough for retina screens and the largest label size.
BitmapFontManager.defaultOptions.resolution = Math.max(2, window.devicePixelRatio || 1) * 1.5;

/** Reuses text objects between redraws. BitmapText draws from a shared glyph atlas:
 *  canvas Text keeps one texture per string, and reusing those objects on fast scroll
 *  left stale textures on screen. Each item keeps one style for life and is emptied,
 *  not hidden, when unused. Colour comes from `tint`, so a few styles cover every rhyme colour. */
export class TextPool {
  readonly container = new Container();
  private readonly buckets = new Map<string, Bucket>();
  private readonly styles = new Map<string, TextStyle>();

  begin() {
    for (const bucket of this.buckets.values()) bucket.used = 0;
  }

  place(kind: TextKind, text: string, x: number, y: number, tint: number, options: { size?: number; anchorX?: number; anchorY?: number; alpha?: number } = {}) {
    const key = `${kind}:${options.size ?? STYLE_SPECS[kind].fontSize}`;
    const item = this.next(key, kind, options.size);
    if (item.text !== text) item.text = text;
    item.anchor.set(options.anchorX ?? 0, options.anchorY ?? 0);
    item.position.set(Math.round(x), Math.round(y));
    item.tint = tint;
    item.alpha = options.alpha ?? 1;
    return item;
  }

  end() {
    for (const bucket of this.buckets.values()) {
      for (let index = bucket.used; index < bucket.items.length; index += 1) {
        if (bucket.items[index].text !== '') bucket.items[index].text = '';
      }
    }
  }

  private next(key: string, kind: TextKind, size?: number): BitmapText {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { items: [], used: 0 };
      this.buckets.set(key, bucket);
    }
    if (bucket.used < bucket.items.length) return bucket.items[bucket.used++];
    const item = new BitmapText({ text: '', style: this.style(key, kind, size) });
    this.container.addChild(item);
    bucket.items.push(item);
    bucket.used += 1;
    return item;
  }

  private style(key: string, kind: TextKind, size?: number): TextStyle {
    let style = this.styles.get(key);
    if (!style) {
      style = new TextStyle({ ...STYLE_SPECS[kind], fontSize: size ?? STYLE_SPECS[kind].fontSize, fill: 0xffffff });
      this.styles.set(key, style);
    }
    return style;
  }
}
