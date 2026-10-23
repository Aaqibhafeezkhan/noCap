import { useRef, useState } from 'react';
import { analyzeTrack, cancelAnalysis } from '../api/analyze';
import { t } from '../i18n';
import { ANALYSIS_STEPS, idleSteps, type StepProgress } from '../flow/analysisProgress';
import type { AnalyzeMessage, LibraryTrack, StepId } from '../types';

export type AnalysisStatus = 'idle' | 'running' | 'cancelling' | 'done' | 'cancelled' | 'error';

/** One background analysis at a time. Lives at App level so switching screens never
 *  interrupts it; the library shows its progress as a card. */
export function useAnalysis(onComplete: (track: LibraryTrack | undefined) => void) {
  const [steps, setSteps] = useState<Record<StepId, StepProgress>>(idleSteps);
  const [findings, setFindings] = useState<Record<string, number>>({});
  const [startedAt, setStartedAt] = useState(0);
  const [filename, setFilename] = useState('');
  const [error, setError] = useState<{ message: string; trace: string } | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const trackIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function start(file: File) {
    if (status === 'running' || status === 'cancelling') return;
    const controller = new AbortController();
    abortRef.current = controller;
    trackIdRef.current = null;
    setFilename(file.name);
    setError(null);
    setSteps(idleSteps());
    setFindings({});
    setStartedAt(Date.now());
    setStatus('running');
    try {
      await analyzeTrack(file, handleMessage, controller.signal);
    } catch (err) {
      if (controller.signal.aborted) {
        setStatus('cancelled');
        return;
      }
      setError({ message: err instanceof Error ? err.message : String(err), trace: '' });
      setStatus('error');
    }
  }

  async function cancel() {
    if (status !== 'running') return;
    setStatus('cancelling');
    const trackId = trackIdRef.current;
    if (trackId) {
      try {
        await cancelAnalysis(trackId);
        return; // The stream ends with a "cancelled" event.
      } catch {
        // Fall through to aborting the request.
      }
    }
    abortRef.current?.abort();
  }

  function dismiss() {
    setStatus('idle');
    setError(null);
    setSteps(idleSteps());
    setFindings({});
    setFilename('');
  }

  function handleMessage(message: AnalyzeMessage) {
    switch (message.type) {
      case 'started':
        trackIdRef.current = message.track_id;
        return;
      case 'cancelled':
        setStatus('cancelled');
        return;
      case 'progress':
        setSteps((prev) => advance(prev, message.step, message.done === true, message.pct));
        if (message.info) setFindings((prev) => ({ ...prev, ...message.info }));
        return;
      case 'complete':
        setStatus('done');
        notifyDone(message.track?.title || filename);
        onComplete(message.track);
        return;
      default:
        setError({ message: message.msg, trace: message.trace || '' });
        setStatus('error');
    }
  }

  return { steps, findings, startedAt, filename, error, status, start, cancel, dismiss };
}

export type AnalysisState = ReturnType<typeof useAnalysis>;

/** Apply one progress message: the step becomes active (or done), steps before it that
 *  never ran (vocal separation when it is unavailable) are skipped. */
function advance(prev: Record<StepId, StepProgress>, step: StepId, done: boolean, pct: number | undefined): Record<StepId, StepProgress> {
  const next = { ...prev };
  const index = ANALYSIS_STEPS.findIndex((item) => item.id === step);
  ANALYSIS_STEPS.slice(0, index).forEach(({ id }) => {
    if (next[id].status === 'idle') next[id] = { ...next[id], status: 'skipped' };
    else if (next[id].status === 'active') next[id] = { ...next[id], status: 'done' };
  });
  const current = next[step];
  const now = Date.now();
  const reported = pct !== undefined && pct !== current.pct;
  next[step] = {
    ...current,
    status: done ? 'done' : 'active',
    pct: done ? 100 : pct ?? current.pct,
    pctAt: reported ? now : current.pctAt,
    prevPct: reported ? current.pct ?? 0 : current.prevPct,
    prevPctAt: reported ? current.pctAt ?? current.startedAt ?? now : current.prevPctAt,
    startedAt: current.startedAt ?? now,
  };
  return next;
}

/** System notification when the window is in the background (works in Electron and browsers). */
function notifyDone(title: string) {
  if (document.hasFocus() || typeof Notification === 'undefined') return;
  const show = () => new Notification(t('analysis.notifyTitle'), { body: t('analysis.notifyBody', { title }) });
  if (Notification.permission === 'granted') show();
  else if (Notification.permission !== 'denied') void Notification.requestPermission().then((result) => result === 'granted' && show());
}
