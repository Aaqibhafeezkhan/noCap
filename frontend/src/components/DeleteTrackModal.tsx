import { Trash2 } from 'lucide-react';
import { useDialog } from '../hooks/useDialog';
import { t } from '../i18n';
import type { LibraryTrack } from '../types';

export function DeleteTrackModal({ track, onCancel, onConfirm }: {
  track: LibraryTrack;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ref = useDialog(onCancel);
  return (
    <div className="modal-backdrop" role="presentation" onPointerDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section ref={ref} className="modal modal-sm" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-body">
        <div className="modal-icon modal-icon-danger" aria-hidden="true"><Trash2 size={18} /></div>
        <h2 id="delete-title">{t('delete.title')}</h2>
        <p id="delete-body">{t('delete.body', { title: track.title })}</p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel} data-autofocus>{t('delete.cancel')}</button>
          <button className="btn btn-danger" onClick={onConfirm}><Trash2 size={14} /> {t('delete.confirm')}</button>
        </div>
      </section>
    </div>
  );
}
