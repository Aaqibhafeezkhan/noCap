import { app, BrowserWindow, shell } from 'electron'
import { existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { BACKEND_PORT, waitForPort, spawnBackend, stopBackend } from './backend'
import { buildMenu } from './menu'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    // Inset title bar is macOS-only; elsewhere it would hide the window controls.
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 20, y: 22 } }
      : { autoHideMenuBar: true }),
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      sandbox: false,
    },
    show: false,
  })

  // Open external links in the default browser, not in Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  try {
    if (process.env.VITE_DEV_SERVER_URL) {
      // Dev: Vite dev server handles HMR, /api proxied to Flask
      await waitForPort(BACKEND_PORT)
      await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    } else {
      // Production: Flask serves the built React app + API
      await waitForPort(BACKEND_PORT)
      await mainWindow.loadURL(`http://localhost:${BACKEND_PORT}`)
    }
  } catch (err) {
    console.error('[main] Backend failed to start:', err)
    app.quit()
  }
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

// In development Electron shows its own default icon in the Dock; use noCap's instead.
// Packaged builds get the icon from the .icns bundled by electron-builder.
function setDevDockIcon(): void {
  if (!isDev || process.platform !== 'darwin') return
  const icon = path.join(app.getAppPath(), '..', 'source', 'app-icon.png')
  if (existsSync(icon)) app.dock?.setIcon(icon)
}

app.whenReady().then(async () => {
  setDevDockIcon()
  buildMenu(() => mainWindow)
  spawnBackend()
  await createWindow()

  // macOS: re-create window when clicking dock icon with no windows open
  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow()
    else mainWindow?.show()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  stopBackend()
})
