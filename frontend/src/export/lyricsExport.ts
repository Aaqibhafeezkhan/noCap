import type { SheetSection } from '../flow/lyricSheet';
import type { FlowMap } from '../types';
import { downloadBlob, safeName } from './flowExport';

type Line = { start: number; words: { text: string; start: number }[] };

/** Lyric lines with each word's start time, section by section. */
function timedLines(flowmap: FlowMap, sections: SheetSection[]): Line[][] {
  const startById = new Map(flowmap.words.map((word) => [word.id, word.start]));
  return sections.map((section) => section.rows.flatMap((row) => {
    if (row.kind !== 'line') return [];
    const words = row.words.map((word) => ({ text: word.text, start: startById.get(word.wordId) ?? 0 }));
    return [{ start: words[0]?.start ?? 0, words }];
  }));
}

/** One bar per line, a blank line between sections. */
export function lyricsText(sections: SheetSection[]): string {
  return sections
    .map((section) => section.rows.flatMap((row) => (row.kind === 'line' ? [row.words.map((w) => w.text).join(' ')] : [])).join('\n'))
    .filter(Boolean)
    .join('\n\n');
}

/** LRC: a [mm:ss.xx] time per line; with ``perWord`` also a <mm:ss.xx> time before every word. */
export function lyricsLrc(flowmap: FlowMap, sections: SheetSection[], perWord: boolean): string {
  const header = [`[ti:${flowmap.metadata.title}]`, `[length:${stamp(flowmap.metadata.duration).slice(0, 5)}]`, '[re:noCap]'];
  const lines = timedLines(flowmap, sections).flat().map((line) => {
    const text = perWord ? line.words.map((word) => `<${stamp(word.start)}>${word.text}`).join(' ') : line.words.map((w) => w.text).join(' ');
    return `[${stamp(line.start)}]${text}`;
  });
  return [...header, ...lines].join('\n') + '\n';
}

function stamp(seconds: number): string {
  const total = Math.max(0, Math.round(seconds * 100));
  const minutes = Math.floor(total / 6000);
  const rest = (total % 6000) / 100;
  return `${String(minutes).padStart(2, '0')}:${rest.toFixed(2).padStart(5, '0')}`;
}

export function downloadLyrics(flowmap: FlowMap, sections: SheetSection[], format: 'txt' | 'lrc' | 'word-lrc'): void {
  const text = format === 'txt' ? lyricsText(sections) + '\n' : lyricsLrc(flowmap, sections, format === 'word-lrc');
  const suffix = format === 'word-lrc' ? '.word.lrc' : `.${format}`;
  downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${safeName(flowmap.metadata.title)}${suffix}`);
}
