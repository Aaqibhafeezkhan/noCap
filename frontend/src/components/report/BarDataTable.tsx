import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { BAR_METRICS, formatBarMetric } from '../../flow/barStats';
import { t } from '../../i18n';
import type { FlowMap } from '../../types';

/** Raw per-bar numbers, collapsed by default. */
export function BarDataTable({ flowmap, onOpenBar }: { flowmap: FlowMap; onOpenBar: (barNo: number) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="report-panel">
      <button className="disclosure" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <ChevronRight size={15} className="disclosure-icon" />
        <span className="panel-title">{t('report.barData')}</span>
        <small>{t('report.barDataCount', { count: flowmap.bars.length })}</small>
      </button>
      {open && (
        <div className="table-scroll table-scroll-tall">
          <table className="data-table data-table-dense">
            <thead>
              <tr>
                <th scope="col">{t('details.bar')}</th>
                {BAR_METRICS.map((key) => <th key={key} scope="col" className="num">{t(`barMetric.${key}`)}</th>)}
                <th scope="col">{t('report.pocketLabel')}</th>
              </tr>
            </thead>
            <tbody>
              {flowmap.bars.map((bar) => (
                <tr key={bar.bar_no} className="is-clickable" tabIndex={0} onClick={() => onOpenBar(bar.bar_no)} onKeyDown={(event) => event.key === 'Enter' && onOpenBar(bar.bar_no)}>
                  <th scope="row">{bar.bar_no}</th>
                  {BAR_METRICS.map((key) => <td key={key} className="num">{formatBarMetric(key, bar[key])}</td>)}
                  <td>{bar.pocket_label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
