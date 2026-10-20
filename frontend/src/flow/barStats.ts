import type { FlowBar, FlowMap, FlowSyllable } from '../types';
import { FLOW_DIMS, groupSyllablesByBar } from './layout';

export type BarMetricKey = 'density' | 'syncopation_score' | 'pocket_offset' | 'timing_variance' | 'stressed_ratio' | 'syllable_count';

export const BAR_METRICS: BarMetricKey[] = ['density', 'syncopation_score', 'pocket_offset', 'timing_variance', 'stressed_ratio', 'syllable_count'];

export function trackAverages(bars: FlowBar[]): Record<BarMetricKey, number> {
  const count = Math.max(1, bars.length);
  const result = {} as Record<BarMetricKey, number>;
  for (const key of BAR_METRICS) result[key] = bars.reduce((sum, bar) => sum + bar[key], 0) / count;
  return result;
}

export function trackMax(bars: FlowBar[]): Record<BarMetricKey, number> {
  const result = {} as Record<BarMetricKey, number>;
  for (const key of BAR_METRICS) result[key] = Math.max(0.0001, ...bars.map((bar) => Math.abs(bar[key])));
  return result;
}

export function formatBarMetric(key: BarMetricKey, value: number): string {
  if (key === 'syncopation_score' || key === 'stressed_ratio') return `${Math.round(value * 100)}%`;
  if (key === 'pocket_offset') return `${value >= 0 ? '+' : ''}${value.toFixed(3)}`;
  if (key === 'timing_variance') return (value * 100).toFixed(1);
  if (key === 'syllable_count') return value.toFixed(0);
  return value.toFixed(2);
}

/** 16-slot onset pattern of a bar (which 16th notes carry a syllable), weighted by stress. */
function rhythmVector(syllables: FlowSyllable[], signature: number): number[] {
  const slots = new Array(signature * FLOW_DIMS.subdivs).fill(0);
  for (const syllable of syllables) {
    const slot = Math.round((syllable.beat_no - 1 + syllable.beat_pos) * FLOW_DIMS.subdivs);
    if (slot >= 0 && slot < slots.length) slots[slot] += syllable.stress ? 1 : 0.6;
  }
  return slots;
}

function cosine(left: number[], right: number[]): number {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] ** 2;
    rightNorm += right[index] ** 2;
  }
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : 0;
}

export interface SimilarBar { barNo: number; score: number }

/** Bars whose rhythm pattern and density are closest to the given bar. */
export function similarBars(flowmap: FlowMap, barNo: number, limit = 5): SimilarBar[] {
  const signature = flowmap.metadata.time_signature || 4;
  const byBar = groupSyllablesByBar(flowmap.syllables);
  const target = byBar.get(barNo) || [];
  if (target.length < 2) return [];
  const targetVector = rhythmVector(target, signature);
  const targetBar = flowmap.bars.find((bar) => bar.bar_no === barNo);
  const maxDensity = Math.max(0.01, ...flowmap.bars.map((bar) => bar.density));
  return flowmap.bars
    .filter((bar) => bar.bar_no !== barNo && (byBar.get(bar.bar_no)?.length || 0) >= 2)
    .map((bar) => {
      const rhythm = cosine(targetVector, rhythmVector(byBar.get(bar.bar_no) || [], signature));
      const densityGap = Math.abs((targetBar?.density || 0) - bar.density) / maxDensity;
      return { barNo: bar.bar_no, score: rhythm * 0.8 + (1 - densityGap) * 0.2 };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}
