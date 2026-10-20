import { t } from '../../i18n';
import type { FlowSection } from '../../types';

/** One row per detected section, with energy and timbre folded in. Rows open the flow view. */
export function SectionTable({ sections, onOpenBar }: { sections: FlowSection[]; onOpenBar: (barNo: number) => void }) {
  if (sections.length === 0) return null;
  return (
    <section className="report-panel">
      <h2 className="panel-title">{t('sections.title')}</h2>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">{t('sections.section')}</th>
              <th scope="col">{t('sections.range')}</th>
              <th scope="col" className="num">{t('metrics.density')}</th>
              <th scope="col" className="num">{t('metrics.sync')}</th>
              <th scope="col" className="num">{t('sections.tempo')}</th>
              <th scope="col" className="num">{t('energy.energy')}</th>
              <th scope="col" className="num">{t('energy.brightness')}</th>
              <th scope="col" className="num">{t('sections.confidence')}</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((section, index) => (
              <tr key={section.id} className="is-clickable" tabIndex={0} onClick={() => onOpenBar(section.start_bar)} onKeyDown={(event) => event.key === 'Enter' && onOpenBar(section.start_bar)}>
                <th scope="row">{t('sections.short', { index: index + 1 })}</th>
                <td>{t('sections.bars', { start: section.start_bar, end: section.end_bar })}</td>
                <td className="num">{section.avg_density.toFixed(2)}</td>
                <td className="num">{pct(section.syncopation_score)}</td>
                <td className="num">{section.local_bpm.toFixed(1)}</td>
                <td className="num">{pct(section.rms_avg)}</td>
                <td className="num">{section.spectral_centroid_avg > 0 ? `${section.spectral_centroid_avg.toFixed(0)} Hz` : '—'}</td>
                <td className="num">{pct(section.tempo_confidence)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}
