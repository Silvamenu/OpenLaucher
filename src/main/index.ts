import { app, BrowserWindow, Menu, net, protocol, session, shell } from 'electron'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { AppUpdater } from './appUpdater'
import { AppContext } from './context'
import { DevlogTracker } from './devlogState'
import { GameUpdateService } from './gameUpdates'
import { registerIpc } from './ipc'
import { GameLauncher } from './launcher'
import { migrateLegacyUserData } from './legacyData'
import { LibraryService } from './library'

const COVER_SCHEME = 'rl-cover'

protocol.registerSchemesAsPrivileged([{ scheme: COVER_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } }])

if (process.platform === 'win32') app.setAppUserModelId('io.github.silvamenu.relaunch')

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  // Antes de qualquer leitura da pasta de dados: quem usava o nome antigo (RecompHub) mantém a biblioteca.
  try {
    const { moved, failed } = migrateLegacyUserData(app.getPath('appData'), app.getPath('userData'))
    if (moved.length > 0) console.info('[dados] itens migrados da pasta do RecompHub:', moved.join(', '))
    for (const { name, error } of failed) console.warn(`[dados] não foi possível migrar ${name}; nova tentativa na próxima abertura`, error)
  } catch (err) {
    console.warn('[dados] migração da pasta antiga falhou', err)
  }
  void bootstrap()
}

function createWindow(ctx: AppContext): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 860,
    minHeight: 560,
    show: false,
    title: 'Relaunch',
    backgroundColor: '#0b0f17',
    autoHideMenuBar: true,
    icon: app.isPackaged ? path.join(process.resourcesPath, 'icon.png') : path.join(app.getAppPath(), 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  })
  win.once('ready-to-show', () => win.show())

  // Links externos abrem no navegador (só HTTPS); a janela nunca navega para fora do app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env.ELECTRON_RENDERER_URL
    if (devUrl && url.startsWith(devUrl)) return
    event.preventDefault()
    if (/^https:\/\//i.test(url)) void shell.openExternal(url)
  })

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
  win.on('closed', () => {
    if (ctx.window === win) ctx.window = null
  })
  return win
}

async function bootstrap(): Promise<void> {
  await app.whenReady()
  Menu.setApplicationMenu(null)
  // file:// com host vira caminho UNC no Windows (\\servidor\...) e vazaria o hash NTLM do usuário.
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['file://*/*'] }, (details, callback) => {
    let host: string
    try {
      host = new URL(details.url).host
    } catch {
      host = 'invalid'
    }
    callback({ cancel: host !== '' })
  })

  const ctx = new AppContext()
  await ctx.reloadManifests()
  if (ctx.manifestsReport.errors.length > 0) console.warn('[manifests]', ctx.manifestsReport.errors)

  const library = new LibraryService(ctx)
  const launcher = new GameLauncher(ctx.platform, {
    onStart: (id) => library.onGameStarted(id),
    onExit: (id, seconds) => library.onGameExited(id, seconds)
  })
  library.attachLauncher(launcher)
  const updates = new GameUpdateService(ctx, library)
  const appUpdater = new AppUpdater(ctx)
  const devlog = new DevlogTracker(
    app.getVersion(),
    {
      getLastSeen: () => ctx.store.getLastSeenVersion(),
      setLastSeen: (v) => ctx.store.setLastSeenVersion(v),
      getStoredNotes: (v) => ctx.store.getReleaseNotes(v)
    },
    () => {
      try {
        return readFileSync(ctx.paths.changelog, 'utf8')
      } catch {
        return null
      }
    }
  )

  protocol.handle(COVER_SCHEME, async (request) => {
    const id = decodeURIComponent(new URL(request.url).pathname.replace(/^\/+/, ''))
    const file = /^[\w-]+$/.test(id) ? await library.coverFile(id) : null
    if (!file) return new Response('not found', { status: 404 })
    return net.fetch(pathToFileURL(file).toString())
  })

  registerIpc({ ctx, library, updates, appUpdater, devlog })

  ctx.window = createWindow(ctx)
  ctx.window.webContents.once('did-finish-load', () => {
    updates.startScheduler()
    appUpdater.start()
  })

  app.on('second-instance', () => {
    const win = ctx.window
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.focus()
  })
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) ctx.window = createWindow(ctx)
  })
  app.on('before-quit', () => {
    updates.stopScheduler()
    appUpdater.stop()
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
