import { useRef } from 'react';
import type { RhymeStyles } from '../../flow/colors';
import type { BarMarker } from '../../flow/markers';
import type { BarRange } from '../../flow/pixi/types';
import { usePersistentState } from '../../hooks/usePersistentState';
import type { InspectorTab } from '../../hooks/useViewerState';
import { t } from '../../i18n';
import type { FlowMap } from '../../types';
import { BarTab } from './BarTab';
import { RhymesTab } from './RhymesTab';
import { TrackTab } from './TrackTab';

const TABS: InspectorTab[] = ['track', 'bar', 'rhymes'];
const MIN_W = 280;
const MAX_W = 520;

export function Inspector({ flowmap, styles, markers, tab, onTabChange, selection, activeRhyme, onActiveRhymeChange, onFocusBar, onPlayBar }: {
  flowmap: FlowMap;
  styles: RhymeStyles;
  markers: Map<number, BarMarker[]>;
  tab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  selection: BarRange | null;
  activeRhyme: string | null;
  onActiveRhymeChange: (group: string | null) => void;
  onFocusBar: (barNo: number) => void;
  onPlayBar: (barNo: number) => void;
}) {
  const [width, setWidth] = usePersistentState('nocap.inspectorWidth', 320);
  const dragRef = useRef<{ x: number; width: number } | null>(null);

  return (
    <aside className="inspector" style={{ width }} aria-label={t('inspector.aria')}>
      <div
        className="inspector-resize"
        role="separator"
        aria-orientation="vertical"
        aria-label={t('inspector.resize')}
        tabIndex={0}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = { x: event.clientX, width };
        }}
        onPointerMove={(event) => {
          if (!dragRef.current) return;
          setWidth(clamp(dragRef.current.width + dragRef.current.x - event.clientX));
        }}
        onPointerUp={() => { dragRef.current = null; }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') setWidth((value) => clamp(value + 16));
          if (event.key === 'ArrowRight') setWidth((value) => clamp(value - 16));
        }}
      />
      <div className="inspector-tabs" role="tablist" aria-label={t('inspector.aria')}>
        {TABS.map((item) => (
          <button
            key={item}
            role="tab"
            id={`inspector-tab-${item}`}
            aria-selected={tab === item}
            aria-controls={`inspector-panel-${item}`}
            className={tab === item ? 'is-active' : ''}
            onClick={() => onTabChange(item)}
          >
            {t(`inspector.tab.${item}`)}
            {item === 'rhymes' && <span className="tab-count">{styles.size}</span>}
          </button>
        ))}
      </div>
      <div className="inspector-body" role="tabpanel" id={`inspector-panel-${tab}`} aria-labelledby={`inspector-tab-${tab}`}>
        {tab === 'track' && <TrackTab flowmap={flowmap} onFocusBar={onFocusBar} />}
        {tab === 'bar' && (
          <BarTab flowmap={flowmap} styles={styles} markers={markers} selection={selection} onFocusBar={onFocusBar} onPlayBar={onPlayBar} />
        )}
        {tab === 'rhymes' && (
          <RhymesTab flowmap={flowmap} styles={styles} activeRhyme={activeRhyme} onActiveRhymeChange={onActiveRhymeChange} onFocusBar={onFocusBar} />
        )}
      </div>
    </aside>
  );
}

function clamp(value: number) {
  return Math.max(MIN_W, Math.min(MAX_W, Math.round(value)));
}
