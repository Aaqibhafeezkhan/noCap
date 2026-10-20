import { useState } from 'react';
import type { FlowMap, FlowSyllable } from '../types';
import { DEFAULT_ZOOM, nextZoom, ZOOM_LEVELS } from '../flow/layout';
import { getBarTimeRange, getRangeTimeRange, getWordTimeRange, type PlayRange } from '../flow/playbackRanges';
import { DEFAULT_LAYERS, type BarRange, type LayerState } from '../flow/pixi/types';
import { usePersistentState } from './usePersistentState';

export type InspectorTab = 'track' | 'bar' | 'rhymes';

export function useViewerState() {
  const [source, setSource] = useState<'mix' | 'vocals'>('mix');
  const [activeRhyme, setActiveRhyme] = useState<string | null>(null);
  const [playRange, setPlayRange] = useState<PlayRange | null>(null);
  const [syncOffset, setSyncOffset] = useState(0);
  const [selection, setSelection] = useState<BarRange | null>(null);
  const [anchorBar, setAnchorBar] = useState<number | null>(null);
  const [loop, setLoop] = useState(false);
  const [scrollRequest, setScrollRequest] = useState<{ bar: number; id: number } | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('track');
  const [zoom, setZoom] = usePersistentState<number>('nocap.zoom', DEFAULT_ZOOM);
  const [layers, setLayers] = usePersistentState<LayerState>('nocap.layers', DEFAULT_LAYERS);
  const [inspectorOpen, setInspectorOpen] = usePersistentState('nocap.inspectorOpen', true);

  function reset() {
    setSource('mix');
    setActiveRhyme(null);
    setPlayRange(null);
    setSyncOffset(0);
    setSelection(null);
    setAnchorBar(null);
    setLoop(false);
    setScrollRequest(null);
    setInspectorTab('track');
  }

  function shifted(flowmap: FlowMap, range: Omit<PlayRange, 'id'> | null): PlayRange | null {
    if (!range) return null;
    const start = Math.max(0, range.start - syncOffset);
    const end = Math.min(flowmap.metadata.duration || range.end, Math.max(start + 0.05, range.end - syncOffset));
    return { id: Date.now(), start, end };
  }

  function selectBar(barNo: number, extend = false) {
    if (extend && anchorBar !== null) {
      setSelection({ start: Math.min(anchorBar, barNo), end: Math.max(anchorBar, barNo) });
    } else {
      setSelection({ start: barNo, end: barNo });
      setAnchorBar(barNo);
    }
    setInspectorTab('bar');
  }

  function focusBar(barNo: number) {
    selectBar(barNo);
    setScrollRequest({ bar: barNo, id: Date.now() });
  }

  function clearSelection() {
    setSelection(null);
    setAnchorBar(null);
    setLoop(false);
  }

  function stepBar(flowmap: FlowMap, direction: 1 | -1) {
    const current = selection ? (direction > 0 ? selection.end : selection.start) : null;
    const index = current === null ? (direction > 0 ? -1 : flowmap.bars.length) : flowmap.bars.findIndex((bar) => bar.bar_no === current);
    const next = flowmap.bars[Math.max(0, Math.min(flowmap.bars.length - 1, index + direction))];
    if (next) focusBar(next.bar_no);
  }

  return {
    source, setSource,
    activeRhyme, setActiveRhyme,
    playRange,
    syncOffset, setSyncOffset,
    adjustSyncOffset: (delta: number) => setSyncOffset((value) => Math.max(-2, Math.min(2, Number((value + delta).toFixed(3))))),
    selection, selectBar, focusBar, clearSelection, stepBar,
    loop, setLoop,
    loopRange: (flowmap: FlowMap) => (loop && selection ? shifted(flowmap, getRangeTimeRange(flowmap, selection.start, selection.end)) : null),
    scrollRequest,
    inspectorTab, setInspectorTab,
    inspectorOpen, setInspectorOpen,
    zoom,
    setZoom: (value: number) => setZoom(Math.max(ZOOM_LEVELS[0], Math.min(ZOOM_LEVELS[ZOOM_LEVELS.length - 1], value))),
    zoomStep: (direction: 1 | -1) => setZoom((value) => nextZoom(value, direction)),
    layers, setLayers,
    reset,
    playBar: (flowmap: FlowMap, barNo: number) => setPlayRange(shifted(flowmap, getBarTimeRange(flowmap, barNo))),
    playWord: (flowmap: FlowMap, syllable: FlowSyllable) => setPlayRange(shifted(flowmap, getWordTimeRange(flowmap, syllable))),
    playSelection: (flowmap: FlowMap) => {
      if (selection) setPlayRange(shifted(flowmap, getRangeTimeRange(flowmap, selection.start, selection.end)));
    },
  };
}

export type ViewerState = ReturnType<typeof useViewerState>;
