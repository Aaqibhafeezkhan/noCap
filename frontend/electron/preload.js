// Preload runs in a privileged context between the main process and the renderer.
// It exposes the few native hooks the UI needs through a narrow, typed bridge.
import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('nocapDesktop', {
    /** Menu zoom commands (⌘+ / ⌘− / ⌘0) for the flow canvas. Returns an unsubscribe. */
    onCanvasZoom: function (callback) {
        var listener = function (_event, direction) { return callback(direction); };
        ipcRenderer.on('nocap:canvas-zoom', listener);
        return function () { return ipcRenderer.removeListener('nocap:canvas-zoom', listener); };
    },
});
