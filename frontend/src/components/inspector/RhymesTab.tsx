import { useMemo } from 'react';
import { colorToCss, type RhymeStyles } from '../../flow/colors';
import { phoneticToIpa } from '../../flow/phonetics';
import { cleanWord } from '../../flow/syllableText';
import { t } from '../../i18n';
import type { FlowMap } from '../../types';

interface GroupSummary {
  group: string;
  label: string;
  color: string;
  featured: boolean;
  ipa: string;
  words: string[];
  syllables: number;
  firstBar: number;
  lastBar: number;
  spread: number[];
}

const SPREAD_BINS = 24;

export function RhymesTab({ flowmap, styles, activeRhyme, onActiveRhymeChange, onFocusBar }: {
  flowmap: FlowMap;
  styles: RhymeStyles;
  activeRhyme: string | null;
  onActiveRhymeChange: (group: string | null) => void;
  onFocusBar: (barNo: number) => void;
}) {
  const groups = useMemo(() => summarize(flowmap, styles), [flowmap, styles]);
  if (groups.length === 0) return <p className="insp-empty">{t('inspector.rhymes.empty')}</p>;

  return (
    <>
      <p className="insp-hint">{t('inspector.rhymes.hint')}</p>
      <ul className="rhyme-list">
        {groups.map((group) => {
          const active = activeRhyme === group.group;
          return (
            <li key={group.group}>
              <button
                className={`rhyme-item ${active ? 'is-active' : ''} ${group.featured ? '' : 'is-minor'}`}
                aria-pressed={active}
                onClick={() => onActiveRhymeChange(active ? null : group.group)}
                onDoubleClick={() => onFocusBar(group.firstBar)}
              >
                <span className="rhyme-letter" style={{ background: group.color }}>{group.label}</span>
                <span className="rhyme-main">
                  <span className="rhyme-top">
                    {group.ipa && <span className="rhyme-ipa">{group.ipa}</span>}
                    <span className="rhyme-words">{group.words.join(' · ')}</span>
                  </span>
                  <span className="rhyme-meta">
                    {t('inspector.rhymes.meta', { count: group.syllables, start: group.firstBar, end: group.lastBar })}
                  </span>
                  <Spread values={group.spread} color={group.color} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Spread({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(1, ...values);
  return (
    <span className="rhyme-spread" aria-hidden="true">
      {values.map((value, index) => (
        <i key={index} style={{ height: `${value ? 20 + (value / max) * 80 : 0}%`, background: color }} />
      ))}
    </span>
  );
}

function summarize(flowmap: FlowMap, styles: RhymeStyles): GroupSummary[] {
  const keys = new Map(flowmap.rhyme_groups.map((group) => [group.id, group.phonetic_key]));
  const lastBar = flowmap.bars[flowmap.bars.length - 1]?.bar_no || 1;
  const bySyllables = new Map<string, { bars: number[]; words: Map<string, number> }>();
  for (const syllable of flowmap.syllables) {
    if (!syllable.rhyme_group) continue;
    const entry = bySyllables.get(syllable.rhyme_group) || { bars: [] as number[], words: new Map<string, number>() };
    entry.bars.push(syllable.bar_no);
    const word = cleanWord(syllable.word).toLowerCase();
    if (word) entry.words.set(word, (entry.words.get(word) || 0) + 1);
    bySyllables.set(syllable.rhyme_group, entry);
  }
  return [...bySyllables.entries()]
    .map(([group, entry]) => {
      const style = styles.get(group);
      const spread = new Array(SPREAD_BINS).fill(0);
      for (const bar of entry.bars) spread[Math.min(SPREAD_BINS - 1, Math.floor(((bar - 1) / lastBar) * SPREAD_BINS))] += 1;
      return {
        group,
        label: style?.label || group,
        color: colorToCss(style?.color ?? 0x6a6a76),
        featured: style?.featured ?? false,
        ipa: phoneticToIpa(keys.get(group)),
        words: [...entry.words.entries()].sort((left, right) => right[1] - left[1]).slice(0, 4).map(([word]) => word),
        syllables: entry.bars.length,
        firstBar: Math.min(...entry.bars),
        lastBar: Math.max(...entry.bars),
        spread,
        rank: style?.rank ?? 999,
      };
    })
    .sort((left, right) => left.rank - right.rank);
}
