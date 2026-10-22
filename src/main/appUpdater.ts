import { app } from 'electron'
import { autoUpdater, type UpdateInfo } from 'electron-updater'
import type { AppUpdateState } from '../shared/types'
import type { AppContext } from './context'
import { CHECK_INTERVAL_MS } from './gameUpdates'

/** O provedor GitHub do electron-updater entrega as notas em HTML; convertemos o básico para markdown. */
export function htmlToMarkdown(html: string): string {
  return html
    .replace(/<h[1-6][^>]*>/gi, '\n### ')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|ul|ol|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function notesOf(info: UpdateInfo): string {
  const notes = info.releaseNotes
  if (!notes) return ''
  const text = typeof notes === 'string' ? notes : notes.map((n) => n.note ?? '').join('\n\n')
  return /<\/?[a-z][^>]*>/i.test(text) ? htmlToMarkdown(text) : text
}

/**
 * Atualização do próprio launcher via electron-updater + GitHub Releases do repositório do launcher.
 * Baixa em segundo plano; instala ao clicar no botão da sidebar ou ao fechar o app.
 */
export class AppUpdater {
  private state: AppUpdateState = { status: 'idle' }
  private timer: NodeJS.Timeout | null = null
  private readonly fake = !app.isPackaged && process.env.RELAUNCH_FAKE_UPDATE === '1'

  constructor(private readonly ctx: AppContext) {}

  getState(): AppUpdateState {
    return this.state
  }

  private setState(next: AppUpdateState): void {
    this.state = next
    this.ctx.emit('appUpdate:state', next)
  }

  start(): void {
    if (this.fake) {
      setTimeout(() => this.simulate(), 3000)
      return
    }
    if (!app.isPackaged) {
      this.setState({ status: 'disabled' })
      return
    }
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.logger = { info: console.log, warn: console.warn, error: console.error, debug: () => undefined }

    autoUpdater.on('checking-for-update', () => {
      if (this.state.status !== 'downloading' && this.state.status !== 'downloaded') this.setState({ status: 'checking' })
    })
    autoUpdater.on('update-not-available', () => this.setState({ status: 'not-available' }))
    autoUpdater.on('update-available', (info) => this.setState({ status: 'available', version: info.version, percent: 0 }))
    autoUpdater.on('download-progress', (p) => this.setState({ status: 'downloading', version: this.state.version, percent: Math.round(p.percent) }))
    autoUpdater.on('update-downloaded', (info) => {
      // Guarda as notas para o devlog caso o CHANGELOG embutido não tenha a versão.
      this.ctx.store.setReleaseNotes(info.version, notesOf(info), info.releaseDate ? info.releaseDate.slice(0, 10) : null)
      this.setState({ status: 'downloaded', version: info.version, percent: 100 })
    })
    autoUpdater.on('error', (err) => {
      // Mantém o botão se o download já terminou; senão some.
      if (this.state.status !== 'downloaded') this.setState({ status: 'error', error: err?.message ?? String(err) })
    })

    void this.check()
    this.timer = setInterval(() => void this.check(), CHECK_INTERVAL_MS)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
  }

  async check(): Promise<AppUpdateState> {
    if (this.fake || !app.isPackaged) return this.state
    if (this.state.status === 'downloading' || this.state.status === 'downloaded') return this.state
    try {
      await autoUpdater.checkForUpdates()
    } catch (err) {
      this.setState({ status: 'error', error: (err as Error).message })
    }
    return this.state
  }

  install(): void {
    if (this.state.status !== 'downloaded') return
    if (this.fake) {
      console.log('[app-update] simulação: reiniciaria e instalaria agora')
      this.setState({ status: 'idle' })
      return
    }
    // isSilent=false (mostra o instalador NSIS), isForceRunAfter=true (reabre o app)
    setImmediate(() => autoUpdater.quitAndInstall(false, true))
  }

  /** RELAUNCH_FAKE_UPDATE=1 em desenvolvimento: simula o ciclo para testar a interface. */
  private simulate(): void {
    const version = '9.9.9'
    this.setState({ status: 'available', version, percent: 0 })
    let percent = 0
    const tick = setInterval(() => {
      percent += 7
      if (percent >= 100) {
        clearInterval(tick)
        this.setState({ status: 'downloaded', version, percent: 100 })
      } else {
        this.setState({ status: 'downloading', version, percent })
      }
    }, 600)
  }
}
