import { BarChart3, Library, PanelRight, Route, ScrollText } from 'lucide-react';
import type { ReactNode } from 'react';
import { t } from '../../i18n';
import type { FlowMap } from '../../types';
import { formatTime } from '../player/format';
import logoUrl from '../../../../source/logo-transparent.png';

export type AppMode = 'library' | 'viewer' | 'report' | 'lyrics';

export function TopBar({ mode, flowmap, isDemo, onModeChange, actions, inspectorOpen, onInspectorToggle }: {
  mode: AppMode;
  flowmap: FlowMap | null;
  isDemo: boolean;
  onModeChange: (mode: AppMode) => void;
  actions?: ReactNode;
  inspectorOpen?: boolean;
  onInspectorToggle?: () => void;
}) {
  const showTrack = flowmap && mode !== 'library';
  return (
    <header className="top-bar">
      <div className="top-left">
        {showTrack && (
          <div className="track-info">
            <span className="track-title" title={flowmap.metadata.title}>
              {flowmap.metadata.title}
              {isDemo && <span className="badge badge-accent">{t('demo.badge')}</span>}
            </span>
            <span className="track-meta">
              {t('header.meta', {
                bpm: flowmap.metadata.bpm.toFixed(0),
                bars: flowmap.bars.length,
                duration: formatTime(flowmap.metadata.duration),
              })}
            </span>
          </div>
        )}
      </div>

      <button className="brand" onClick={() => onModeChange('library')} aria-label={t('app.brandHome')}>
        <img src={logoUrl} alt="noCap" />
      </button>

      <div className="top-right">
        {mode === 'viewer' && actions}
        {mode === 'report' && actions}
        {flowmap && (
          <nav className="segmented" aria-label={t('app.navAria')}>
            <button className={mode === 'viewer' ? 'is-active' : ''} aria-current={mode === 'viewer' ? 'page' : undefined} onClick={() => onModeChange('viewer')} title={`${t('app.nav.flow')} (1)`}>
              <Route size={14} /> <span className="btn-label">{t('app.nav.flow')}</span>
            </button>
            <button className={mode === 'report' ? 'is-active' : ''} aria-current={mode === 'report' ? 'page' : undefined} onClick={() => onModeChange('report')} title={`${t('app.nav.report')} (2)`}>
              <BarChart3 size={14} /> <span className="btn-label">{t('app.nav.report')}</span>
            </button>
            <button className={mode === 'lyrics' ? 'is-active' : ''} aria-current={mode === 'lyrics' ? 'page' : undefined} onClick={() => onModeChange('lyrics')} title={`${t('app.nav.lyrics')} (3)`}>
              <ScrollText size={14} /> <span className="btn-label">{t('app.nav.lyrics')}</span>
            </button>
            <button className={mode === 'library' ? 'is-active' : ''} aria-current={mode === 'library' ? 'page' : undefined} onClick={() => onModeChange('library')} title={`${t('app.nav.library')} (4)`}>
              <Library size={14} /> <span className="btn-label">{t('app.nav.library')}</span>
            </button>
          </nav>
        )}
        {mode === 'viewer' && onInspectorToggle && (
          <button
            className={`icon-btn ${inspectorOpen ? 'is-on' : ''}`}
            onClick={onInspectorToggle}
            aria-pressed={inspectorOpen}
            aria-label={t('inspector.toggle')}
            title={`${t('inspector.toggle')} (I)`}
          >
            <PanelRight size={16} />
          </button>
        )}
      </div>
    </header>
  );
}
