import type { FlowSyllable } from '../types';

/** Splits each word into the syllable pieces the flow map shows inside its blocks.
 *  The FlowMap stores the whole word on every syllable, so the pieces are an
 *  orthographic approximation: break before a consonant that starts a new vowel group. */
export function syllableLabels(syllables: FlowSyllable[]): Map<FlowSyllable, string> {
  const byWord = new Map<number, FlowSyllable[]>();
  for (const syllable of syllables) {
    const list = byWord.get(syllable.word_id);
    if (list) list.push(syllable);
    else byWord.set(syllable.word_id, [syllable]);
  }
  const labels = new Map<FlowSyllable, string>();
  for (const list of byWord.values()) {
    list.sort((left, right) => left.syllable_index - right.syllable_index);
    const pieces = splitWord(cleanWord(list[0].word), list.length);
    list.forEach((syllable, index) => labels.set(syllable, pieces[index] || ''));
  }
  return labels;
}

export function cleanWord(word: string): string {
  return word.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '');
}

export function splitWord(word: string, count: number): string[] {
  if (count <= 1 || word.length <= 1) return [word, ...Array(Math.max(0, count - 1)).fill('')];
  const cuts = vowelGroupCuts(word);
  if (cuts.length >= count - 1) return cutAt(word, pickEven(cuts, count - 1));
  return evenChunks(word, count);
}

const VOWELS = /[aeiouyàáâäèéêëìíîïòóôöùúûü]/i;
/** Consonant pairs that stay together at the start of the next syllable (mo-ther). */
const LEADING_DIGRAPHS = new Set(['th', 'sh', 'ch', 'ph', 'wh', 'gh', 'bl', 'pl', 'cl', 'gl', 'fl', 'br', 'tr', 'dr', 'cr', 'gr', 'pr']);

/** Cut points between vowel groups: one consonant goes with the next vowel (ta-ble),
 *  a cluster splits after its first consonant (hap-py). A trailing silent "e" is not a group. */
function vowelGroupCuts(word: string): number[] {
  const groups: Array<[number, number]> = [];
  for (let index = 0; index < word.length; index += 1) {
    if (!VOWELS.test(word[index])) continue;
    const last = groups[groups.length - 1];
    if (last && last[1] === index) last[1] = index + 1;
    else groups.push([index, index + 1]);
  }
  const lower = word.toLowerCase();
  const tail = groups[groups.length - 1];
  const consonantLe = /[^aeiouy]le$/.test(lower);
  if (groups.length > 1 && tail[0] === word.length - 1 && lower.endsWith('e') && !consonantLe) groups.pop();
  const cuts: number[] = [];
  for (let index = 1; index < groups.length; index += 1) {
    const gapStart = groups[index - 1][1];
    const gap = groups[index][0] - gapStart;
    const cluster = lower.slice(gapStart, gapStart + 2);
    if (gap <= 1 || (gap === 2 && LEADING_DIGRAPHS.has(cluster))) cuts.push(gapStart);
    else if (cluster === 'ck') cuts.push(gapStart + 2);
    else cuts.push(gapStart + 1);
  }
  return cuts.filter((cut) => cut > 0 && cut < word.length);
}

function pickEven(cuts: number[], needed: number): number[] {
  if (cuts.length === needed) return cuts;
  const step = cuts.length / needed;
  return Array.from({ length: needed }, (_, index) => cuts[Math.floor(index * step + step / 2)]);
}

function cutAt(word: string, cuts: number[]): string[] {
  const pieces: string[] = [];
  let start = 0;
  for (const cut of cuts) {
    pieces.push(word.slice(start, cut));
    start = cut;
  }
  pieces.push(word.slice(start));
  return pieces;
}

function evenChunks(word: string, count: number): string[] {
  const size = word.length / count;
  return Array.from({ length: count }, (_, index) => word.slice(Math.round(index * size), Math.round((index + 1) * size)));
}
