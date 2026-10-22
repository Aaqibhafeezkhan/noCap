import { Palette } from 'lucide-react';
import { useMemo, useState } from 'react';
import { colorToCss, type RhymeStyles } from '../../flow/colors';
import { lyricSheet, type SheetRow } from '../../flow/lyricSheet';
import { t } from '../../i18n';
import type { FlowMap } from '../../types';

const COLORS_KEY = 'nocap.lyrics.rhymeColors';

function readColorsSetting(): boolean {
  try {
    return localStorage.getItem(COLORS_KEY) !== 'off';
  } catch {
    return true;
  }
}

function saveColorsSetting(on: boolean) {
  try {
    localStorage.setItem(COLORS_KEY, on ? 'on' : 'off');
  } catch {
    // Storage can be unavailable; the toggle still works for this session.
  }
}

/** The whole track's lyrics as a readable sheet: one line per bar, by section. */
export function LyricsScreen({ flowmap, styles, onOpenBar }: { flowmap: FlowMap; styles: RhymeStyles; onOpenBar: (barNo: number) => void }) {
  const sections = useMemo(() => lyricSheet(flowmap), [flowmap]);
  const [colors, setColors] = useState(readColorsSetting);
  const toggleColors = () => {
    setColors(!colors);
    saveColorsSetting(!colors);
  };
  const hasWords = sections.some((section) => section.rows.some((row) => row.kind === 'line'));

  return (
    <main className="lyrics-screen">
      <div className="lyrics-inner">
        <header className="lyrics-head">
          <div>
            <p className="eyebrow">{t('lyrics.eyebrow')}</p>
            <h1>{flowmap.metadata.title}</h1>
          </div>
          <button className={`btn btn-ghost lyrics-toggle ${colors ? 'is-on' : ''}`} aria-pressed={colors} onClick={toggleColors}>
            <Palette size={14} /> {t('lyrics.rhymeColors')}
          </button>
        </header>
        {!hasWords && <p className="lyrics-empty">{t('lyrics.empty')}</p>}
        {hasWords && sections.map((section) => (
          <section key={`${section.fromBar}-${section.toBar}`} className="lyrics-section" aria-label={section.label ?? undefined}>
            {section.label && (
              <h2 className="lyrics-section-title">
                {section.label} <span>{t('lyrics.barRange', { from: section.fromBar, to: section.toBar })}</span>
              </h2>
            )}
            <ol className="lyrics-lines">
              {section.rows.map((row) => <Row key={rowKey(row)} row={row} styles={styles} colors={colors} onOpenBar={onOpenBar} />)}
            </ol>
          </section>
        ))}
      </div>
    </main>
  );
}

function rowKey(row: SheetRow): string {
  return row.kind === 'line' ? `bar-${row.barNo}` : `rest-${row.fromBar}`;
}

function Row({ row, styles, colors, onOpenBar }: { row: SheetRow; styles: RhymeStyles; colors: boolean; onOpenBar: (barNo: number) => void }) {
  if (row.kind === 'instrumental') {
    const range = row.fromBar === row.toBar ? String(row.fromBar) : `${row.fromBar}–${row.toBar}`;
    return <li className="lyrics-row is-instrumental"><span className="lyrics-bar">{range}</span><span>{t('lyrics.instrumental')}</span></li>;
  }
  return (
    <li className="lyrics-row">
      <button className="lyrics-bar" onClick={() => onOpenBar(row.barNo)} title={t('lyrics.openBar', { bar: row.barNo })}>{row.barNo}</button>
      <p className="lyrics-text">
        {row.words.map((word) => {
          const style = colors && word.rhymeGroup ? styles.get(word.rhymeGroup) : undefined;
          return (
            <span
              key={word.wordId}
              className={style ? 'is-rhymed' : undefined}
              style={style ? { color: colorToCss(style.color) } : undefined}
              title={style ? t('inspector.bar.wordRhyme', { label: style.label }) : undefined}
            >
              {word.text}{' '}
            </span>
          );
        })}
      </p>
    </li>
  );
}
