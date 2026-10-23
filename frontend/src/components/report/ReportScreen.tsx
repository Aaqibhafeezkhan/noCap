import { useMemo } from 'react';
import { trackAverages } from '../../flow/barStats';
import { t } from '../../i18n';
import type { FlowMap } from '../../types';
import { BarCompare } from './BarCompare';
import { BarDataTable } from './BarDataTable';
import { SectionTable } from './SectionTable';
import { TimelineChart } from './TimelineChart';
import { vocalBars } from '../../flow/emptyBars';

export function ReportScreen({ flowmap, onOpenBar }: { flowmap: FlowMap; onOpenBar: (barNo: number) => void }) {
  const { summary } = flowmap;
  const averages = useMemo(() => trackAverages(vocalBars(flowmap)), [flowmap]);
  const stressedOnBeat = useMemo(
    () => vocalBars(flowmap).reduce((sum, bar) => sum + bar.stressed_on_beat_ratio, 0) / Math.max(1, vocalBars(flowmap).length),
    [flowmap],
  );
  const kpis = [
    { key: 'density', value: summary.avg_density.toFixed(2), unit: t('units.sylBeat'), detail: t('report.kpi.density', { peak: summary.peak_density.toFixed(2), variation: pct(summary.density_variation) }) },
    { key: 'syncopation', value: pct(summary.syncopation_score), detail: t('report.kpi.sync') },
    { key: 'pocket', value: pct(summary.pocket_score), detail: t('report.kpi.pocket', { offset: averages.pocket_offset.toFixed(3) }) },
    { key: 'timingQuality', value: pct(summary.timing_quality_avg), detail: t('report.kpi.timing') },
    { key: 'delivery', value: pct(summary.delivery_consistency), detail: t('report.kpi.delivery', { consistency: pct(summary.consistency) }) },
    { key: 'stressPlacement', value: pct(stressedOnBeat), detail: t('report.kpi.stress', { ratio: pct(averages.stressed_ratio) }) },
  ] as const;

  return (
    <main className="report-screen">
      <div className="report-inner">
        <header className="report-head">
          <div>
            <p className="eyebrow">{t('report.eyebrow')}</p>
            <h1>{flowmap.metadata.title}</h1>
          </div>
          <dl className="report-counts">
            <div><dt>{t('details.syllables')}</dt><dd>{flowmap.syllables.length}</dd></div>
            <div><dt>{t('details.words')}</dt><dd>{flowmap.words.length}</dd></div>
            <div><dt>{t('details.rhymeGroups')}</dt><dd>{flowmap.rhyme_chains.length || flowmap.rhyme_groups.length}</dd></div>
            <div><dt>{t('report.sections')}</dt><dd>{flowmap.sections.length}</dd></div>
          </dl>
        </header>

        <section className="kpi-row" aria-label={t('report.kpiAria')}>
          {kpis.map((kpi) => (
            <article key={kpi.key} className="kpi" title={t(`metricHelp.${kpi.key}`)}>
              <span className="kpi-label">{t(`metrics.${kpi.key}`)}</span>
              <span className="kpi-value">{kpi.value}{'unit' in kpi && <small>{kpi.unit}</small>}</span>
              <span className="kpi-detail">{kpi.detail}</span>
            </article>
          ))}
        </section>

        <section className="report-panel">
          <h2 className="panel-title">{t('report.overTime')}</h2>
          <TimelineChart flowmap={flowmap} onOpenBar={onOpenBar} />
        </section>

        <SectionTable sections={flowmap.sections} onOpenBar={onOpenBar} />
        <BarCompare flowmap={flowmap} onOpenBar={onOpenBar} />
        <BarDataTable flowmap={flowmap} onOpenBar={onOpenBar} />
      </div>
    </main>
  );
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}
