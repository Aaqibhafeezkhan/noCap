import { useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import type { AnalysisState } from '../../hooks/useAnalysis';
import { t } from '../../i18n';
import type { StepId } from '../../types';

const STEPS: Array<{ id: StepId; weight: [number, number] }> = [
  { id: 'load', weight: [0, 10] },
  { id: 'beat', weight: [10, 25] },
  { id: 'transcribe', weight: [25, 85] },
  { id: 'align', weight: [85, 100] },
];

/** The running (or just finished / failed) analysis, shown in the library grid. */
export function AnalysisCard({ analysis }: { analysis: AnalysisState }) {
  const [showTrace, setShowTrace] = useState(false);
  const { status, steps, transcribePct, error } = analysis;
  const progress = overall(analysis);
  const busy = status === 'running' || status === 'cancelling';
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
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-label={t('analysis.progressAria')}>
            <span style={{ width: `${progress}%` }} />
          </div>
          <ol className="analysis-steps">
            {STEPS.map((step) => {
              const state = steps[step.id].status;
              return (
                <li key={step.id} className={`is-${state}`}>
                  <span className="step-icon" aria-hidden="true">
                    {state === 'done' ? <Check size={12} strokeWidth={3} /> : state === 'active' && busy ? <Loader2 size={12} className="spin" /> : null}
                  </span>
                  <span>{t(`progress.${step.id}`)}</span>
                  {step.id === 'transcribe' && state === 'active' && transcribePct !== null && <b>{transcribePct}%</b>}
                </li>
              );
            })}
          </ol>
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

function overall(analysis: AnalysisState): number {
  let value = 0;
  for (const step of STEPS) {
    const state = analysis.steps[step.id].status;
    if (state === 'done') value = step.weight[1];
    else if (state === 'active') {
      const fraction = step.id === 'transcribe' && analysis.transcribePct !== null ? analysis.transcribePct / 100 : 0.15;
      value = step.weight[0] + (step.weight[1] - step.weight[0]) * fraction;
    }
  }
  return value;
}
