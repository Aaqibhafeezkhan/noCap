import { useMemo, useState } from 'react';
import { BAR_METRICS, formatBarMetric, type BarMetricKey } from '../../flow/barStats';
import { t } from '../../i18n';
import type { FlowMap } from '../../types';
import { Meter } from '../inspector/Meter';
import { vocalBars } from '../../flow/emptyBars';

/** Ranks bars by one metric. The only bar-ranking view in the app. */
export function BarCompare({ flowmap, onOpenBar }: { flowmap: FlowMap; onOpenBar: (barNo: number) => void }) {
  const [metric, setMetric] = useState<BarMetricKey>('density');
  const ranked = useMemo(() => {
    const bars = vocalBars(flowmap);
    const max = Math.max(0.0001, ...bars.map((bar) => Math.abs(bar[metric])));
    return [...bars]
      .sort((left, right) => Math.abs(right[metric]) - Math.abs(left[metric]))
      .slice(0, 16)
      .map((bar) => ({ bar, pct: Math.abs(bar[metric]) / max }));
  }, [flowmap, metric]);

  return (
    <section className="report-panel">
      <div className="panel-head">
        <h2 className="panel-title">{t('report.compare')}</h2>
        <div className="segmented segmented-sm" role="group" aria-label={t('report.compareAria')}>
          {BAR_METRICS.map((key) => (
            <button key={key} className={metric === key ? 'is-active' : ''} aria-pressed={metric === key} onClick={() => setMetric(key)}>
              {t(`barMetric.${key}`)}
            </button>
          ))}
        </div>
      </div>
      <ol className="compare-list">
        {ranked.map(({ bar, pct }, index) => (
          <li key={bar.bar_no}>
            <button className="compare-row" onClick={() => onOpenBar(bar.bar_no)}>
              <span className="compare-rank">{index + 1}</span>
              <span className="compare-bar">{t('inspector.bar.title', { bar: bar.bar_no })}</span>
              <Meter value={pct} />
              <b>{formatBarMetric(metric, bar[metric])}</b>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
