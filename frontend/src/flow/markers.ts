import type { FlowBar } from '../types';

export type MarkerKind = 'switch' | 'cut' | 'drift' | 'pocket';

export interface BarMarker {
  kind: MarkerKind;
  /** Values that triggered the marker, for the inspector explanation. */
  detail: Record<string, number>;
}

/** Context markers per bar number. The thresholds are unchanged from the original
 *  canvas overlay; this module only makes them reusable (canvas, legend, inspector). */
export function computeMarkers(bars: FlowBar[]): Map<number, BarMarker[]> {
  const timingLimit = outlierLimit(bars.map((bar) => bar.timing_variance), 0.16, 2.5);
  const pocketLimit = outlierLimit(bars.map((bar) => Math.abs(bar.pocket_offset)), 0.34, 2.8);
  const result = new Map<number, BarMarker[]>();
  bars.forEach((bar, index) => {
    const markers: BarMarker[] = [];
    const prev = index > 0 ? bars[index - 1] : null;
    if (prev && isBeatCut(prev, bar)) {
      markers.push({ kind: 'cut', detail: { energyFrom: prev.rms_avg, energyTo: bar.rms_avg, onsetFrom: prev.onset_strength_avg, onsetTo: bar.onset_strength_avg } });
    } else if (prev && isBeatSwitch(prev, bar)) {
      markers.push({ kind: 'switch', detail: { bpmFrom: prev.local_bpm, bpmTo: bar.local_bpm } });
    }
    if (hasRhythmDrift(bar, timingLimit, pocketLimit)) {
      markers.push({ kind: 'drift', detail: { timing: bar.timing_variance, timingLimit, offset: bar.pocket_offset, offsetLimit: pocketLimit } });
    }
    if (bar.pocket_confidence >= 0.72 && bar.syllable_count >= 4) {
      markers.push({ kind: 'pocket', detail: { confidence: bar.pocket_confidence } });
    }
    if (markers.length) result.set(bar.bar_no, markers);
  });
  return result;
}

function isBeatSwitch(prev: FlowBar, bar: FlowBar) {
  if (prev.local_bpm <= 0 || bar.local_bpm <= 0) return false;
  return Math.abs(prev.local_bpm - bar.local_bpm) >= 4;
}

function isBeatCut(prev: FlowBar, bar: FlowBar) {
  const energyDrop = prev.rms_avg > 0.35 && bar.rms_avg < prev.rms_avg * 0.58;
  const onsetDrop = prev.onset_strength_avg > 0.25 && bar.onset_strength_avg < prev.onset_strength_avg * 0.5;
  return energyDrop || onsetDrop;
}

function hasRhythmDrift(bar: FlowBar, timingLimit: number, pocketLimit: number) {
  if (bar.syllable_count < 4) return false;
  const looseTiming = bar.timing_variance >= timingLimit;
  const pocketDrift = Math.abs(bar.pocket_offset) >= pocketLimit;
  const weakBeatStress = bar.stressed_on_beat_ratio < 0.06 && bar.timing_variance >= timingLimit * 0.8;
  return looseTiming || pocketDrift || weakBeatStress;
}

function outlierLimit(values: number[], floor: number, madScale: number) {
  const usable = values.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (usable.length === 0) return floor;
  const med = median(usable);
  const deviations = usable.map((value) => Math.abs(value - med)).sort((a, b) => a - b);
  return Math.max(floor, med + median(deviations) * madScale, quantile(usable, 0.93));
}

function median(values: number[]) {
  const mid = Math.floor(values.length / 2);
  return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
}

function quantile(values: number[], q: number) {
  return values[Math.min(values.length - 1, Math.floor((values.length - 1) * q))];
}
