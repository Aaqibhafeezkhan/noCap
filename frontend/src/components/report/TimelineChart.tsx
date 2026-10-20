import { useMemo, useState } from 'react';
import { t } from '../../i18n';
import type { FlowMap } from '../../types';

const W = 1000;
const H = 220;
const PAD = { top: 16, right: 12, bottom: 26, left: 40 };
const DENSITY_H = 110;
const POCKET_TOP = PAD.top + DENSITY_H + 22;
const POCKET_H = H - POCKET_TOP - PAD.bottom;

/** Density (area) and pocket offset (line around the beat) across every bar, with
 *  section bands behind. Click a bar to open it in the flow view. */
export function TimelineChart({ flowmap, onOpenBar }: { flowmap: FlowMap; onOpenBar: (barNo: number) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const { bars, sections } = flowmap;
  const geometry = useMemo(() => {
    const count = Math.max(1, bars.length);
    const step = (W - PAD.left - PAD.right) / count;
    const maxDensity = Math.max(0.01, ...bars.map((bar) => bar.density));
    const maxOffset = Math.max(0.05, ...bars.map((bar) => Math.abs(bar.pocket_offset)));
    const x = (index: number) => PAD.left + index * step + step / 2;
    const dy = (value: number) => PAD.top + DENSITY_H - (value / maxDensity) * DENSITY_H;
    // Positive offset = behind the beat, drawn upwards to match the axis notes.
    const py = (value: number) => POCKET_TOP + POCKET_H / 2 - (value / maxOffset) * (POCKET_H / 2);
    // A 4-bar rolling mean keeps the shape readable on long tracks; raw values stay in the hover readout.
    const smooth = bars.map((_, index) => {
      const window = bars.slice(Math.max(0, index - 1), index + 3);
      return window.reduce((sum, bar) => sum + bar.density, 0) / window.length;
    });
    const area = smooth.map((value, index) => `${x(index)},${dy(value)}`).join(' ');
    return {
      step,
      x,
      maxDensity,
      maxOffset,
      areaPath: `M${x(0)},${PAD.top + DENSITY_H} L${area.replace(/ /g, ' L')} L${x(count - 1)},${PAD.top + DENSITY_H} Z`,
      pocketPath: `M${bars.map((bar, index) => `${x(index)},${py(bar.pocket_offset)}`).join(' L')}`,
      rawPath: `M${bars.map((bar, index) => `${x(index)},${dy(bar.density)}`).join(' L')}`,
      indexOf: new Map(bars.map((bar, index) => [bar.bar_no, index])),
    };
  }, [bars]);
  const hovered = hover !== null ? bars[hover] : null;

  function indexAt(event: React.MouseEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * W;
    const index = Math.floor((svgX - PAD.left) / geometry.step);
    return index >= 0 && index < bars.length ? index : null;
  }

  return (
    <figure className="report-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={t('report.chartAria')}
        onMouseMove={(event) => setHover(indexAt(event))}
        onMouseLeave={() => setHover(null)}
        onClick={(event) => {
          const index = indexAt(event);
          if (index !== null) onOpenBar(bars[index].bar_no);
        }}
      >
        {sections.map((section, index) => {
          const start = geometry.indexOf.get(section.start_bar) ?? 0;
          const end = geometry.indexOf.get(section.end_bar) ?? bars.length - 1;
          return (
            <g key={section.id}>
              <rect x={geometry.x(start) - geometry.step / 2} y={PAD.top} width={(end - start + 1) * geometry.step} height={H - PAD.top - PAD.bottom} className={index % 2 ? 'band band-b' : 'band'} />
              {(end - start) * geometry.step > 28 && <text x={geometry.x(start) - geometry.step / 2 + 4} y={H - 8} className="band-label">{t('sections.short', { index: index + 1 })}</text>}
            </g>
          );
        })}
        <text x={4} y={PAD.top + 10} className="axis-label">{t('report.density')}</text>
        <text x={4} y={POCKET_TOP + 8} className="axis-label">{t('report.pocket')}</text>
        <line x1={PAD.left} x2={W - PAD.right} y1={POCKET_TOP + POCKET_H / 2} y2={POCKET_TOP + POCKET_H / 2} className="axis-zero" />
        <text x={W - PAD.right} y={POCKET_TOP + 8} className="axis-note" textAnchor="end">{t('report.behind')}</text>
        <text x={W - PAD.right} y={POCKET_TOP + POCKET_H} className="axis-note" textAnchor="end">{t('report.ahead')}</text>
        <path d={geometry.rawPath} className="density-raw" />
        <path d={geometry.areaPath} className="density-area" />
        <path d={geometry.pocketPath} className="pocket-line" />
        {hovered && hover !== null && <line x1={geometry.x(hover)} x2={geometry.x(hover)} y1={PAD.top} y2={H - PAD.bottom} className="hover-line" />}
      </svg>
      <figcaption className="report-chart-caption">
        {hovered
          ? t('report.hover', { bar: hovered.bar_no, density: hovered.density.toFixed(2), offset: hovered.pocket_offset.toFixed(3), sync: Math.round(hovered.syncopation_score * 100) })
          : t('report.chartHint')}
      </figcaption>
    </figure>
  );
}
