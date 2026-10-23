import { colorToCss, type RhymeStyles } from '../../flow/colors';
import { barWords, lineLetter } from '../../flow/lyrics';
import { t } from '../../i18n';
import type { FlowMap } from '../../types';

/** Lyric lines of the selected bars with rhymed words coloured and the end-rhyme letter. */
export function BarLyrics({ flowmap, styles, barNumbers }: { flowmap: FlowMap; styles: RhymeStyles; barNumbers: number[] }) {
  return (
    <ol className="lyric-lines">
      {barNumbers.map((barNo) => {
        const words = barWords(flowmap, barNo);
        const letter = lineLetter(words, styles);
        return (
          <li key={barNo} className="lyric-line">
            <span className="lyric-bar">{barNo}</span>
            <span className={`lyric-letter ${letter === 'X' ? 'is-none' : ''}`} title={t('inspector.bar.letterTitle')}>{letter}</span>
            <span className="lyric-text">
              {words.length === 0 && <em className="lyric-empty">{t('inspector.bar.noWords')}</em>}
              {words.map((word) => {
                const found = word.rhymeGroup ? styles.get(word.rhymeGroup) : undefined;
                const style = found?.featured ? found : undefined; // smaller groups stay plain text
                return (
                  <span
                    key={word.wordId}
                    className={`lyric-word ${word.stressed ? 'is-stressed' : ''} ${style ? 'is-rhymed' : ''}`}
                    style={style ? { color: colorToCss(style.color) } : undefined}
                    title={style ? t('inspector.bar.wordRhyme', { label: style.label }) : undefined}
                  >
                    {word.text}
                  </span>
                );
              })}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
