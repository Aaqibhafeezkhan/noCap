import { useMemo, useState } from 'react';
import { barWords } from '../../flow/lyrics';
import type { SheetSection } from '../../flow/lyricSheet';
import { t } from '../../i18n';
import type { FlowMap } from '../../types';

type Props = {
  flowmap: FlowMap;
  sections: SheetSection[];
  saving: boolean;
  onSave: (bars: Record<number, string>) => void;
  onCancel: () => void;
};

/** Every bar as an editable line (instrumental bars too, so lyrics can be added there). */
export function LyricsEditor({ flowmap, sections, saving, onSave, onCancel }: Props) {
  const original = useMemo(() => {
    const text = new Map<number, string>();
    for (const bar of flowmap.bars) text.set(bar.bar_no, barWords(flowmap, bar.bar_no).map((word) => word.text).join(' '));
    return text;
  }, [flowmap]);
  const [draft, setDraft] = useState<Map<number, string>>(() => new Map(original));
  const changed = [...draft].filter(([bar, text]) => normalize(text) !== normalize(original.get(bar) ?? ''));

  function save() {
    onSave(Object.fromEntries(changed.map(([bar, text]) => [bar, normalize(text)])));
  }

  return (
    <form className="lyrics-editor" onSubmit={(event) => { event.preventDefault(); save(); }}>
      <div className="lyrics-editor-bar">
        <span className="lyrics-editor-hint">{t('lyrics.edit.hint')}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={saving}>{t('lyrics.edit.cancel')}</button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving || changed.length === 0}>
          {saving ? t('lyrics.edit.saving') : t('lyrics.edit.save', { count: changed.length })}
        </button>
      </div>
      {sections.map((section) => (
        <section key={`${section.fromBar}-${section.toBar}`} className="lyrics-section">
          {section.label && <h2 className="lyrics-section-title">{section.label}</h2>}
          <ol className="lyrics-lines">
            {flowmap.bars.filter((bar) => bar.bar_no >= section.fromBar && bar.bar_no <= section.toBar).map((bar) => (
              <li key={bar.bar_no} className="lyrics-row">
                <label className="lyrics-bar" htmlFor={`lyric-${bar.bar_no}`}>{bar.bar_no}</label>
                <input
                  id={`lyric-${bar.bar_no}`}
                  className={`lyrics-input ${normalize(draft.get(bar.bar_no) ?? '') !== normalize(original.get(bar.bar_no) ?? '') ? 'is-changed' : ''}`}
                  value={draft.get(bar.bar_no) ?? ''}
                  placeholder={t('lyrics.instrumental')}
                  disabled={saving}
                  onChange={(event) => setDraft(new Map(draft).set(bar.bar_no, event.target.value))}
                />
              </li>
            ))}
          </ol>
        </section>
      ))}
    </form>
  );
}

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}
