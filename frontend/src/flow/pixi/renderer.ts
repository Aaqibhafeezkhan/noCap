import { Application, Container, Graphics } from 'pixi.js';
import { FLOW_DIMS, barIndexMap, rowAtY, type SyllableRect } from '../layout';
import { CANVAS, loadCanvasFonts } from '../theme';
import { drawBlocks } from './blocks';
import { drawHeader, drawLabels } from './chrome';
import { drawHover, drawPlayhead, syllableTimeIndex } from './overlay';
import { getPixiCanvas, safeDestroyPixiApp } from './pixiApp';
import { drawRows } from './rows';
import { TextPool } from './textPool';
import { NO_HOVER, type HoverState, type RenderState, type RowRange } from './types';

const OVERSCAN = 8;

/** Virtualised flow map: the canvas is only as big as the viewport. Content layers
 *  move with the scroll position and rows are redrawn only when the visible range
 *  leaves the rows that were last drawn. */
export class FlowRenderer {
  private app = new Application();
  private world = new Container();
  private rowsLayer = new Graphics();
  private blockLayer = new Graphics();
  private blockText = new TextPool();
  private hoverLayer = new Graphics();
  private playLayer = new Graphics();
  private labels = new Container();
  private labelLayer = new Graphics();
  private labelText = new TextPool();
  private header = new Container();
  private headerLayer = new Graphics();
  private headerText = new TextPool();
  private corner = new Graphics();
  private state: RenderState | null = null;
  private drawn: RowRange | null = null;
  private hover: HoverState = NO_HOVER;
  private scroll = { x: 0, y: 0 };
  private view = { width: 0, height: 0 };
  private rowOf = new Map<number, number>();
  private timeIndex: SyllableRect[] = [];
  private ready = false;

  async init(host: HTMLElement, width: number, height: number): Promise<boolean> {
    await Promise.all([
      this.app.init({ width, height, background: CANVAS.bg, antialias: true, resolution: window.devicePixelRatio || 1, autoDensity: true }),
      loadCanvasFonts(),
    ]);
    const canvas = getPixiCanvas(this.app);
    if (!canvas) return false;
    canvas.className = 'flow-canvas';
    host.replaceChildren(canvas);
    this.world.addChild(this.rowsLayer, this.blockLayer, this.blockText.container, this.hoverLayer, this.playLayer);
    this.labels.addChild(this.labelLayer, this.labelText.container);
    this.header.addChild(this.headerLayer, this.headerText.container);
    this.app.stage.addChild(this.world, this.labels, this.header, this.corner);
    this.view = { width, height };
    this.ready = true;
    this.redraw(true);
    return true;
  }

  get canvas(): HTMLCanvasElement | null {
    return this.ready ? getPixiCanvas(this.app) : null;
  }

  addTicker(callback: () => void) {
    this.app.ticker.add(callback);
  }

  setState(state: RenderState) {
    const trackChanged = this.state?.flowmap !== state.flowmap || this.state?.rows !== state.rows;
    this.state = state;
    if (trackChanged) {
      this.rowOf = barIndexMap(state.flowmap.bars);
      this.timeIndex = syllableTimeIndex(state.rows);
    }
    this.redraw(true);
  }

  setViewport(width: number, height: number) {
    if (!this.ready || (width === this.view.width && height === this.view.height)) return;
    this.view = { width, height };
    this.app.renderer.resize(width, height);
    this.redraw(true);
  }

  setScroll(x: number, y: number) {
    this.scroll = { x, y };
    this.position();
    const needed = this.visibleRange();
    if (!needed || !this.drawn || needed.first < this.drawn.first || needed.last > this.drawn.last) this.redraw(false);
  }

  setHover(hover: HoverState) {
    const labelsChanged = hover.rowIndex !== this.hover.rowIndex || hover.onPlayButton !== this.hover.onPlayButton;
    this.hover = hover;
    if (!this.ready || !this.state || !this.drawn) return;
    drawHover(this.hoverLayer, this.state, this.drawn, hover);
    // The label column only shows the hovered row's play button, so skip it otherwise.
    if (labelsChanged) this.drawLabelColumn();
  }

  /** Draws the playhead and returns the row index of the bar being played. */
  drawPlayhead(time: number): number | null {
    if (!this.ready || !this.state) return null;
    return drawPlayhead(this.playLayer, this.state, this.rowOf, this.timeIndex, time);
  }

  destroy() {
    this.ready = false;
    safeDestroyPixiApp(this.app);
  }

  private position() {
    this.world.position.set(-this.scroll.x, -this.scroll.y);
    this.labels.position.set(0, -this.scroll.y);
    this.header.position.set(-this.scroll.x, 0);
  }

  private visibleRange(): RowRange | null {
    const state = this.state;
    if (!state || state.flowmap.bars.length === 0) return null;
    const count = state.flowmap.bars.length;
    const first = rowAtY(state.layout, count, Math.max(FLOW_DIMS.headerH, this.scroll.y)) ?? 0;
    const last = rowAtY(state.layout, count, this.scroll.y + this.view.height) ?? count - 1;
    return { first, last };
  }

  private redraw(full: boolean) {
    if (!this.ready || !this.state) return;
    const visible = this.visibleRange();
    this.position();
    if (full) this.drawHeaderLayer();
    if (!visible) return;
    const count = this.state.flowmap.bars.length;
    const range = { first: Math.max(0, visible.first - OVERSCAN), last: Math.min(count - 1, visible.last + OVERSCAN) };
    this.drawn = range;
    this.rowsLayer.clear();
    drawRows(this.rowsLayer, this.state, range);
    this.blockLayer.clear();
    this.blockText.begin();
    drawBlocks(this.blockLayer, this.blockText, this.state, range);
    this.blockText.end();
    drawHover(this.hoverLayer, this.state, range, this.hover);
    this.drawLabelColumn();
  }

  private drawLabelColumn() {
    if (!this.state || !this.drawn) return;
    this.labelLayer.clear();
    this.labelText.begin();
    drawLabels(this.labelLayer, this.labelText, this.state, this.drawn, this.hover);
    this.labelText.end();
  }

  private drawHeaderLayer() {
    if (!this.state) return;
    this.headerLayer.clear();
    this.headerText.begin();
    drawHeader(this.headerLayer, this.headerText, this.state);
    this.headerText.end();
    this.corner.clear();
    this.corner.rect(0, 0, FLOW_DIMS.labelW, FLOW_DIMS.headerH).fill(CANVAS.header);
    this.corner.moveTo(0, FLOW_DIMS.headerH - 0.5).lineTo(FLOW_DIMS.labelW, FLOW_DIMS.headerH - 0.5).stroke({ color: CANVAS.beatLine, width: 1 });
  }
}
