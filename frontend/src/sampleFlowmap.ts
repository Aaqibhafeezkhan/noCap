import type { FlowMap, FlowWord } from './types';
import { normalizeFlowMap } from './flow/normalize';

// Demo verse written for noCap (no third-party lyrics). One string per bar; each token
// is a syllable: `*` = stressed, `@slot` = 16th-note slot (0–15), `~len` = length in
// 16ths, `/G` = rhyme group, and a trailing `-` joins the next token into one word.
const VERSE = [
  '*late@0~2/A *night@2~2/A *cit-@5~1 y@6~1 *lights@7~2/A I\'m@10~1/A *writ-@11~2/A ing@13~1 *ev-@14~1 ery@15~1',
  '*line@0~3/A I@3~1/A *count@4~1 the@5~1 *syl-@6~1 la-@7~1 bles@8~1 *right@10~2/A on@12~1 *time@13~3/A',
  '*pen@0~2 *moves@2~2/C the@5~1 *beat@6~2 *grooves@8~2/C the@11~1 *rhy-@12~1/F thm@13~1/F in@14~1 my@15~1/A',
  '*mind@0~3/A *ev-@4~1 ery@5~1 *bar@6~2 a@8~1 *blue-@9~2/C print@11~1 *all@12~1 de-@13~1 *signed@14~2/A',
  '*pock-@0~1/E et@1~1 on@2~1 the@3~1 *snare@4~3/E I@8~1/A *lean@9~1 be-@10~1 *hind@11~2/A the@13~1 *kick@14~2/B',
  '*dou-@0~1 ble@1~1 *time@2~1/A the@3~1 *hi-@4~1/A *hat@5~2/F *make@8~1 the@9~1 *pat-@10~1/F tern@11~1 *stick@12~3/B',
  '*rhymes@0~2/A *stack@2~2/F in@4~1 *chains@5~2 I@8~1/A *keep@9~1 the@10~1 *vow-@11~1 els@12~1 *thick@13~3/B',
  '*watch@0~2 the@2~1 *grid@3~2/B *light@5~2/A *up@7~1 when@9~1 *ev-@10~1 ery@11~1 *block@12~2 *clicks@14~2/B',
];

const KEYS: Record<string, string> = { A: 'AY', B: 'IH K', C: 'UW', E: 'EH R', F: 'AE' };
const BPM = 92;
/** Bar 5 is rapped slightly behind the beat to show the pocket notch. */
const LEAN: Record<number, number> = { 5: 0.05, 6: 0.03 };

interface Token { text: string; slot: number; len: number; stress: boolean; group: string; joins: boolean }
interface DemoSyllable {
  word: string; word_id: number; syllable_index: number; time: number; start: number; end: number; center_time: number;
  beat_pos: number; beat_no: number; bar_no: number; global_beat_idx: number; beat_index: number;
  stress: boolean; rhyme_group: string; timing_quality: number;
}

function parse(token: string): Token {
  const match = /^(\*?)(.+?)@(\d+)~(\d+)(?:\/(\w))?$/.exec(token);
  if (!match) throw new Error(`bad demo token ${token}`);
  const raw = match[2];
  return { stress: match[1] === '*', text: raw.replace(/-$/, ''), joins: raw.endsWith('-'), slot: Number(match[3]), len: Number(match[4]), group: match[5] || '' };
}

export function sampleFlowmap(): FlowMap {
  const beatSec = 60 / BPM;
  const lead = 1;
  const barCount = VERSE.length;
  const beats = Array.from({ length: barCount * 4 }, (_, index) => ({
    time: lead + index * beatSec,
    beat_no: (index % 4) + 1,
    bar_no: Math.floor(index / 4) + 1,
    onset_strength: index % 2 === 0 ? 0.8 : 0.45,
    local_bpm: BPM,
  }));
  const syllables: DemoSyllable[] = [];
  const words: FlowWord[] = [];
  let wordId = 0;
  let pending: DemoSyllable[] = [];
  VERSE.forEach((line, barIndex) => {
    for (const token of line.split(' ').map(parse)) {
      const barNo = barIndex + 1;
      const pos = token.slot / 4 + (LEAN[barNo] || 0);
      const beatIndex = barIndex * 4 + Math.floor(pos);
      const center = lead + (barIndex * 4 + pos) * beatSec + (token.len * beatSec) / 8;
      const half = (token.len * beatSec * 0.85) / 8;
      const syllable: DemoSyllable = {
        word: token.text, word_id: wordId, syllable_index: pending.length,
        time: center, start: center - half, end: center + half, center_time: center,
        beat_pos: pos % 1, beat_no: Math.floor(pos) + 1, bar_no: barNo,
        global_beat_idx: beatIndex, beat_index: beatIndex,
        stress: token.stress, rhyme_group: token.group, timing_quality: 1,
      };
      syllables.push(syllable);
      pending.push(syllable);
      if (!token.joins) {
        const word = pending.map((item) => item.word).join('');
        pending.forEach((item) => { item.word = word; });
        words.push({
          id: wordId, word, start: pending[0].start, end: pending[pending.length - 1].end, probability: 1,
          syllable_count: pending.length, stress_pattern: pending.map((item) => (item.stress ? 1 : 0)), timing_quality: 1,
        });
        pending = [];
        wordId += 1;
      }
    }
  });
  const bars = VERSE.map((_, index) => {
    const own = syllables.filter((syllable) => syllable.bar_no === index + 1);
    const offBeat = own.filter((syllable) => syllable.beat_pos > 0.02).length;
    return {
      bar_no: index + 1, syllable_count: own.length, density: own.length / 4,
      syncopation: offBeat / Math.max(1, own.length), syncopation_score: offBeat / Math.max(1, own.length),
      stressed_ratio: own.filter((syllable) => syllable.stress).length / Math.max(1, own.length),
      stressed_on_beat_ratio: 0.4, pocket_offset: LEAN[index + 1] || 0, pocket_confidence: LEAN[index + 1] ? 0.6 : 0.85,
      pocket_label: LEAN[index + 1] ? 'behind' : 'center', timing_variance: LEAN[index + 1] ? 0.09 : 0.04,
      local_bpm: BPM, rms_avg: 0.55 + (index % 4) * 0.08, onset_strength_avg: 0.6,
    };
  });
  const groups = [...new Set(syllables.map((syllable) => syllable.rhyme_group).filter(Boolean))];
  const occurrences = (group: string) => syllables.filter((syllable) => syllable.rhyme_group === group);
  return normalizeFlowMap({
    metadata: { title: 'noCap Demo Verse', bpm: BPM, duration: lead + barCount * 4 * beatSec + 1, time_signature: 4, audio_path: null },
    beats,
    syllables,
    words,
    bars,
    rhyme_groups: groups.map((group) => ({
      id: group, type: 'perfect', placement: 'internal', phonetic_key: KEYS[group] || '', strength: 0.9,
      occurrences: occurrences(group).map((syllable) => ({ word_id: syllable.word_id, syllable_start: 0, syllable_end: 0, start: syllable.start, end: syllable.end, time: syllable.time, bar_no: syllable.bar_no, word: syllable.word })),
    })),
    rhyme_chains: groups.map((group) => ({
      group, count: occurrences(group).length,
      occurrences: occurrences(group).map((syllable) => ({ syllable_idx: syllables.indexOf(syllable), word: syllable.word, time: syllable.time, bar_no: syllable.bar_no })),
    })),
    sections: [
      { id: 's1', label: 'Verse A', start_bar: 1, end_bar: 4, bar_count: 4, avg_density: 2.5, syncopation_score: 0.5, local_bpm: BPM, tempo_confidence: 1, rms_avg: 0.6 },
      { id: 's2', label: 'Verse B', start_bar: 5, end_bar: 8, bar_count: 4, avg_density: 2.7, syncopation_score: 0.55, local_bpm: BPM, tempo_confidence: 1, rms_avg: 0.7 },
    ],
    summary: { avg_density: 2.6, peak_density: 2.75, syncopation_score: 0.52, consistency: 0.86, rhyme_chain_avg: 4.8, pocket_score: 0.78, timing_quality_avg: 1, density_variation: 0.08, delivery_consistency: 0.84 },
  });
}
