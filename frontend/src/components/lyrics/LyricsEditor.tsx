import { useMemo, useState, type KeyboardEvent } from 'react';
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
    if (changed.length === 0 || saving) return;
    onSave(Object.fromEntries(changed.map(([bar, text]) => [bar, normalize(text)])));
  }

  function cancel() {
    if (changed.length > 0 && !window.confirm(t('lyrics.edit.discard', { count: changed.length }))) return;
    onCancel();
  }

  function onKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
    } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      save();
    }
  }

  return (
    <form className="lyrics-editor" onSubmit={(event) => { event.preventDefault(); save(); }} onKeyDown={onKeyDown}>
      <div className="lyrics-editor-bar">
        <span className="lyrics-editor-hint">{t('lyrics.edit.hint')}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={cancel} disabled={saving}>{t('lyrics.edit.cancel')}</button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving || changed.length === 0}>
          {saving ? t('lyrics.edit.saving') : t('lyrics.edit.save', { count: changed.length })}
        </button>
      </div>
      {sections.map((section) => (
        <section key={`${section.fromBar}-${section.toBar}`} className="lyrics-section">
          {section.label && <h2 className="lyrics-section-title">{section.label}</h2>}
          <ol className="lyrics-lines">
            {section.bars.map((barNo) => (
              <li key={barNo} className="lyrics-row">
                <label className="lyrics-bar" htmlFor={`lyric-${barNo}`}>{barNo}</label>
                <input
                  id={`lyric-${barNo}`}
                  className={`lyrics-input ${normalize(draft.get(barNo) ?? '') !== normalize(original.get(barNo) ?? '') ? 'is-changed' : ''}`}
                  value={draft.get(barNo) ?? ''}
                  placeholder={t('lyrics.instrumental')}
                  disabled={saving}
                  onChange={(event) => setDraft(new Map(draft).set(barNo, event.target.value))}
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
