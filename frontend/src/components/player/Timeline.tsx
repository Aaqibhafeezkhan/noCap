import { useMemo, useRef, useState } from 'react';
import { getBarTimeRange, type PlayRange } from '../../flow/playbackRanges';
import { t } from '../../i18n';
import type { FlowMap } from '../../types';
import { formatTime } from './format';

/** Seek bar with a per-bar density mini-map, section boundaries and the loop region.
 *  Drag to scrub; arrow keys step 5 s (Shift: 15 s). */
export function Timeline({ flowmap, time, duration, enabled, loopRange, onSeek }: {
  flowmap: FlowMap;
  time: number;
  duration: number;
  enabled: boolean;
  loopRange: PlayRange | null;
  onSeek: (seconds: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const total = duration || flowmap.metadata.duration || 1;
  const bars = useMemo(() => miniMap(flowmap), [flowmap]);
  const sections = useMemo(() => flowmap.sections.slice(1).map((section) => getBarTimeRange(flowmap, section.start_bar)?.start ?? null)
    .filter((value): value is number => value !== null), [flowmap]);
  const pct = Math.min(100, (time / total) * 100);

  function seekAt(clientX: number) {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    onSeek(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * total);
  }

  return (
    <div
      ref={trackRef}
      className={`timeline ${dragging ? 'is-dragging' : ''} ${enabled ? '' : 'is-disabled'}`}
      role="slider"
      tabIndex={enabled ? 0 : -1}
      aria-label={t('player.timelineAria')}
      aria-valuemin={0}
      aria-valuemax={Math.round(total)}
      aria-valuenow={Math.round(time)}
      aria-valuetext={`${formatTime(time)} / ${formatTime(total)}`}
      onPointerDown={(event) => {
        if (!enabled) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
        seekAt(event.clientX);
      }}
      onPointerMove={(event) => dragging && seekAt(event.clientX)}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        event.stopPropagation();
        const step = (event.shiftKey ? 15 : 5) * (event.key === 'ArrowLeft' ? -1 : 1);
        onSeek(time + step);
      }}
    >
      <div className="timeline-map" aria-hidden="true">
        {bars.map((bar) => (
          <i key={bar.barNo} style={{ left: `${(bar.start / total) * 100}%`, width: `${(bar.length / total) * 100}%`, height: `${18 + bar.level * 82}%` }} />
        ))}
      </div>
      {sections.map((start) => <span key={start} className="timeline-section" style={{ left: `${(start / total) * 100}%` }} aria-hidden="true" />)}
      {loopRange && (
        <span className="timeline-loop" style={{ left: `${(loopRange.start / total) * 100}%`, width: `${((loopRange.end - loopRange.start) / total) * 100}%` }} aria-hidden="true" />
      )}
      <div className="timeline-played" style={{ width: `${pct}%` }} aria-hidden="true" />
      <div className="timeline-cursor" style={{ left: `${pct}%` }} aria-hidden="true" />
    </div>
  );
}

function miniMap(flowmap: FlowMap) {
  const max = Math.max(0.01, ...flowmap.bars.map((bar) => bar.density));
  return flowmap.bars.flatMap((bar) => {
    const range = getBarTimeRange(flowmap, bar.bar_no);
    return range ? [{ barNo: bar.bar_no, start: range.start, length: range.end - range.start, level: bar.density / max }] : [];
  });
}
