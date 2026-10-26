import { app, BrowserWindow, Menu } from 'electron'

const isDev = !app.isPackaged

// ---------------------------------------------------------------------------
// macOS menu (minimal native menu so keyboard shortcuts work)
// ---------------------------------------------------------------------------

export function buildMenu(getWindow: () => BrowserWindow | null): void {
  const sendCanvasZoom = (direction: -1 | 0 | 1): void => {
    getWindow()?.webContents.send('nocap:canvas-zoom', direction)
  }

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        // Zoom drives the flow canvas, not the page (handled in the renderer).
        { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', click: () => sendCanvasZoom(0) },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', click: () => sendCanvasZoom(1) },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', visible: false, acceleratorWorksWhenHidden: true, click: () => sendCanvasZoom(1) },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: () => sendCanvasZoom(-1) },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(isDev ? [{ role: 'toggleDevTools' as const }] : []),
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'front' }],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
