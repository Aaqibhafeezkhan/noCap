import type { FlowMap } from '../types';
import { barWords, type LyricWord } from './lyrics';

export type SheetRow =
  | { kind: 'line'; barNo: number; words: LyricWord[] }
  | { kind: 'instrumental'; fromBar: number; toBar: number };

export interface SheetSection {
  label: string | null;
  fromBar: number;
  toBar: number;
  rows: SheetRow[];
}

/** The whole track as a lyric sheet: one line per bar, grouped by section, with runs of
 *  bars that have no words folded into a single "instrumental" row. */
export function lyricSheet(flowmap: FlowMap): SheetSection[] {
  const barNumbers = flowmap.bars.map((bar) => bar.bar_no);
  if (barNumbers.length === 0) return [];
  const spans = flowmap.sections.length
    ? flowmap.sections.map((section) => ({ label: section.label, from: section.start_bar, to: section.end_bar }))
    : [{ label: null, from: barNumbers[0], to: barNumbers[barNumbers.length - 1] }];
  return spans.map(({ label, from, to }) => ({
    label,
    fromBar: from,
    toBar: to,
    rows: rowsFor(flowmap, barNumbers.filter((barNo) => barNo >= from && barNo <= to)),
  }));
}

function rowsFor(flowmap: FlowMap, barNumbers: number[]): SheetRow[] {
  const rows: SheetRow[] = [];
  for (const barNo of barNumbers) {
    const words = barWords(flowmap, barNo);
    const last = rows[rows.length - 1];
    if (words.length > 0) rows.push({ kind: 'line', barNo, words });
    else if (last?.kind === 'instrumental') last.toBar = barNo;
    else rows.push({ kind: 'instrumental', fromBar: barNo, toBar: barNo });
  }
  return rows;
}

