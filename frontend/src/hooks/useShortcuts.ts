import { useEffect, useRef } from 'react';

export interface ShortcutHandlers {
  togglePlay?: () => void;
  playSelection?: () => void;
  toggleLoop?: () => void;
  toggleSource?: () => void;
  stepBar?: (direction: 1 | -1) => void;
  scroll?: (direction: 1 | -1) => void;
  clear?: () => void;
  zoom?: (direction: -1 | 0 | 1) => void;
  toggleInspector?: () => void;
  screen?: (index: 1 | 2 | 3 | 4) => void;
  help?: () => void;
}

const TYPING = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** App-wide keyboard shortcuts. Ignored while typing or while a modal is open
 *  (modals handle their own keys). Menu zoom from Electron arrives through the preload bridge. */
export function useShortcuts(handlers: ShortcutHandlers) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (TYPING.has(target.tagName) || target.isContentEditable)) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const h = ref.current;
      const mod = event.metaKey || event.ctrlKey;
      if (mod) {
        if (event.key === '=' || event.key === '+') return run(event, () => h.zoom?.(1));
        if (event.key === '-') return run(event, () => h.zoom?.(-1));
        if (event.key === '0') return run(event, () => h.zoom?.(0));
        return;
      }
      if (event.altKey) return;
      const onButton = target?.tagName === 'BUTTON' || target?.getAttribute('role') === 'slider';
      switch (event.key) {
        case ' ':
          if (!onButton && h.togglePlay) run(event, h.togglePlay);
          return;
        case 'Enter':
          if (!onButton && h.playSelection) run(event, h.playSelection);
          return;
        case 'ArrowRight':
        case 'ArrowLeft':
          if (!onButton && h.stepBar) run(event, () => h.stepBar?.(event.key === 'ArrowRight' ? 1 : -1));
          return;
        case 'ArrowDown':
        case 'ArrowUp':
          if (h.scroll) run(event, () => h.scroll?.(event.key === 'ArrowDown' ? 1 : -1));
          return;
        case 'Escape':
          if (h.clear) run(event, h.clear);
          return;
        case '?':
          if (h.help) run(event, h.help);
          return;
        case '1':
        case '2':
        case '3':
        case '4':
          if (h.screen) run(event, () => h.screen?.(Number(event.key) as 1 | 2 | 3 | 4));
          return;
      }
      const key = event.key.toLowerCase();
      if (key === 'l' && h.toggleLoop) run(event, h.toggleLoop);
      else if (key === 'v' && h.toggleSource) run(event, h.toggleSource);
      else if (key === 'i' && h.toggleInspector) run(event, h.toggleInspector);
    };
    window.addEventListener('keydown', onKey);
    const offMenu = window.nocapDesktop?.onCanvasZoom((direction) => ref.current.zoom?.(direction));
    return () => {
      window.removeEventListener('keydown', onKey);
      offMenu?.();
    };
  }, []);
}

function run(event: KeyboardEvent, action: () => void) {
  event.preventDefault();
  action();
}
