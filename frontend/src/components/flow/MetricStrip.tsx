import { Minus, Plus } from 'lucide-react';
import { ZOOM_LEVELS } from '../../flow/layout';
import { t } from '../../i18n';
import type { FlowMap } from '../../types';

/** The three headline numbers above the canvas, plus the zoom control. */
export function MetricStrip({ flowmap, zoom, onZoom, onZoomStep, isDemo }: {
  flowmap: FlowMap;
  zoom: number;
  onZoom: (zoom: number) => void;
  onZoomStep: (direction: 1 | -1) => void;
  isDemo: boolean;
}) {
  const { summary, bars } = flowmap;
  const avgOffset = bars.length ? bars.reduce((sum, bar) => sum + bar.pocket_offset, 0) / bars.length : 0;
  const pocketLean = Math.abs(avgOffset) < 0.03 ? t('strip.onBeat') : avgOffset < 0 ? t('strip.ahead') : t('strip.behind');
  const zoomIndex = Math.max(0, ZOOM_LEVELS.findIndex((level) => level >= zoom - 1e-6));

  return (
    <div className="metric-strip">
      <Metric label={t('metrics.density')} value={summary.avg_density.toFixed(2)} unit={t('units.sylBeat')} detail={t('strip.peak', { value: summary.peak_density.toFixed(2) })} />
      <Metric label={t('metrics.pocket')} value={`${Math.round(summary.pocket_score * 100)}%`} detail={pocketLean} />
      <Metric label={t('metrics.rhymeChain')} value={summary.rhyme_chain_avg.toFixed(1)} unit={t('units.avg')} detail={t('strip.groups', { count: flowmap.rhyme_chains.length || flowmap.rhyme_groups.length })} />
      {isDemo && <p className="strip-note">{t('demo.note')}</p>}
      <div className="zoom-control" role="group" aria-label={t('zoom.aria')}>
        <button className="icon-btn icon-btn-sm" onClick={() => onZoomStep(-1)} disabled={zoomIndex === 0} aria-label={t('zoom.out')} title={`${t('zoom.out')} (⌘−)`}>
          <Minus size={13} />
        </button>
        <input
          type="range"
          min={0}
          max={ZOOM_LEVELS.length - 1}
          step={1}
          value={zoomIndex}
          onChange={(event) => onZoom(ZOOM_LEVELS[Number(event.currentTarget.value)])}
          aria-label={t('zoom.aria')}
          aria-valuetext={`${Math.round(zoom * 100)}%`}
        />
        <button className="icon-btn icon-btn-sm" onClick={() => onZoomStep(1)} disabled={zoomIndex === ZOOM_LEVELS.length - 1} aria-label={t('zoom.in')} title={`${t('zoom.in')} (⌘+)`}>
          <Plus size={13} />
        </button>
        <span className="zoom-value">{Math.round(zoom * 100)}%</span>
      </div>
    </div>
  );
}

function Metric({ label, value, unit, detail }: { label: string; value: string; unit?: string; detail: string }) {
  return (
    <div className="strip-metric">
      <span className="strip-label">{label}</span>
      <span className="strip-value">
        <b>{value}</b>
        {unit && <small>{unit}</small>}
      </span>
      <span className="strip-detail">{detail}</span>
    </div>
  );
}
