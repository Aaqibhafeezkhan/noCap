import { useMemo, useRef, useState } from 'react';
import { Plus, Search, Upload } from 'lucide-react';
import type { AnalysisState } from '../../hooks/useAnalysis';
import { AUDIO_ACCEPT, useFileDrop } from '../../hooks/useFileDrop';
import { usePersistentState } from '../../hooks/usePersistentState';
import { t } from '../../i18n';
import type { LibraryTrack } from '../../types';
import { AnalysisCard } from './AnalysisCard';
import { EmptyLibrary } from './EmptyLibrary';
import { TrackCard } from './TrackCard';

type SortKey = 'date' | 'title' | 'bpm' | 'density';
const SORTS: SortKey[] = ['date', 'title', 'bpm', 'density'];

export function LibraryScreen({ tracks, analysis, newIds, openId, error, onOpen, onDelete, onDemo }: {
  tracks: LibraryTrack[];
  analysis: AnalysisState;
  newIds: Set<string>;
  openId: string | null;
  error: string;
  onOpen: (trackId: string) => void;
  onDelete: (track: LibraryTrack) => void;
  onDemo: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = usePersistentState<SortKey>('nocap.librarySort', 'date');
  const busy = analysis.status === 'running' || analysis.status === 'cancelling';
  const dragging = useFileDrop(!busy, analysis.start);
  const visible = useMemo(() => sortTracks(tracks.filter((track) => track.title.toLowerCase().includes(query.trim().toLowerCase())), sort), [tracks, query, sort]);
  const showAnalysis = analysis.status !== 'idle' && analysis.status !== 'done';
  const empty = tracks.length === 0 && !showAnalysis;

  function pick(files: FileList | null) {
    const file = files?.[0];
    if (file) void analysis.start(file);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <main className="library-screen">
      <div className="library-inner">
        <header className="library-head">
          <div>
            <h1>{t('library.title')}</h1>
            <p>{tracks.length === 0 ? t('library.emptyTitle') : tracks.length === 1 ? t('library.countOne') : t('library.count', { count: tracks.length })}</p>
          </div>
          {!empty && (
            <div className="library-tools">
              <label className="search">
                <Search size={14} aria-hidden="true" />
                <input type="search" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder={t('library.search')} aria-label={t('library.search')} />
              </label>
              <label className="select">
                <span>{t('library.sort')}</span>
                <select value={sort} onChange={(event) => setSort(event.currentTarget.value as SortKey)}>
                  {SORTS.map((key) => <option key={key} value={key}>{t(`library.sort.${key}`)}</option>)}
                </select>
              </label>
              <button className="btn btn-primary" onClick={() => inputRef.current?.click()} disabled={busy} title={busy ? t('library.busy') : undefined}>
                <Plus size={15} /> {t('library.addTrack')}
              </button>
            </div>
          )}
          <input ref={inputRef} type="file" accept={AUDIO_ACCEPT} hidden onChange={(event) => pick(event.currentTarget.files)} />
        </header>

        {error && <p className="inline-error" role="alert">{error}</p>}

        {empty ? (
          <EmptyLibrary onPick={() => inputRef.current?.click()} onDemo={onDemo} />
        ) : (
          <div className="library-grid">
            {showAnalysis && <AnalysisCard analysis={analysis} />}
            {visible.map((track) => (
              <TrackCard key={track.id} track={track} isNew={newIds.has(track.id)} isOpen={openId === track.id} onOpen={() => onOpen(track.id)} onDelete={() => onDelete(track)} />
            ))}
            {visible.length === 0 && query && <p className="library-none">{t('library.noMatch', { query })}</p>}
          </div>
        )}
      </div>

      {dragging && (
        <div className="drop-overlay" aria-hidden="true">
          <Upload size={32} />
          <b>{t('library.dropHere')}</b>
        </div>
      )}
    </main>
  );
}

function sortTracks(tracks: LibraryTrack[], sort: SortKey): LibraryTrack[] {
  const list = [...tracks];
  if (sort === 'title') return list.sort((left, right) => left.title.localeCompare(right.title));
  if (sort === 'bpm') return list.sort((left, right) => right.bpm - left.bpm);
  if (sort === 'density') return list.sort((left, right) => (right.summary?.avg_density ?? 0) - (left.summary?.avg_density ?? 0));
  return list.sort((left, right) => right.created_at.localeCompare(left.created_at));
}
