import { ChevronDown, Clipboard, Download, FileText, ListMusic, Timer } from 'lucide-react';
import { lyricsText, downloadLyrics } from '../../export/lyricsExport';
import type { SheetSection } from '../../flow/lyricSheet';
import { usePopover } from '../../hooks/usePopover';
import { t } from '../../i18n';
import type { FlowMap } from '../../types';

export function LyricsExportMenu({ flowmap, sections, onCopied }: { flowmap: FlowMap; sections: SheetSection[]; onCopied: (ok: boolean) => void }) {
  const popover = usePopover();

  function run(action: () => void | Promise<void>) {
    popover.setOpen(false);
    void action();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(lyricsText(sections));
      onCopied(true);
    } catch {
      onCopied(false);
    }
  }

  return (
    <div className="menu" ref={popover.rootRef}>
      <button
        ref={popover.triggerRef}
        className={`btn btn-ghost btn-sm ${popover.open ? 'is-open' : ''}`}
        onClick={popover.toggle}
        aria-haspopup="menu"
        aria-expanded={popover.open}
      >
        <Download size={14} /> {t('export.action')} <ChevronDown size={13} className="menu-chevron" />
      </button>
      {popover.open && (
        <div className="menu-popover menu-popover-sm" role="menu">
          <button role="menuitem" className="menu-item" onClick={() => run(() => downloadLyrics(flowmap, sections, 'txt'))}>
            <FileText size={15} /> <span>{t('lyrics.export.txt')}</span>
          </button>
          <button role="menuitem" className="menu-item" onClick={() => run(() => downloadLyrics(flowmap, sections, 'lrc'))}>
            <ListMusic size={15} /> <span>{t('lyrics.export.lrc')}</span>
          </button>
          <button role="menuitem" className="menu-item" onClick={() => run(() => downloadLyrics(flowmap, sections, 'word-lrc'))}>
            <Timer size={15} /> <span>{t('lyrics.export.wordLrc')}</span>
          </button>
          <button role="menuitem" className="menu-item" onClick={() => run(copy)}>
            <Clipboard size={15} /> <span>{t('lyrics.export.copy')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
