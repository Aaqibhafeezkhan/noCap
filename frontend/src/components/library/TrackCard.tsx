import { Trash2 } from 'lucide-react';
import { t } from '../../i18n';
import type { LibraryTrack } from '../../types';
import { formatTime } from '../player/format';

export function TrackCard({ track, isNew, isOpen, onOpen, onDelete }: {
  track: LibraryTrack;
  isNew: boolean;
  isOpen: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const summary = track.summary || ({} as LibraryTrack['summary']);
  return (
    <article className={`track-card ${isOpen ? 'is-open' : ''}`}>
      <button className="track-card-open" onClick={onOpen} aria-label={t('library.openAria', { title: track.title })}>
        <MiniMap values={track.bar_density || []} />
        <span className="track-card-body">
          <span className="track-card-title">
            {track.title}
            {isNew && <span className="badge badge-accent">{t('library.new')}</span>}
            {isOpen && <span className="badge">{t('library.open')}</span>}
          </span>
          <span className="track-card-meta">
            {t('library.cardMeta', { bpm: Math.round(track.bpm), duration: formatTime(track.duration), bars: track.bars })}
          </span>
          <span className="track-card-stats">
            <Stat label={t('metrics.density')} value={(summary.avg_density ?? 0).toFixed(2)} />
            <Stat label={t('metrics.sync')} value={`${Math.round((summary.syncopation_score ?? 0) * 100)}%`} />
            <Stat label={t('metrics.pocket')} value={`${Math.round((summary.pocket_score ?? 0) * 100)}%`} />
          </span>
          <span className="track-card-date">{formatDate(track.created_at)}</span>
        </span>
      </button>
      <button className="icon-btn track-delete" aria-label={t('library.deleteAria', { title: track.title })} title={t('library.delete')} onClick={onDelete}>
        <Trash2 size={14} />
      </button>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="track-stat">
      <small>{label}</small>
      <b>{value}</b>
    </span>
  );
}

/** Bar-by-bar density as a row of thin columns. */
function MiniMap({ values }: { values: number[] }) {
  if (values.length === 0) return <span className="track-map is-empty" aria-hidden="true" />;
  const max = Math.max(0.01, ...values);
  const width = 100 / values.length;
  return (
    <svg className="track-map" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
      {values.map((value, index) => {
        const height = Math.max(1.5, (value / max) * 30);
        return <rect key={index} x={index * width} y={32 - height} width={Math.max(width - 0.25, 0.15)} height={height} />;
      })}
    </svg>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  // The UI is English, so dates follow it instead of the system locale.
  return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}
