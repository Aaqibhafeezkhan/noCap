import type { FlowMap, FlowSyllable } from '../types';
import type { RhymeStyles } from './colors';
import { cleanWord } from './syllableText';

export interface LyricWord {
  wordId: number;
  text: string;
  rhymeGroup: string;
  stressed: boolean;
}

/** The words sung in a bar, in order. A word that starts in the previous bar is kept
 *  where its first syllable lands, so every word appears exactly once per track. */
export function barWords(flowmap: FlowMap, barNo: number): LyricWord[] {
  const firstByWord = new Map<number, FlowSyllable>();
  const rhymeByWord = new Map<number, string>();
  const stressByWord = new Map<number, boolean>();
  for (const syllable of flowmap.syllables) {
    if (!firstByWord.has(syllable.word_id)) firstByWord.set(syllable.word_id, syllable);
    if (syllable.rhyme_group && !rhymeByWord.has(syllable.word_id)) rhymeByWord.set(syllable.word_id, syllable.rhyme_group);
    if (syllable.stress) stressByWord.set(syllable.word_id, true);
  }
  return [...firstByWord.values()]
    .filter((syllable) => syllable.bar_no === barNo)
    .sort((left, right) => left.time - right.time)
    .map((syllable) => ({
      wordId: syllable.word_id,
      text: cleanWord(syllable.word),
      rhymeGroup: rhymeByWord.get(syllable.word_id) || '',
      stressed: stressByWord.get(syllable.word_id) || false,
    }));
}

/** End-rhyme letter of a bar line (A/B/…), or "X" when the line does not end on a rhyme. */
export function lineLetter(words: LyricWord[], styles: RhymeStyles): string {
  const tail = words.slice(-2).reverse().find((word) => word.rhymeGroup);
  if (!tail) return 'X';
  return styles.get(tail.rhymeGroup)?.label || 'X';
}
