/** Thin horizontal meter; `marker` draws a tick (e.g. the track average). */
export function Meter({ value, marker, tone = 'accent' }: { value: number; marker?: number; tone?: 'accent' | 'neutral' }) {
  const width = Math.max(0, Math.min(1, value)) * 100;
  return (
    <span className={`meter meter-${tone}`} aria-hidden="true">
      <span className="meter-fill" style={{ width: `${width}%` }} />
      {marker !== undefined && <span className="meter-mark" style={{ left: `${Math.max(0, Math.min(1, marker)) * 100}%` }} />}
    </span>
  );
}
