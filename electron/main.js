const { app, BrowserWindow, shell, dialog } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const net = require('net')
const fs = require('fs')

const isDev = !app.isPackaged
let mainWindow = null
let serverProcess = null
let serverPort = null

// -----------------------------------------------------------------------
// Logging — write to a file so we can debug packaged builds
// -----------------------------------------------------------------------

const logFile = path.join(app.getPath('userData'), 'yt-toolkit.log')

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  console.log(msg)
  try {
    fs.appendFileSync(logFile, line)
  } catch {
    // ignore
  }
}

// -----------------------------------------------------------------------
// Port selection
// -----------------------------------------------------------------------

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}

// -----------------------------------------------------------------------
// Next.js server
// -----------------------------------------------------------------------

function startServer(port) {
  const env = { ...process.env, PORT: String(port), HOSTNAME: 'localhost' }

  if (isDev) {
    serverProcess = spawn('npx', ['next', 'dev', '-p', String(port)], {
      cwd: path.join(__dirname, '..'),
      env,
      shell: true,
      stdio: 'pipe',
    })
  } else {
    const standalonePath = path.join(process.resourcesPath, 'standalone')
    const serverJs = path.join(standalonePath, 'server.js')

    env.RESOURCES_PATH = process.resourcesPath
    env.NODE_ENV = 'production'
    // node_modules was renamed to _modules to survive electron-builder packaging
    env.NODE_PATH = path.join(standalonePath, '_modules')

    log(`Standalone path: ${standalonePath}`)
    log(`server.js exists: ${fs.existsSync(serverJs)}`)
    log(`_modules exists: ${fs.existsSync(path.join(standalonePath, '_modules'))}`)
    log(`Electron exe: ${process.execPath}`)

    // Use spawn instead of fork — fork doesn't work reliably in
    // packaged Electron on Windows because process.execPath is the
    // Electron binary and it may not handle Node-only scripts properly.
    serverProcess = spawn(process.execPath, [serverJs], {
      cwd: standalonePath,
      env: {
        ...env,
        ELECTRON_RUN_AS_NODE: '1',
      },
      stdio: 'pipe',
    })
  }

  serverProcess.stdout?.on('data', (d) => log(`[next] ${d.toString().trim()}`))
  serverProcess.stderr?.on('data', (d) => log(`[next:err] ${d.toString().trim()}`))

  serverProcess.on('error', (err) => {
    log(`[next] spawn error: ${err.message}`)
  })

  serverProcess.on('exit', (code, signal) => {
    log(`[next] exited with code=${code} signal=${signal}`)
  })
}

async function waitForServer(port) {
  const timeout = 30_000
  const start = Date.now()

  // Check if the process died immediately
  await new Promise((r) => setTimeout(r, 500))
  if (serverProcess && serverProcess.exitCode !== null) {
    throw new Error(
      `Server process exited immediately with code ${serverProcess.exitCode}. Check log: ${logFile}`,
    )
  }

  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(`http://localhost:${port}`)
      if (res.status < 500) return
    } catch {
      // not ready yet
    }

    // Check if process died while waiting
    if (serverProcess && serverProcess.exitCode !== null) {
      throw new Error(
        `Server crashed during startup (code ${serverProcess.exitCode}). Check log: ${logFile}`,
      )
    }

    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`Server did not start within ${timeout / 1000}s. Check log: ${logFile}`)
}

// -----------------------------------------------------------------------
// Window
// -----------------------------------------------------------------------

function showLoadingWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 200,
    frame: false,
    resizable: false,
    title: 'YT Toolkit',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  mainWindow.loadURL(
    `data:text/html,
    <html>
      <body style="margin:0;display:flex;align-items:center;justify-content:center;
        height:100vh;font-family:system-ui;background:#111;color:#fff;flex-direction:column">
        <h2 style="margin:0 0 8px">YT Toolkit</h2>
        <p style="margin:0;color:#888">Starting server…</p>
      </body>
    </html>`.replace(/\n\s*/g, ''),
  )
}

function showAppWindow() {
  if (mainWindow) mainWindow.close()

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'YT Toolkit',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  mainWindow.loadURL(`http://localhost:${serverPort}`)

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// -----------------------------------------------------------------------
// App lifecycle
// -----------------------------------------------------------------------

function killServer() {
  if (serverProcess) {
    serverProcess.kill()
    serverProcess = null
  }
}

app.whenReady().then(async () => {
  // Clear old log
  try {
    fs.writeFileSync(logFile, '')
  } catch {
    // ignore
  }

  log(`App starting (packaged=${app.isPackaged})`)
  log(`Platform: ${process.platform} ${process.arch}`)
  log(`Resources: ${process.resourcesPath || 'N/A'}`)

  showLoadingWindow()

  try {
    serverPort = await findFreePort()
    log(`Starting Next.js on port ${serverPort}`)
    startServer(serverPort)
    await waitForServer(serverPort)
    log('Server ready')
    showAppWindow()
  } catch (err) {
    log(`FATAL: ${err.message}`)
    dialog.showErrorBox(
      'YT Toolkit — Failed to start',
      `${err.message}\n\nLog file: ${logFile}`,
    )
    app.quit()
  }
})

app.on('window-all-closed', () => {
  killServer()
  app.quit()
})

app.on('activate', () => {
  if (mainWindow === null && serverPort) showAppWindow()
})

app.on('before-quit', killServer)
