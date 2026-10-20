import { t } from '../../i18n';
import type { FlowMap } from '../../types';
import { Meter } from './Meter';

export function TrackTab({ flowmap, onFocusBar }: { flowmap: FlowMap; onFocusBar: (barNo: number) => void }) {
  const { summary } = flowmap;
  const metrics = [
    { key: 'avgDensity', value: t('units.sylPerBeat', { value: summary.avg_density.toFixed(2) }), pct: summary.avg_density / Math.max(summary.peak_density, 1) },
    { key: 'peakDensity', value: t('units.sylPerBeat', { value: summary.peak_density.toFixed(2) }), pct: 1 },
    { key: 'syncopation', value: pct(summary.syncopation_score), pct: summary.syncopation_score },
    { key: 'consistency', value: pct(summary.consistency), pct: summary.consistency },
    { key: 'rhymeChain', value: summary.rhyme_chain_avg.toFixed(1), pct: Math.min(1, summary.rhyme_chain_avg / 6) },
    { key: 'pocket', value: pct(summary.pocket_score), pct: summary.pocket_score },
    { key: 'timingQuality', value: pct(summary.timing_quality_avg), pct: summary.timing_quality_avg },
    { key: 'delivery', value: pct(summary.delivery_consistency), pct: summary.delivery_consistency },
  ] as const;

  return (
    <>
      <section className="insp-section">
        <h3 className="insp-heading">{t('inspector.track.metrics')}</h3>
        <dl className="metric-list">
          {metrics.map((metric) => (
            <div key={metric.key} className="metric-row" title={t(`metricHelp.${metric.key}`)}>
              <dt>{t(`metrics.${metric.key}`)}</dt>
              <dd>{metric.value}</dd>
              <Meter value={metric.pct} />
            </div>
          ))}
        </dl>
      </section>
      {flowmap.sections.length > 0 && (
        <section className="insp-section">
          <h3 className="insp-heading">{t('inspector.track.sections')}</h3>
          <ul className="section-list">
            {flowmap.sections.map((section, index) => (
              <li key={section.id}>
                <button className="section-item" onClick={() => onFocusBar(section.start_bar)}>
                  <span className="section-name">{t('sections.short', { index: index + 1 })}</span>
                  <span className="section-range">{t('sections.bars', { start: section.start_bar, end: section.end_bar })}</span>
                  <span className="section-density">{section.avg_density.toFixed(2)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}
