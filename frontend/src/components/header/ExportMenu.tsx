import { ChevronDown, Download, FileCode2, FileImage } from 'lucide-react';
import { downloadFlowmapPng, downloadFlowmapSvg } from '../../export/flowExport';
import { usePopover } from '../../hooks/usePopover';
import { t } from '../../i18n';
import type { FlowMap } from '../../types';

export function ExportMenu({ flowmap }: { flowmap: FlowMap }) {
  const popover = usePopover();

  function run(action: () => void | Promise<void>) {
    popover.setOpen(false);
    void action();
  }

  return (
    <div className="menu" ref={popover.rootRef}>
      <button
        ref={popover.triggerRef}
        className={`btn btn-ghost btn-sm ${popover.open ? 'is-open' : ''}`}
        onClick={popover.toggle}
        aria-haspopup="menu"
        aria-expanded={popover.open}
        title={t('export.action')}
      >
        <Download size={14} /> <span className="btn-label">{t('export.action')}</span> <ChevronDown size={13} className="menu-chevron" />
      </button>
      {popover.open && (
        <div className="menu-popover menu-popover-sm" role="menu">
          <button role="menuitem" className="menu-item" onClick={() => run(() => downloadFlowmapPng(flowmap))}>
            <FileImage size={15} /> <span>{t('export.png')}</span>
          </button>
          <button role="menuitem" className="menu-item" onClick={() => run(() => downloadFlowmapSvg(flowmap))}>
            <FileCode2 size={15} /> <span>{t('export.svg')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
