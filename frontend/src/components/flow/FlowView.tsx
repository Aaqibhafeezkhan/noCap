import type { MutableRefObject } from 'react';
import type { RhymeStyles } from '../../flow/colors';
import type { BarMarker } from '../../flow/markers';
import type { ViewerState } from '../../hooks/useViewerState';
import { t } from '../../i18n';
import type { FlowMap } from '../../types';
import { Inspector } from '../inspector/Inspector';
import { FlowStage } from './FlowStage';
import { MetricStrip } from './MetricStrip';

export function FlowView({ flowmap, styles, markers, viewer, audioTimeRef, isDemo }: {
  flowmap: FlowMap;
  styles: RhymeStyles;
  markers: Map<number, BarMarker[]>;
  viewer: ViewerState;
  audioTimeRef: MutableRefObject<number>;
  isDemo: boolean;
}) {
  return (
    <main className="flow-view">
      <section className="flow-main" aria-label={t('flow.aria')}>
        <MetricStrip flowmap={flowmap} zoom={viewer.zoom} onZoom={viewer.setZoom} onZoomStep={viewer.zoomStep} isDemo={isDemo} />
        {flowmap.syllables.length === 0 ? (
          <div className="flow-empty">
            <b>{t('flow.emptyTitle')}</b>
            <p>{t('flow.emptyBody')}</p>
          </div>
        ) : (
          <FlowStage
            flowmap={flowmap}
            styles={styles}
            markers={markers}
            zoom={viewer.zoom}
            layers={viewer.layers}
            activeRhyme={viewer.activeRhyme}
            selection={viewer.selection}
            loop={viewer.loop}
            audioTimeRef={audioTimeRef}
            scrollRequest={viewer.scrollRequest}
            onSelectBar={viewer.selectBar}
            onPlayBar={(barNo) => viewer.playBar(flowmap, barNo)}
            onPlayWord={(syllable) => viewer.playWord(flowmap, syllable)}
            onZoomStep={viewer.zoomStep}
          />
        )}
      </section>
      {viewer.inspectorOpen && (
        <Inspector
          flowmap={flowmap}
          styles={styles}
          markers={markers}
          tab={viewer.inspectorTab}
          onTabChange={viewer.setInspectorTab}
          selection={viewer.selection}
          activeRhyme={viewer.activeRhyme}
          onActiveRhymeChange={viewer.setActiveRhyme}
          onFocusBar={viewer.focusBar}
          onPlayBar={(barNo) => viewer.playBar(flowmap, barNo)}
        />
      )}
    </main>
  );
}
