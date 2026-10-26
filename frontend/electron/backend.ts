import { app } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'
import net from 'net'

export const BACKEND_PORT = 5757
const isDev = !app.isPackaged
const isWindows = process.platform === 'win32'

let backendProcess: ChildProcess | null = null

// ---------------------------------------------------------------------------
// Backend lifecycle
// ---------------------------------------------------------------------------

export function waitForPort(port: number, timeout = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout
    const tryConnect = () => {
      const sock = net.createConnection(port, '127.0.0.1')
      sock.once('connect', () => { sock.destroy(); resolve() })
      sock.once('error', () => {
        sock.destroy()
        if (Date.now() >= deadline) reject(new Error(`Backend not ready after ${timeout}ms`))
        else setTimeout(tryConnect, 300)
      })
    }
    tryConnect()
  })
}

export function spawnBackend(): void {
  // In dev: project root is one level above frontend/
  // In prod: bundled nocap-server binary lives in Resources/backend/
  if (isDev) {
    const projectRoot = path.join(app.getAppPath(), '..')
    const venvPython = isWindows
      ? path.join(projectRoot, '.venv', 'Scripts', 'python.exe')
      : path.join(projectRoot, '.venv', 'bin', 'python3')
    const pythonExe = existsSync(venvPython) ? venvPython : (isWindows ? 'python' : 'python3')
    backendProcess = spawn(
      pythonExe,
      ['-m', 'nocap.web.desktop', '--port', String(BACKEND_PORT)],
      { cwd: projectRoot, env: { ...process.env, PYTHONUNBUFFERED: '1' } }
    )
  } else {
    // nocap-server is a PyInstaller onedir bundle: Resources/backend/nocap-server/nocap-server
    const serverBin = path.join(
      process.resourcesPath, 'backend', 'nocap-server', isWindows ? 'nocap-server.exe' : 'nocap-server',
    )
    backendProcess = spawn(serverBin, ['--port', String(BACKEND_PORT)], {
      windowsHide: true,
      env: {
        ...process.env,
        // Tell the Python backend where bundled assets (Whisper model) live
        NOCAP_RESOURCES: process.resourcesPath,
      },
    })
  }

  backendProcess.stdout?.on('data', (d: Buffer) => process.stdout.write(`[backend] ${d}`))
  backendProcess.stderr?.on('data', (d: Buffer) => process.stderr.write(`[backend] ${d}`))
  backendProcess.on('exit', code => console.log(`[backend] exited ${code}`))
}

export function stopBackend(): void {
  backendProcess?.kill()
  backendProcess = null
}
