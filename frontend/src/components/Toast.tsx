import { useEffect } from 'react';
import { X } from 'lucide-react';
import { t } from '../i18n';

export interface ToastState {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

export function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 8000);
    return () => window.clearTimeout(timer);
  }, [toast.id, onClose]);

  return (
    <div className="toast" role="status">
      <span>{toast.message}</span>
      {toast.action && (
        <button className="btn btn-primary btn-sm" onClick={() => { toast.action?.run(); onClose(); }}>
          {toast.action.label}
        </button>
      )}
      <button className="icon-btn icon-btn-sm" onClick={onClose} aria-label={t('toast.close')}><X size={14} /></button>
    </div>
  );
}
