import type { FlowBar, FlowBeat, FlowMap } from '../types';

/** The analysis only lists bars that have words. Fill in the rest (intros, instrumental
 *  breaks) from the beat grid so bar numbers never skip; filled bars are marked ``empty``
 *  and carry zero metrics, so metric code must use ``vocalBars`` instead of ``bars``. */
export function withEmptyBars(bars: FlowBar[], beats: FlowBeat[]): FlowBar[] {
  const byNumber = new Map(bars.map((bar) => [bar.bar_no, bar]));
  const numbers = [...new Set([...beats.map((beat) => beat.bar_no), ...byNumber.keys()])].sort((a, b) => a - b);
  if (numbers.length === 0) return bars;
  const all: FlowBar[] = [];
  for (let barNo = numbers[0]; barNo <= numbers[numbers.length - 1]; barNo += 1) {
    all.push(byNumber.get(barNo) ?? emptyBar(barNo));
  }
  return all;
}

/** Bars with words: what averages, rankings and markers are computed from. */
export function vocalBars(flowmap: FlowMap): FlowBar[] {
  return flowmap.bars.filter((bar) => !bar.empty);
}

function emptyBar(barNo: number): FlowBar {
  return {
    bar_no: barNo,
    empty: true,
    syllable_count: 0,
    density: 0,
    syncopation: 0,
    syncopation_score: 0,
    pocket_offset: 0,
    timing_variance: 0,
    stressed_on_beat_ratio: 0,
    stressed_ratio: 0,
    pocket_consistency: 0,
    pocket_confidence: 0,
    pocket_label: 'none',
    onset_density: 0,
    onset_strength_avg: 0,
    vocal_onset_alignment: 0,
    local_bpm: 0,
    tempo_variance: 0,
    tempo_confidence: 0,
    rms_avg: 0,
    spectral_centroid_avg: 0,
    spectral_bandwidth_avg: 0,
    zero_crossing_rate_avg: 0,
  };
}
