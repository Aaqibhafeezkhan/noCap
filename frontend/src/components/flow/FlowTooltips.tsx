import type { RhymeStyles } from '../../flow/colors';
import { colorToCss } from '../../flow/colors';
import type { SyllableRect } from '../../flow/layout';
import type { MarkerKind } from '../../flow/markers';
import { t } from '../../i18n';
import type { FlowBar } from '../../types';

export type TooltipContent =
  | { kind: 'syllable'; rect: SyllableRect }
  | { kind: 'bar'; bar: FlowBar }
  | { kind: 'marker'; marker: MarkerKind };

export interface TooltipState {
  x: number;
  y: number;
  content: TooltipContent;
}

export function FlowTooltip({ tooltip, styles }: { tooltip: TooltipState; styles: RhymeStyles }) {
  return (
    <div className="tooltip" role="tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
      {tooltip.content.kind === 'syllable' && <SyllableBody rect={tooltip.content.rect} styles={styles} />}
      {tooltip.content.kind === 'bar' && <BarBody bar={tooltip.content.bar} />}
      {tooltip.content.kind === 'marker' && <MarkerBody marker={tooltip.content.marker} />}
    </div>
  );
}

function SyllableBody({ rect, styles }: { rect: SyllableRect; styles: RhymeStyles }) {
  const syllable = rect.syllable;
  const style = syllable.rhyme_group ? styles.get(syllable.rhyme_group) : undefined;
  const offset = rect.pocketMs;
  const offsetText = Math.abs(offset) < 10
    ? t('tooltip.onGrid')
    : t(offset < 0 ? 'tooltip.ahead' : 'tooltip.behind', { ms: Math.abs(offset) });
  return (
    <>
      <div className="tt-title">{syllable.word}</div>
      <Row label={t('tooltip.position')} value={t('tooltip.barBeat', { bar: syllable.bar_no, beat: (syllable.beat_no + syllable.beat_pos).toFixed(2) })} />
      <Row label={t('tooltip.stress')} value={syllable.stress ? t('tooltip.stressed') : t('tooltip.unstressed')} />
      <Row label={t('tooltip.timing')} value={offsetText} />
      <Row label={t('tooltip.duration')} value={`${Math.round((syllable.end - syllable.start) * 1000)} ms`} />
      {style && (
        <div className="tt-row">
          <span>{t('tooltip.rhyme')}</span>
          <b><i className="tt-swatch" style={{ background: colorToCss(style.color) }} />{style.label}</b>
        </div>
      )}
      <div className="tt-hint">{t('tooltip.clickToPlay')}</div>
    </>
  );
}

function BarBody({ bar }: { bar: FlowBar }) {
  return (
    <>
      <div className="tt-title">{t('tooltip.barTitle', { bar: bar.bar_no })}</div>
      <Row label={t('metrics.density')} value={t('units.sylPerBeat', { value: bar.density.toFixed(2) })} />
      <Row label={t('metrics.syllables')} value={String(bar.syllable_count)} />
      <Row label={t('metrics.syncopation')} value={`${Math.round(bar.syncopation_score * 100)}%`} />
    </>
  );
}

function MarkerBody({ marker }: { marker: MarkerKind }) {
  return (
    <>
      <div className="tt-title">{t(`marker.${marker}.title`)}</div>
      <div className="tt-text">{t(`marker.${marker}.body`)}</div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="tt-row"><span>{label}</span><b>{value}</b></div>;
}
