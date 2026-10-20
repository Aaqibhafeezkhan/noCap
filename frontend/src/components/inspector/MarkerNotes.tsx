import type { BarMarker } from '../../flow/markers';
import { t } from '../../i18n';
import type { FlowBar } from '../../types';

/** Explains why each context marker fired for the selected bars. */
export function MarkerNotes({ bars, markers }: { bars: FlowBar[]; markers: Map<number, BarMarker[]> }) {
  const notes = bars.flatMap((bar) => (markers.get(bar.bar_no) || []).map((marker) => ({ bar: bar.bar_no, marker })));
  if (notes.length === 0) return null;
  return (
    <section className="insp-section">
      <h3 className="insp-heading">{t('inspector.bar.markers')}</h3>
      <ul className="marker-notes">
        {notes.slice(0, 12).map(({ bar, marker }) => (
          <li key={`${bar}-${marker.kind}`}>
            <span className={`marker-icon marker-${marker.kind}`} aria-hidden="true" />
            <div>
              <b>{t(`marker.${marker.kind}.title`)}{bars.length > 1 ? ` · ${t('inspector.bar.title', { bar })}` : ''}</b>
              <p>{reason(marker)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function reason(marker: BarMarker): string {
  const d = marker.detail;
  switch (marker.kind) {
    case 'switch':
      return t('marker.switch.reason', { from: d.bpmFrom.toFixed(1), to: d.bpmTo.toFixed(1) });
    case 'cut':
      return t('marker.cut.reason', { from: pct(d.energyFrom), to: pct(d.energyTo), onsetFrom: pct(d.onsetFrom), onsetTo: pct(d.onsetTo) });
    case 'drift':
      return t('marker.drift.reason', { timing: (d.timing * 100).toFixed(1), limit: (d.timingLimit * 100).toFixed(1), offset: d.offset.toFixed(3) });
    default:
      return t('marker.pocket.reason', { confidence: pct(d.confidence) });
  }
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}
