import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeleteTrackModal } from './components/DeleteTrackModal';
import { FlowView } from './components/flow/FlowView';
import { ExportMenu } from './components/header/ExportMenu';
import { LayersMenu } from './components/header/LayersMenu';
import { TopBar, type AppMode } from './components/header/TopBar';
import { LibraryScreen } from './components/library/LibraryScreen';
import { PlayerBar } from './components/player/PlayerBar';
import { restoreLyrics, saveLyrics } from './api/lyrics';
import { LyricsScreen } from './components/lyrics/LyricsScreen';
import { ReportScreen } from './components/report/ReportScreen';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import { Toast, type ToastState } from './components/Toast';
import { buildRhymeStyles } from './flow/colors';
import { DEFAULT_ZOOM } from './flow/layout';
import { computeMarkers } from './flow/markers';
import { useAnalysis } from './hooks/useAnalysis';
import type { PlayerApi } from './hooks/useAudioPlayer';
import { useLibrary } from './hooks/useLibrary';
import { useShortcuts } from './hooks/useShortcuts';
import { useViewerState } from './hooks/useViewerState';
import { t } from './i18n';
import { sampleFlowmap } from './sampleFlowmap';
import type { FlowMap } from './types';

interface OpenTrack {
  flowmap: FlowMap;
  id: string | null;
  hasAudio: boolean;
  hasVocals: boolean;
  isDemo: boolean;
}

export function App() {
  const [track, setTrack] = useState<OpenTrack | null>(null);
  const [mode, setMode] = useState<AppMode>('library');
  const [error, setError] = useState('');
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<ToastState | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const audioTimeRef = useRef(0);
  const playerApi = useRef<PlayerApi | null>(null);
  const library = useLibrary();
  const viewer = useViewerState();
  const flowmap = track?.flowmap ?? null;
  const styles = useMemo(() => (flowmap ? buildRhymeStyles(flowmap) : new Map()), [flowmap]);
  const markers = useMemo(() => (flowmap ? computeMarkers(flowmap.bars) : new Map()), [flowmap]);

  const analysis = useAnalysis((finished) => {
    void library.refreshLibrary();
    if (!finished) return;
    setNewIds((current) => new Set(current).add(finished.id));
    setToast({ id: Date.now(), message: t('toast.analysisDone', { title: finished.title }), action: { label: t('toast.open'), run: () => void openTrack(finished.id) } });
  });

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('sample') === '1') openDemo();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode === 'library') void library.refreshLibrary();
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const editableId = track && !track.isDemo ? track.id : null;

  /** Swap in the re-analysed track after its lyrics were edited or restored. */
  async function applyLyrics(update: Promise<{ flowmap: FlowMap }>) {
    const { flowmap: next } = await update;
    setTrack((current) => (current ? { ...current, flowmap: next } : current));
  }

  function show(next: OpenTrack) {
    audioTimeRef.current = 0;
    viewer.reset();
    setTrack(next);
    setMode('viewer');
  }

  async function openTrack(trackId: string) {
    setError('');
    try {
      const result = await library.openTrack(trackId);
      show({ flowmap: result.flowmap, id: trackId, hasAudio: result.hasAudio, hasVocals: result.hasVocals, isDemo: false });
      setNewIds((current) => {
        const next = new Set(current);
        next.delete(trackId);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function openDemo() {
    show({ flowmap: sampleFlowmap(), id: null, hasAudio: false, hasVocals: false, isDemo: true });
  }

  async function confirmDelete() {
    const deleted = library.deleteCandidate?.id;
    await library.confirmDeleteTrack();
    if (deleted && deleted === track?.id) setTrack(null);
  }

  const closeToast = useCallback(() => setToast(null), []);
  const inTrack = !!flowmap && mode !== 'library' && mode !== 'lyrics'; // lyrics is a reading view, no player
  const loopRange = flowmap ? viewer.loopRange(flowmap) : null;

  useShortcuts({
    togglePlay: inTrack ? () => playerApi.current?.toggle() : undefined,
    playSelection: inTrack && mode === 'viewer' ? () => viewer.playSelection(flowmap!) : undefined,
    toggleLoop: inTrack && viewer.selection ? () => viewer.setLoop(!viewer.loop) : undefined,
    toggleSource: inTrack && track?.hasVocals ? () => viewer.setSource(viewer.source === 'mix' ? 'vocals' : 'mix') : undefined,
    stepBar: mode === 'viewer' && flowmap ? (direction) => viewer.stepBar(flowmap, direction) : undefined,
    scroll: mode === 'viewer' ? (direction) => document.querySelector('.flow-scroll')?.scrollBy({ top: direction * 120 }) : undefined,
    clear: mode === 'viewer' ? () => (viewer.activeRhyme ? viewer.setActiveRhyme(null) : viewer.clearSelection()) : undefined,
    zoom: mode === 'viewer' ? (direction) => (direction === 0 ? viewer.setZoom(DEFAULT_ZOOM) : viewer.zoomStep(direction)) : undefined,
    toggleInspector: mode === 'viewer' ? () => viewer.setInspectorOpen(!viewer.inspectorOpen) : undefined,
    screen: (index) => setMode(!flowmap || index === 4 ? 'library' : (['viewer', 'report', 'lyrics'] as const)[index - 1]),
    help: () => setShowShortcuts(true),
  });

  return (
    <div className={`app-shell mode-${mode}`}>
      <TopBar
        mode={mode}
        flowmap={flowmap}
        isDemo={!!track?.isDemo}
        onModeChange={setMode}
        inspectorOpen={viewer.inspectorOpen}
        onInspectorToggle={() => viewer.setInspectorOpen(!viewer.inspectorOpen)}
        actions={flowmap && (
          <>
            {mode === 'viewer' && <LayersMenu layers={viewer.layers} onChange={viewer.setLayers} />}
            <ExportMenu flowmap={flowmap} />
          </>
        )}
      />

      {mode === 'library' && (
        <LibraryScreen
          tracks={library.library}
          analysis={analysis}
          newIds={newIds}
          openId={track?.id ?? null}
          error={error}
          onOpen={(id) => void openTrack(id)}
          onDelete={library.setDeleteCandidate}
          onDemo={openDemo}
        />
      )}
      {mode === 'viewer' && flowmap && (
        <FlowView flowmap={flowmap} styles={styles} markers={markers} viewer={viewer} audioTimeRef={audioTimeRef} isDemo={!!track?.isDemo} />
      )}
      {mode === 'report' && flowmap && <ReportScreen flowmap={flowmap} onOpenBar={(barNo) => { setMode('viewer'); viewer.focusBar(barNo); }} />}
      {mode === 'lyrics' && flowmap && (
        <LyricsScreen
          flowmap={flowmap}
          styles={styles}
          onOpenBar={(barNo) => { setMode('viewer'); viewer.focusBar(barNo); }}
          onSave={editableId ? (bars) => applyLyrics(saveLyrics(editableId, bars)) : undefined}
          onRestore={editableId ? () => applyLyrics(restoreLyrics(editableId)) : undefined}
        />
      )}

      {inTrack && track && (
        <PlayerBar
          flowmap={track.flowmap}
          enabled={track.hasAudio}
          hasVocals={track.hasVocals}
          source={viewer.source}
          onSourceChange={viewer.setSource}
          playRange={viewer.playRange}
          loopRange={loopRange}
          loopAvailable={!!viewer.selection}
          loop={viewer.loop}
          onLoopChange={viewer.setLoop}
          syncOffset={viewer.syncOffset}
          onSyncNudge={viewer.adjustSyncOffset}
          onSyncReset={() => viewer.setSyncOffset(0)}
          audioTimeRef={audioTimeRef}
          apiRef={playerApi}
        />
      )}

      {library.deleteCandidate && (
        <DeleteTrackModal track={library.deleteCandidate} onCancel={() => library.setDeleteCandidate(null)} onConfirm={() => void confirmDelete()} />
      )}
      {showShortcuts && <ShortcutsDialog onClose={() => setShowShortcuts(false)} />}
      {toast && <Toast toast={toast} onClose={closeToast} />}
    </div>
  );
}
