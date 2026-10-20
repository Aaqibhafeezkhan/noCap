import { useMemo } from 'react';
import { Play } from 'lucide-react';
import { BAR_METRICS, formatBarMetric, similarBars, trackAverages, trackMax } from '../../flow/barStats';
import type { RhymeStyles } from '../../flow/colors';
import type { BarMarker } from '../../flow/markers';
import type { BarRange } from '../../flow/pixi/types';
import { t } from '../../i18n';
import type { FlowBar, FlowMap } from '../../types';
import { BarLyrics } from './BarLyrics';
import { MarkerNotes } from './MarkerNotes';
import { Meter } from './Meter';

export function BarTab({ flowmap, styles, markers, selection, onFocusBar, onPlayBar }: {
  flowmap: FlowMap;
  styles: RhymeStyles;
  markers: Map<number, BarMarker[]>;
  selection: BarRange | null;
  onFocusBar: (barNo: number) => void;
  onPlayBar: (barNo: number) => void;
}) {
  const averages = useMemo(() => trackAverages(flowmap.bars), [flowmap]);
  const maxima = useMemo(() => trackMax(flowmap.bars), [flowmap]);
  const bars = useMemo(
    () => (selection ? flowmap.bars.filter((bar) => bar.bar_no >= selection.start && bar.bar_no <= selection.end) : []),
    [flowmap, selection],
  );
  const single = bars.length === 1 ? bars[0] : null;
  const similar = useMemo(() => (single ? similarBars(flowmap, single.bar_no) : []), [flowmap, single]);

  if (!selection || bars.length === 0) {
    return <p className="insp-empty">{t('inspector.bar.empty')}</p>;
  }
  const values = aggregate(bars);
  const section = flowmap.sections.find((item) => bars[0].bar_no >= item.start_bar && bars[0].bar_no <= item.end_bar);

  return (
    <>
      <section className="insp-section insp-head">
        <div>
          <h2>{single ? t('inspector.bar.title', { bar: single.bar_no }) : t('inspector.bar.rangeTitle', { start: selection.start, end: selection.end })}</h2>
          <p>{section ? t('inspector.bar.inSection', { section: flowmap.sections.indexOf(section) + 1 }) : t('inspector.bar.count', { count: bars.length })}</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => onPlayBar(bars[0].bar_no)}>
          <Play size={13} fill="currentColor" /> {t('inspector.bar.play')}
        </button>
      </section>

      <section className="insp-section">
        <h3 className="insp-heading">{t('inspector.bar.metrics')} <small>{t('inspector.bar.vsTrack')}</small></h3>
        <dl className="metric-list">
          {BAR_METRICS.map((key) => (
            <div key={key} className="metric-row" title={t('inspector.bar.avgTitle', { value: formatBarMetric(key, averages[key]) })}>
              <dt>{t(`barMetric.${key}`)}</dt>
              <dd>{formatBarMetric(key, values[key])}</dd>
              <Meter value={Math.abs(values[key]) / maxima[key]} marker={Math.abs(averages[key]) / maxima[key]} />
            </div>
          ))}
        </dl>
      </section>

      <section className="insp-section">
        <h3 className="insp-heading">{t('inspector.bar.lyrics')}</h3>
        <BarLyrics flowmap={flowmap} styles={styles} barNumbers={bars.slice(0, 16).map((bar) => bar.bar_no)} />
      </section>

      <MarkerNotes bars={bars} markers={markers} />

      {single && similar.length > 0 && (
        <section className="insp-section">
          <h3 className="insp-heading">{t('inspector.bar.similar')}</h3>
          <ul className="similar-list">
            {similar.map((item) => (
              <li key={item.barNo}>
                <button className="similar-item" onClick={() => onFocusBar(item.barNo)}>
                  <span>{t('inspector.bar.title', { bar: item.barNo })}</span>
                  <Meter value={item.score} tone="neutral" />
                  <b>{Math.round(item.score * 100)}%</b>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function aggregate(bars: FlowBar[]): Record<(typeof BAR_METRICS)[number], number> {
  const averages = trackAverages(bars);
  return { ...averages, syllable_count: bars.reduce((sum, bar) => sum + bar.syllable_count, 0) };
}
