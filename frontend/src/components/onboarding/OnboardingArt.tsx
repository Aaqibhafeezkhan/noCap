import { BarChart3, Play, Route, ScrollText, Upload } from 'lucide-react';
import { t } from '../../i18n';

export type ArtKind = 'welcome' | 'grid' | 'rhyme' | 'screens' | 'ready';

const W = 320;
const H = 140;
const ROWS = 4;
const COLS = 16;
const CELL = 17;
const LEFT = (W - COLS * CELL) / 2 + 8;
const TOP = (H - ROWS * 26) / 2 + 4;

/** Syllables per row as [column, span], loosely like a real verse: busy, busy, a breath, busy. */
const VERSE: Array<Array<[number, number]>> = [
  [[0, 1], [1, 1], [2, 2], [4, 1], [6, 1], [7, 1], [8, 2], [11, 1], [12, 1], [14, 2]],
  [[0, 1], [2, 1], [3, 1], [4, 2], [7, 1], [8, 1], [10, 1], [11, 1], [12, 2], [14, 2]],
  [[1, 1], [2, 1], [4, 3], [8, 1], [9, 1], [10, 2]],
  [[0, 1], [1, 1], [2, 1], [3, 1], [5, 1], [6, 2], [8, 1], [10, 1], [11, 1], [12, 1], [14, 2]],
];
/** Which syllables rhyme (row → index → colour) and which sit off the beat (−1 early, 1 late). */
const RHYMES: Record<string, string> = { '0-2': 'a', '0-9': 'b', '1-4': 'a', '1-9': 'b', '2-2': 'c', '2-5': 'a', '3-6': 'c', '3-10': 'b' };
const OFFSETS: Record<string, number> = { '0-4': -1, '1-6': 1, '2-4': 1, '3-3': -1, '3-8': 1 };

/** Small drawings for the welcome dialog, built from the app's own colours (no screenshots). */
export function OnboardingArt({ kind }: { kind: ArtKind }) {
  if (kind === 'screens') return <ScreensArt />;
  if (kind === 'ready') return <ReadyArt />;
  return (
    <svg className="intro-art" viewBox={`0 0 ${W} ${H}`} role="presentation" aria-hidden="true">
      {kind === 'welcome' ? <WelcomeArt /> : <Verse colour={kind === 'rhyme'} />}
    </svg>
  );
}

function Verse({ colour }: { colour: boolean }) {
  return (
    <g>
      {Array.from({ length: COLS + 1 }, (_, col) => (
        <line key={col} x1={LEFT + col * CELL} x2={LEFT + col * CELL} y1={TOP - 6} y2={TOP + ROWS * 26 - 6}
          className={col % 4 === 0 ? 'intro-beat' : 'intro-sub'} />
      ))}
      {VERSE.map((row, r) => (
        <g key={r}>
          <text x={LEFT - 10} y={TOP + r * 26 + 9} className="intro-bar-no">{r + 1}</text>
          {row.map(([col, span], i) => {
            const rhyme = colour ? RHYMES[`${r}-${i}`] : undefined;
            const offset = colour ? OFFSETS[`${r}-${i}`] : undefined;
            const x = LEFT + col * CELL + 1.5;
            const y = TOP + r * 26;
            const width = span * CELL - 3;
            return (
              <g key={i} className="intro-syllable" style={{ animationDelay: `${(r * 10 + i) * 18}ms` }}>
                <rect x={x} y={y} width={width} height={14} rx={3} fill={rhyme ? `var(--rh-${rhyme})` : 'var(--rh-none)'} />
                {offset !== undefined && <rect x={x + width / 2 - 3 + offset * 4} y={y + 16} width={6} height={2.5} rx={1} fill="var(--text-2)" />}
              </g>
            );
          })}
        </g>
      ))}
    </g>
  );
}

function WelcomeArt() {
  const wave = [6, 14, 24, 12, 30, 18, 8, 26, 34, 16, 10, 22, 28, 12, 6];
  return (
    <g>
      {wave.map((height, i) => (
        <rect key={i} x={28 + i * 7} y={H / 2 - height / 2} width={4} height={height} rx={2} fill="var(--muted)" />
      ))}
      <path d={`M 148 ${H / 2} h 24 m -7 -6 l 7 6 l -7 6`} className="intro-arrow" />
      {VERSE.slice(0, 3).map((row, r) => row.slice(0, 7).map(([col, span], i) => (
        <rect key={`${r}-${i}`} className="intro-syllable" style={{ animationDelay: `${(r * 7 + i) * 30}ms` }}
          x={190 + col * 10} y={H / 2 - 30 + r * 22} width={span * 10 - 2} height={12} rx={2.5}
          fill={i % 3 === 2 ? `var(--rh-${'abc'[r]})` : 'var(--rh-none)'} />
      )))}
    </g>
  );
}

function ScreensArt() {
  const screens = [
    { key: '1', icon: Route, label: t('app.nav.flow') },
    { key: '2', icon: BarChart3, label: t('app.nav.report') },
    { key: '3', icon: ScrollText, label: t('app.nav.lyrics') },
  ];
  return (
    <div className="intro-art intro-screens" aria-hidden="true">
      {screens.map(({ key, icon: Icon, label }) => (
        <div key={key} className="intro-screen">
          <Icon size={22} />
          <span>{label}</span>
          <kbd>{key}</kbd>
        </div>
      ))}
    </div>
  );
}

function ReadyArt() {
  return (
    <div className="intro-art intro-ready" aria-hidden="true">
      <span className="intro-ready-icon is-accent"><Play size={22} fill="currentColor" /></span>
      <span className="intro-ready-or">{t('intro.or')}</span>
      <span className="intro-ready-icon"><Upload size={22} /></span>
    </div>
  );
}
