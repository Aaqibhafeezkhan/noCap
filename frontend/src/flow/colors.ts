import type { FlowMap } from '../types';
import { CANVAS, FEATURED_RHYMES, RHYME_PALETTE } from './theme';

export interface RhymeStyle {
  group: string;
  /** Colour used on the canvas and in lists. */
  color: number;
  /** True for the strongest groups that get their own palette colour. */
  featured: boolean;
  /** 0-based rank by size (largest group first). */
  rank: number;
  /** Display letter by rank: the largest group is "A", matching the first palette colour. */
  label: string;
  count: number;
}

export type RhymeStyles = Map<string, RhymeStyle>;

/** Ranks rhyme groups by size: the largest {@link FEATURED_RHYMES} get the palette,
 *  the rest share a quiet grey and are told apart by their letter label. */
export function buildRhymeStyles(flowmap: FlowMap): RhymeStyles {
  const counts = new Map<string, number>();
  for (const chain of flowmap.rhyme_chains) counts.set(chain.group, chain.count);
  for (const group of flowmap.rhyme_groups) {
    if (!counts.has(group.id)) counts.set(group.id, group.occurrences.length);
  }
  for (const syllable of flowmap.syllables) {
    if (syllable.rhyme_group && !counts.has(syllable.rhyme_group)) counts.set(syllable.rhyme_group, 0);
  }
  const ranked = [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  const styles: RhymeStyles = new Map();
  ranked.forEach(([group, count], rank) => {
    const featured = rank < FEATURED_RHYMES;
    const color = featured ? RHYME_PALETTE[rank] : CANVAS.otherRhyme;
    styles.set(group, { group, count, rank, featured, color, label: rankLetter(rank) });
  });
  return styles;
}

export function rhymeColor(styles: RhymeStyles, group: string | null | undefined): number {
  if (!group) return CANVAS.unrhymed;
  return styles.get(group)?.color ?? CANVAS.otherRhyme;
}

export function rankLetter(rank: number): string {
  let value = rank;
  let label = '';
  do {
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return label;
}

export function colorToCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
