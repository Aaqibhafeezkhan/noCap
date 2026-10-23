import { t } from '../../i18n';

/** Small facts that appear as each step finishes ("99 BPM", "889 words heard"). */
export function AnalysisFindings({ findings }: { findings: Record<string, number> }) {
  const items: Array<[string, string]> = [];
  if (findings.duration) items.push(['duration', t('finding.duration', { time: clock(findings.duration) })]);
  if (findings.bpm) items.push(['bpm', t('finding.bpm', { bpm: Math.round(findings.bpm) })]);
  if (findings.words) items.push(['words', t('finding.words', { count: findings.words })]);
  if (findings.bars) items.push(['bars', t('finding.bars', { count: findings.bars })]);
  if (findings.rhyme_groups) items.push(['rhymes', t('finding.rhymeGroups', { count: findings.rhyme_groups })]);
  if (items.length === 0) return null;
  return (
    <ul className="analysis-findings" aria-label={t('analysis.findingsTitle')}>
      {items.map(([key, text]) => <li key={key}>{text}</li>)}
    </ul>
  );
}

function clock(seconds: number): string {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
