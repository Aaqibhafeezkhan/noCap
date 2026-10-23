import { useEffect, useRef, type MutableRefObject } from 'react';
import { barIndexMap, rowHeight, rowTop } from '../../flow/layout';
import type { FlowRenderer } from '../../flow/pixi/renderer';
import type { RenderState } from '../../flow/pixi/types';

const USER_SCROLL_GRACE_MS = 2500;

/** Drives the playhead from Pixi's ticker (no React renders per frame) and keeps the
 *  playing bar centred while audio runs, unless the user scrolled a moment ago.
 *  Also serves one-off "scroll to bar" requests from the inspector or report. */
export function useFollowPlayhead({ ready, rendererRef, scrollRef, stateRef, audioTimeRef, scrollRequest }: {
  ready: boolean;
  rendererRef: MutableRefObject<FlowRenderer | null>;
  scrollRef: MutableRefObject<HTMLDivElement | null>;
  stateRef: MutableRefObject<RenderState | null>;
  audioTimeRef: MutableRefObject<number>;
  scrollRequest: { bar: number; id: number } | null;
}) {
  const userScrollAt = useRef(0);
  const targetRef = useRef<number | null>(null);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const mark = () => {
      userScrollAt.current = performance.now();
      targetRef.current = null;
    };
    scroller.addEventListener('wheel', mark, { passive: true });
    scroller.addEventListener('pointerdown', mark);
    scroller.addEventListener('keydown', mark);
    return () => {
      scroller.removeEventListener('wheel', mark);
      scroller.removeEventListener('pointerdown', mark);
      scroller.removeEventListener('keydown', mark);
    };
  }, [scrollRef]);

  useEffect(() => {
    const state = stateRef.current;
    const scroller = scrollRef.current;
    if (!ready || !scrollRequest || !state || !scroller) return;
    const row = barIndexMap(state.flowmap.bars).get(scrollRequest.bar);
    if (row === undefined) return;
    targetRef.current = centeredTop(state, row, scroller);
    userScrollAt.current = 0;
  }, [ready, scrollRequest, scrollRef, stateRef]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!ready || !renderer) return;
    let lastTime = -1;
    renderer.addTicker(() => {
      const state = stateRef.current;
      const scroller = scrollRef.current;
      if (!state || !scroller) return;
      const time = audioTimeRef.current;
      const playing = time !== lastTime && lastTime >= 0;
      lastTime = time;
      const row = rendererRef.current?.drawPlayhead(time) ?? null;
      const idle = performance.now() - userScrollAt.current > USER_SCROLL_GRACE_MS;
      if (playing && row !== null && idle) targetRef.current = centeredTop(state, row, scroller);
      glide(scroller, targetRef);
    });
  }, [ready, rendererRef, scrollRef, stateRef, audioTimeRef]);
}

function centeredTop(state: RenderState, row: number, scroller: HTMLDivElement): number {
  const top = rowTop(state.layout, row) - scroller.clientHeight / 2 + rowHeight(state.layout, row) / 2;
  return Math.max(0, Math.min(top, scroller.scrollHeight - scroller.clientHeight));
}

function glide(scroller: HTMLDivElement, targetRef: MutableRefObject<number | null>) {
  const target = targetRef.current;
  if (target === null) return;
  const delta = target - scroller.scrollTop;
  if (Math.abs(delta) < 1) {
    targetRef.current = null;
    return;
  }
  scroller.scrollTop += Math.abs(delta) > 2000 ? delta : delta * 0.2;
}
