import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import type { RhymeStyles } from '../../flow/colors';
import { buildSyllableRows, computeLayout, rowTop } from '../../flow/layout';
import type { BarMarker } from '../../flow/markers';
import { FlowRenderer } from '../../flow/pixi/renderer';
import { NO_HOVER, type BarRange, type LayerState, type RenderState } from '../../flow/pixi/types';
import { t } from '../../i18n';
import type { FlowMap, FlowSyllable } from '../../types';
import { FlowTooltip, type TooltipState } from './FlowTooltips';
import { hitAt } from './stageHit';
import { useFollowPlayhead } from './useFollowPlayhead';

export interface FlowStageProps {
  flowmap: FlowMap;
  styles: RhymeStyles;
  markers: Map<number, BarMarker[]>;
  zoom: number;
  layers: LayerState;
  activeRhyme: string | null;
  selection: BarRange | null;
  loop: boolean;
  audioTimeRef: MutableRefObject<number>;
  scrollRequest: { bar: number; id: number } | null;
  onSelectBar: (barNo: number, extend: boolean) => void;
  onPlayBar: (barNo: number) => void;
  onPlayWord: (syllable: FlowSyllable) => void;
  onZoomStep: (direction: 1 | -1) => void;
}

export function FlowStage(props: FlowStageProps) {
  const { flowmap, styles, markers, zoom, layers, activeRhyme, selection, loop } = props;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<FlowRenderer | null>(null);
  const stateRef = useRef<RenderState | null>(null);
  const anchorRef = useRef<{ row: number; offset: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState({ width: 900, height: 600 });
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const layout = useMemo(() => computeLayout(flowmap, view.width, zoom), [flowmap, view.width, zoom]);
  const rows = useMemo(() => buildSyllableRows(flowmap, layout), [flowmap, layout]);
  const beatsByBar = useMemo(() => {
    const map = new Map<number, FlowMap['beats']>();
    for (const beat of flowmap.beats) map.set(beat.bar_no, [...(map.get(beat.bar_no) || []), beat]);
    return map;
  }, [flowmap]);
  const maxDensity = useMemo(() => Math.max(0.01, ...flowmap.bars.map((bar) => bar.density)), [flowmap]);
  const state = useMemo<RenderState>(() => ({
    flowmap, layout, rows, styles, markers, beatsByBar, maxDensity, activeRhyme, layers, selection, loop,
  }), [flowmap, layout, rows, styles, markers, beatsByBar, maxDensity, activeRhyme, layers, selection, loop]);
  stateRef.current = state;

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.max(360, Math.floor(entry.contentRect.width));
      const height = Math.max(200, Math.floor(entry.contentRect.height));
      setView((current) => (current.width === width && current.height === height ? current : { width, height }));
    });
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const renderer = new FlowRenderer();
    let disposed = false;
    void renderer.init(host, view.width, view.height).then((ok) => {
      if (disposed) return renderer.destroy();
      if (!ok) return;
      rendererRef.current = renderer;
      setReady(true);
    });
    return () => {
      disposed = true;
      rendererRef.current = null;
      renderer.destroy();
      setReady(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (ready) rendererRef.current?.setViewport(view.width, view.height); }, [ready, view]);

  useEffect(() => {
    if (!ready) return;
    const scroller = scrollRef.current;
    const anchor = anchorRef.current;
    if (scroller && anchor) {
      scroller.scrollTop = Math.max(0, rowTop(layout, anchor.row) - anchor.offset);
      anchorRef.current = null;
    }
    rendererRef.current?.setState(state);
    rendererRef.current?.setScroll(scroller?.scrollLeft || 0, scroller?.scrollTop || 0);
  }, [ready, state, layout]);

  useFollowPlayhead({ ready, rendererRef, scrollRef, stateRef, audioTimeRef: props.audioTimeRef, scrollRequest: props.scrollRequest });

  function onScroll() {
    const scroller = scrollRef.current;
    if (scroller) rendererRef.current?.setScroll(scroller.scrollLeft, scroller.scrollTop);
    setTooltip(null);
  }

  function locate(event: { clientX: number; clientY: number }) {
    const scroller = scrollRef.current;
    const current = stateRef.current;
    if (!scroller || !current) return null;
    const bounds = scroller.getBoundingClientRect();
    return hitAt(current, event.clientX - bounds.left, event.clientY - bounds.top, scroller.scrollLeft, scroller.scrollTop);
  }

  function onMouseMove(event: React.MouseEvent) {
    const hit = locate(event);
    if (!hit) return;
    rendererRef.current?.setHover({ rowIndex: hit.rowIndex, rect: hit.rect, onPlayButton: hit.onPlayButton });
    const bar = hit.rowIndex !== null ? flowmap.bars[hit.rowIndex] : null;
    const content = hit.rect ? { kind: 'syllable' as const, rect: hit.rect }
      : hit.marker ? { kind: 'marker' as const, marker: hit.marker }
        : hit.onDensity && bar ? { kind: 'bar' as const, bar } : null;
    setTooltip(content ? { x: event.clientX + 14, y: event.clientY + 14, content } : null);
    event.currentTarget.classList.toggle('is-pointing', !!(hit.rect || hit.onPlayButton));
  }

  function onMouseLeave() {
    rendererRef.current?.setHover(NO_HOVER);
    setTooltip(null);
  }

  function onClick(event: React.MouseEvent) {
    const hit = locate(event);
    if (!hit || hit.rowIndex === null) return;
    const barNo = flowmap.bars[hit.rowIndex].bar_no;
    if (hit.onPlayButton) return props.onPlayBar(barNo);
    props.onSelectBar(barNo, event.shiftKey);
    if (hit.rect) props.onPlayWord(hit.rect.syllable);
  }

  // Pinch / ⌘+wheel zoom keeps the bar under the pointer in place. Native listener:
  // React's wheel handler is passive and cannot stop the page from zooming.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    let lastStep = 0;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const now = performance.now();
      if (now - lastStep < 140) return;
      lastStep = now;
      const hit = locate(event);
      const current = stateRef.current;
      if (hit && hit.rowIndex !== null && current) {
        anchorRef.current = { row: hit.rowIndex, offset: rowTop(current.layout, hit.rowIndex) - scroller.scrollTop };
      }
      propsRef.current.onZoomStep(event.deltaY < 0 ? 1 : -1);
    };
    scroller.addEventListener('wheel', onWheel, { passive: false });
    return () => scroller.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <div
      ref={scrollRef}
      className="flow-scroll"
      onScroll={onScroll}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      role="application"
      aria-label={t('flow.canvasAria', { title: flowmap.metadata.title, bars: flowmap.bars.length })}
    >
      <div className="flow-spacer" style={{ width: Math.max(layout.width, view.width), height: Math.max(layout.height, view.height) }}>
        <div ref={hostRef} className="flow-viewport" style={{ width: view.width, height: view.height }} />
      </div>
      {tooltip && <FlowTooltip tooltip={tooltip} styles={styles} />}
    </div>
  );
}
