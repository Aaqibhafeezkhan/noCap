import type { StepId } from '../types';

/** Steps in order, their share of the overall bar and how long each usually takes, as
 *  measured on an M-series Mac (a 3-minute rap song: ~4 minutes, most of it listening to
 *  the lyrics). ``reports`` steps send real percentages. */
export const ANALYSIS_STEPS: Array<{ id: StepId; from: number; to: number; usualSeconds: number; reports: boolean }> = [
  { id: 'load', from: 0, to: 2, usualSeconds: 2, reports: false },
  { id: 'beat', from: 2, to: 5, usualSeconds: 6, reports: false },
  { id: 'separate', from: 5, to: 17, usualSeconds: 25, reports: true },
  { id: 'transcribe', from: 17, to: 97, usualSeconds: 180, reports: true },
  { id: 'align', from: 97, to: 100, usualSeconds: 4, reports: false },
];

/** Transcription past this point is the second pass over passages it missed. */
export const REPAIR_FROM_PCT = 85;

export interface StepProgress {
  status: 'idle' | 'active' | 'done' | 'skipped';
  /** Real percentage from the analysis, when the step reports one, and when it came. */
  pct: number | null;
  pctAt: number | null;
  /** The report before it, to know the size and pace of the next one. */
  prevPct: number;
  prevPctAt: number | null;
  startedAt: number | null;
}

export function idleSteps(): Record<StepId, StepProgress> {
  const steps = {} as Record<StepId, StepProgress>;
  for (const step of ANALYSIS_STEPS) steps[step.id] = { status: 'idle', pct: null, pctAt: null, prevPct: 0, prevPctAt: null, startedAt: null };
  return steps;
}

/** Overall progress 0–100, moving even between reports:
 *  - a step that reports percentages glides from its last report towards the next one at
 *    the pace of the previous reports (Whisper reports every 30 s of audio);
 *  - before its first report it creeps only a little, so a low first report never stalls it;
 *  - a step without percentages creeps towards 90 % of its share over its usual duration. */
export function overallProgress(steps: Record<StepId, StepProgress>, now: number): number {
  let value = 0;
  for (const step of ANALYSIS_STEPS) {
    const state = steps[step.id];
    if (state.status === 'done' || state.status === 'skipped') value = step.to;
    else if (state.status === 'active') {
      const started = state.startedAt ?? now;
      const fraction = state.pct !== null
        ? Math.min(100, state.pct + glide(state, now)) / 100
        : creep(now - started, step.usualSeconds) * (step.reports ? 0.12 : 1);
      value = step.from + (step.to - step.from) * fraction;
    }
  }
  return value;
}

function glide(state: StepProgress, now: number): number {
  const pct = state.pct ?? 0;
  const pctAt = state.pctAt ?? now;
  const size = Math.max(2, pct - state.prevPct);
  const interval = Math.max(1000, pctAt - (state.prevPctAt ?? state.startedAt ?? pctAt));
  return size * 0.9 * (1 - Math.exp(-(now - pctAt) / interval));
}

function creep(elapsedMs: number, usualSeconds: number): number {
  return 0.9 * (1 - Math.exp((-2 * elapsedMs) / 1000 / usualSeconds));
}

/** Seconds left from the pace so far, or null until there is enough to go on. */
export function secondsLeft(progress: number, elapsedMs: number): number | null {
  if (progress < 15 || elapsedMs < 10_000) return null;
  return ((100 - progress) * elapsedMs) / progress / 1000;
}
