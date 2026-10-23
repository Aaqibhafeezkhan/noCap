import { messages } from './messages';

export type I18nKey = keyof typeof messages;

export function t(key: I18nKey, values: Record<string, string | number> = {}): string {
  return messages[key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? `{${name}}`));
}

/** "bars 3–7", or "bar 5" when the range is a single bar. */
export function barSpan(start: number, end: number): string {
  return start === end ? t('sections.bar', { bar: start }) : t('sections.bars', { start, end });
}
