import { Check, ChevronDown, Layers } from 'lucide-react';
import type { LayerState } from '../../flow/pixi/types';
import type { MarkerKind } from '../../flow/markers';
import { usePopover } from '../../hooks/usePopover';
import { t } from '../../i18n';

const LAYERS: Array<keyof LayerState> = ['density', 'markers', 'energy', 'onsets'];
const MARKERS: MarkerKind[] = ['switch', 'cut', 'drift', 'pocket'];

export function LayersMenu({ layers, onChange }: { layers: LayerState; onChange: (layers: LayerState) => void }) {
  const popover = usePopover();
  return (
    <div className="menu" ref={popover.rootRef}>
      <button
        ref={popover.triggerRef}
        className={`btn btn-ghost btn-sm ${popover.open ? 'is-open' : ''}`}
        onClick={popover.toggle}
        aria-haspopup="true"
        aria-expanded={popover.open}
        title={t('layers.action')}
      >
        <Layers size={14} /> <span className="btn-label">{t('layers.action')}</span> <ChevronDown size={13} className="menu-chevron" />
      </button>
      {popover.open && (
        <div className="menu-popover layers-popover" role="group" aria-label={t('layers.title')}>
          <p className="menu-heading">{t('layers.title')}</p>
          {LAYERS.map((key) => (
            <label key={key} className="menu-check">
              <input type="checkbox" checked={layers[key]} onChange={(event) => onChange({ ...layers, [key]: event.currentTarget.checked })} />
              <span className="menu-check-box" aria-hidden="true">{layers[key] && <Check size={11} strokeWidth={3} />}</span>
              <span className="menu-check-text">
                <b>{t(`layers.${key}.title`)}</b>
                <small>{t(`layers.${key}.body`)}</small>
              </span>
            </label>
          ))}
          <p className="menu-heading">{t('layers.legend')}</p>
          <ul className="marker-legend">
            {MARKERS.map((kind) => (
              <li key={kind}>
                <span className={`marker-icon marker-${kind}`} aria-hidden="true" />
                <span><b>{t(`marker.${kind}.title`)}</b><small>{t(`marker.${kind}.body`)}</small></span>
              </li>
            ))}
            <li>
              <span className="marker-icon marker-notch" aria-hidden="true" />
              <span><b>{t('layers.notch.title')}</b><small>{t('layers.notch.body')}</small></span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
