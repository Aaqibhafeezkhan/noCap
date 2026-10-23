import { Lightbulb } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { t, type I18nKey } from '../../i18n';

const TIPS: I18nKey[] = [
  'tip.loop', 'tip.notch', 'tip.colours', 'tip.barNumber', 'tip.lyrics',
  'tip.range', 'tip.vocals', 'tip.zoom', 'tip.report', 'tip.shortcuts',
];
const EVERY_MS = 8000;

/** One short tip about using noCap at a time, changing every few seconds while the user waits. */
export function AnalysisTips() {
  const order = useMemo(() => shuffled(TIPS), []);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % order.length), EVERY_MS);
    return () => window.clearInterval(timer);
  }, [order.length]);
  return (
    <p className="analysis-tip" aria-live="off">
      <Lightbulb size={13} aria-hidden="true" />
      <span key={index}>{t(order[index])}</span>
    </p>
  );
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
