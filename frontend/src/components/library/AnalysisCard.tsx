import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { ANALYSIS_STEPS, REPAIR_FROM_PCT, overallProgress, secondsLeft } from '../../flow/analysisProgress';
import type { AnalysisState } from '../../hooks/useAnalysis';
import { t } from '../../i18n';
import type { StepId } from '../../types';
import { AnalysisFindings } from './AnalysisFindings';
import { AnalysisTips } from './AnalysisTips';

/** The running (or just finished / failed) analysis, shown in the library grid. */
export function AnalysisCard({ analysis }: { analysis: AnalysisState }) {
  const [showTrace, setShowTrace] = useState(false);
  const { status, steps, findings, error } = analysis;
  const busy = status === 'running' || status === 'cancelling';
  const now = useClock(busy);
  const progress = useMonotonic(overallProgress(steps, now), analysis.startedAt);
  const remaining = useSmoothedSeconds(busy ? secondsLeft(progress, now - analysis.startedAt) : null);
  const title = status === 'error' ? t('analysis.failed') : status === 'cancelled' ? t('analysis.cancelled') : status === 'cancelling' ? t('analysis.cancelling') : t('analysis.running');

  return (
    <article className={`analysis-card is-${status}`} aria-live="polite" aria-busy={busy}>
      <div className="analysis-head">
        <div>
          <span className="analysis-title">{title}</span>
          <span className="analysis-file" title={analysis.filename}>{analysis.filename}</span>
        </div>
        {busy ? (
          <button className="btn btn-ghost btn-sm" onClick={() => void analysis.cancel()} disabled={status === 'cancelling'}>
            {t('analysis.cancel')}
          </button>
        ) : (
          <button className="icon-btn" onClick={analysis.dismiss} aria-label={t('analysis.dismiss')}><X size={15} /></button>
        )}
      </div>

      {status !== 'error' && (
        <>
          <div className="analysis-meter">
            <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-label={t('analysis.progressAria')}>
              <span style={{ width: `${progress}%` }} />
            </div>
            <b>{Math.floor(progress)}%</b>
          </div>
          {status === 'running' && <p className="analysis-eta">{timeLeftText(remaining)}</p>}
          <ol className="analysis-steps">
            {ANALYSIS_STEPS.filter((step) => steps[step.id].status !== 'skipped').map((step) => {
              const state = shownState(steps, step.id, status === 'running');
              const repairing = step.id === 'transcribe' && state.status === 'active' && (state.pct ?? 0) >= REPAIR_FROM_PCT;
              return (
                <li key={step.id} className={`is-${state.status}`}>
                  <span className="step-icon" aria-hidden="true">
                    {state.status === 'done' ? <Check size={12} strokeWidth={3} /> : state.status === 'active' && busy ? <Loader2 size={12} className="spin" /> : null}
                  </span>
                  <span className="step-text">
                    {t(`progress.${step.id}`)}
                    {repairing && <small>{t('progress.transcribeRepair')}</small>}
                  </span>
                  {state.status === 'active' && state.pct !== null && <b>{state.pct}%</b>}
                </li>
              );
            })}
          </ol>
          <AnalysisFindings findings={findings} />
          {status === 'running' && <AnalysisTips />}
          {status === 'cancelling' && <p className="analysis-note">{t('analysis.cancellingNote')}</p>}
        </>
      )}

      {status === 'error' && error && (
        <div className="analysis-error">
          <p>{error.message.split('\n')[0]}</p>
          {error.trace && (
            <>
              <button className="link-btn" aria-expanded={showTrace} onClick={() => setShowTrace((value) => !value)}>
                {showTrace ? t('analysis.hideDetails') : t('analysis.showDetails')}
              </button>
              {showTrace && <pre>{error.trace}</pre>}
            </>
          )}
        </div>
      )}
    </article>
  );
}

/** Between two steps nothing is "active" for a moment; show the next step as working. */
function shownState(steps: AnalysisState['steps'], id: StepId, running: boolean) {
  const state = steps[id];
  if (!running || state.status !== 'idle' || ANALYSIS_STEPS.some((step) => steps[step.id].status === 'active')) return state;
  const next = ANALYSIS_STEPS.find((step) => steps[step.id].status === 'idle');
  return next?.id === id ? { ...state, status: 'active' as const } : state;
}

/** Re-render twice a second while busy, so steps without a percentage still move. */
function useClock(active: boolean): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

/** The bar never goes backwards during one analysis; ``runKey`` (its start time) resets it. */
function useMonotonic(value: number, runKey: number): number {
  const ref = useRef({ runKey, best: 0 });
  if (ref.current.runKey !== runKey) ref.current = { runKey, best: 0 };
  ref.current.best = Math.max(ref.current.best, value);
  return ref.current.best;
}

/** Ease the estimate so it does not jump around from one tick to the next. */
function useSmoothedSeconds(value: number | null): number | null {
  const smooth = useRef<number | null>(null);
  if (value === null) smooth.current = null;
  else smooth.current = smooth.current === null ? value : smooth.current * 0.85 + value * 0.15;
  return smooth.current;
}

function timeLeftText(seconds: number | null): string {
  if (seconds === null) return t('analysis.timeUsual');
  if (seconds < 45) return t('analysis.timeLessMinute');
  if (seconds < 90) return t('analysis.timeAboutMinute');
  return t('analysis.timeMinutes', { minutes: Math.round(seconds / 60) });
}
