import { useRef, useState } from 'react';
import { analyzeTrack, cancelAnalysis } from '../api/analyze';
import { t } from '../i18n';
import type { AnalyzeMessage, LibraryTrack, StepId, StepState } from '../types';

export type AnalysisStatus = 'idle' | 'running' | 'cancelling' | 'done' | 'cancelled' | 'error';

const initialSteps: Record<StepId, StepState> = {
  load: { status: 'idle', msg: '' },
  beat: { status: 'idle', msg: '' },
  transcribe: { status: 'idle', msg: '' },
  align: { status: 'idle', msg: '' },
};

/** One background analysis at a time. Lives at App level so switching screens never
 *  interrupts it; the library shows its progress as a card. */
export function useAnalysis(onComplete: (track: LibraryTrack | undefined) => void) {
  const [steps, setSteps] = useState(initialSteps);
  const [filename, setFilename] = useState('');
  const [error, setError] = useState<{ message: string; trace: string } | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const [transcribePct, setTranscribePct] = useState<number | null>(null);
  const trackIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function start(file: File) {
    if (status === 'running' || status === 'cancelling') return;
    const controller = new AbortController();
    abortRef.current = controller;
    trackIdRef.current = null;
    setFilename(file.name);
    setError(null);
    setSteps(initialSteps);
    setTranscribePct(null);
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
    setSteps(initialSteps);
    setFilename('');
    setTranscribePct(null);
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
        if (message.pct !== undefined) {
          setTranscribePct(message.pct);
          setSteps((prev) => ({ ...prev, [message.step]: { ...prev[message.step], status: 'active' } }));
          return;
        }
        setSteps((prev) => ({
          ...prev,
          [message.step]: { status: message.done ? 'done' : 'active', msg: message.msg || prev[message.step].msg },
        }));
        if (message.step === 'transcribe' && message.done) setTranscribePct(100);
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

  return { steps, filename, error, status, transcribePct, start, cancel, dismiss };
}

export type AnalysisState = ReturnType<typeof useAnalysis>;

/** System notification when the window is in the background (works in Electron and browsers). */
function notifyDone(title: string) {
  if (document.hasFocus() || typeof Notification === 'undefined') return;
  const show = () => new Notification(t('analysis.notifyTitle'), { body: t('analysis.notifyBody', { title }) });
  if (Notification.permission === 'granted') show();
  else if (Notification.permission !== 'denied') void Notification.requestPermission().then((result) => result === 'granted' && show());
}
