// Preload runs in a privileged context between the main process and the renderer.
// It exposes the few native hooks the UI needs through a narrow, typed bridge.
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('nocapDesktop', {
  /** Menu zoom commands (⌘+ / ⌘− / ⌘0) for the flow canvas. Returns an unsubscribe. */
  onCanvasZoom(callback: (direction: -1 | 0 | 1) => void) {
    const listener = (_event: unknown, direction: -1 | 0 | 1) => callback(direction)
    ipcRenderer.on('nocap:canvas-zoom', listener)
    return () => ipcRenderer.removeListener('nocap:canvas-zoom', listener)
  },
})
