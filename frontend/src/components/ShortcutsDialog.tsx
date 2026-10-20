import { X } from 'lucide-react';
import { useDialog } from '../hooks/useDialog';
import { t } from '../i18n';

const GROUPS: Array<{ title: 'shortcuts.playback' | 'shortcuts.navigation' | 'shortcuts.view'; items: Array<[string[], Parameters<typeof t>[0]]> }> = [
  {
    title: 'shortcuts.playback',
    items: [
      [['Space'], 'shortcuts.playPause'],
      [['Enter'], 'shortcuts.playSelection'],
      [['L'], 'shortcuts.loop'],
      [['V'], 'shortcuts.source'],
    ],
  },
  {
    title: 'shortcuts.navigation',
    items: [
      [['←', '→'], 'shortcuts.bars'],
      [['⇧', 'Click'], 'shortcuts.range'],
      [['↑', '↓'], 'shortcuts.scroll'],
      [['Esc'], 'shortcuts.clear'],
    ],
  },
  {
    title: 'shortcuts.view',
    items: [
      [['⌘', '+'], 'shortcuts.zoomIn'],
      [['⌘', '−'], 'shortcuts.zoomOut'],
      [['⌘', '0'], 'shortcuts.zoomReset'],
      [['I'], 'shortcuts.inspector'],
      [['1', '2', '3'], 'shortcuts.screens'],
      [['?'], 'shortcuts.help'],
    ],
  },
];

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const ref = useDialog(onClose);
  return (
    <div className="modal-backdrop" role="presentation" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={ref} className="modal" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title">
        <div className="modal-head">
          <h2 id="shortcuts-title">{t('shortcuts.title')}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('shortcuts.close')}><X size={16} /></button>
        </div>
        <div className="shortcut-groups">
          {GROUPS.map((group) => (
            <section key={group.title}>
              <h3>{t(group.title)}</h3>
              <dl>
                {group.items.map(([keys, label]) => (
                  <div key={label}>
                    <dt>{keys.map((key) => <kbd key={key}>{key}</kbd>)}</dt>
                    <dd>{t(label)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
