// Bridge exposed by electron/preload.ts. Absent when the UI runs in a plain browser.
interface Window {
  nocapDesktop?: {
    onCanvasZoom: (callback: (direction: -1 | 0 | 1) => void) => () => void;
  };
}
