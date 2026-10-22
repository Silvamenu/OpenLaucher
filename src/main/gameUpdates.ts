import { Notification, net } from 'electron'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { AppError, toErrorShape } from '../shared/errors'
import { assetPatternsFor, executablesFor, type GithubUpdates, type Manifest } from '../shared/manifest'
import { pickAsset } from '../shared/patterns'
import type { GameEntry, GameUpdateState, LibraryItem, ReleaseInfo, UpdateProgress } from '../shared/types'
import { isNewerRelease } from '../shared/version'
import type { AppContext } from './context'
import { mainText } from './i18n'
import { GitHubClient } from './github'
import type { LibraryService } from './library'
import { isAnyRunning } from './processes'
import { listBackups, rollbackFromBackup, runUpdateFlow, UNKNOWN_VERSION } from './updateCore'

export const CHECK_INTERVAL_MS = 3 * 60 * 60 * 1000
const FIRST_CHECK_DELAY_MS = 5_000

const electronFetch = ((input: string | URL | Request, init?: RequestInit) => net.fetch(input instanceof URL ? input.toString() : input, init)) as typeof fetch

function githubUpdatesOf(manifest: Manifest | null): GithubUpdates | null {
  return manifest?.updates.source === 'github-releases' ? manifest.updates : null
}

/** Verificação periódica e aplicação de atualizações dos jogos a partir dos GitHub Releases. */
export class GameUpdateService {
  private readonly client: GitHubClient
  private readonly controllers = new Map<string, AbortController>()
  private timer: NodeJS.Timeout | null = null
  private checking: Promise<LibraryItem[]> | null = null

  constructor(
    private readonly ctx: AppContext,
    private readonly library: LibraryService
  ) {
    this.client = new GitHubClient({
      fetchImpl: electronFetch,
      cache: ctx.store.httpCache(),
      getToken: () => ctx.store.getGithubToken(),
      onRateLimit: (info) => ctx.store.setRateLimit(info)
    })
  }

  startScheduler(): void {
    setTimeout(() => void this.scheduledCheck(), FIRST_CHECK_DELAY_MS)
    this.timer = setInterval(() => void this.scheduledCheck(), CHECK_INTERVAL_MS)
  }

  stopScheduler(): void {
    if (this.timer) clearInterval(this.timer)
    for (const controller of this.controllers.values()) controller.abort()
  }

  private async scheduledCheck(): Promise<void> {
    if (!this.ctx.store.getSettings().checkGameUpdates) return
    try {
      await this.check()
    } catch (err) {
      console.warn('[updates] verificação falhou', err)
    }
  }

  private acceptRelease(updates: GithubUpdates) {
    const patterns = assetPatternsFor(updates, this.ctx.platform)
    return (release: ReleaseInfo) => pickAsset(release.assets, patterns) !== null
  }

  /** Consulta o release mais recente (uma requisição por repositório) e atualiza o estado de cada jogo. */
  check(entryId?: string): Promise<LibraryItem[]> {
    if (this.checking && !entryId) return this.checking
    const run = this.doCheck(entryId).finally(() => {
      if (!entryId) this.checking = null
    })
    if (!entryId) this.checking = run
    return run
  }

  private async doCheck(entryId?: string): Promise<LibraryItem[]> {
    const entries = this.ctx.store.getEntries().filter((e) => !entryId || e.id === entryId)
    const byRepo = new Map<string, { updates: GithubUpdates; entries: GameEntry[] }>()
    for (const entry of entries) {
      const updates = githubUpdatesOf(this.ctx.getManifest(entry.manifestId))
      if (!updates) continue
      const key = `${updates.repo.toLowerCase()}|${updates.includePrereleases}|${assetPatternsFor(updates, this.ctx.platform).join(',')}`
      const group = byRepo.get(key) ?? { updates, entries: [] }
      group.entries.push(entry)
      byRepo.set(key, group)
    }

    const autoUpdates: string[] = []
    for (const { updates, entries: group } of byRepo.values()) {
      let latest: ReleaseInfo | null = null
      let error: ReturnType<typeof toErrorShape> | undefined
      try {
        latest = await this.client.getLatestRelease(updates.repo, updates.includePrereleases, this.acceptRelease(updates))
        if (!latest) error = { code: 'NO_RELEASE', message: 'Nenhum release com binário para esta plataforma' }
      } catch (err) {
        error = toErrorShape(err)
      }
      for (const entry of group) {
        const previous = this.ctx.store.getUpdateState(entry.id)
        const state: GameUpdateState = { ...previous, checkedAt: new Date().toISOString(), error }
        if (latest) {
          state.latest = latest
          state.assetName = pickAsset(latest.assets, assetPatternsFor(updates, this.ctx.platform))?.name ?? null
          // Sem versão instalada conhecida não há como comparar: nada é oferecido.
          state.available = !!entry.installedVersion && isNewerRelease(latest, { tag: entry.installedVersion, publishedAt: entry.installedPublishedAt })
          if (state.available && previous.notifiedTag !== latest.tag) {
            state.notifiedTag = latest.tag
            if (!entry.autoUpdate) this.notify(entry, this.text().updateAvailable(latest.tag))
          }
          if (state.available && entry.autoUpdate) autoUpdates.push(entry.id)
        }
        this.ctx.store.setUpdateState(entry.id, state)
      }
    }
    const items = await this.library.broadcast()
    for (const id of autoUpdates) {
      void this.start(id, { automatic: true }).catch((err) => console.warn('[updates] atualização automática falhou', err))
    }
    return items
  }

  async releases(entryId: string): Promise<ReleaseInfo[]> {
    const entry = this.ctx.store.getEntry(entryId)
    const updates = githubUpdatesOf(entry ? this.ctx.getManifest(entry.manifestId) : null)
    if (!updates) throw new AppError('UPDATES_DISABLED')
    const list = await this.client.listReleases(updates.repo, 30)
    return list.filter((r) => updates.includePrereleases || !r.prerelease)
  }

  private async isGameRunning(entry: GameEntry, manifest: Manifest): Promise<boolean> {
    if (this.library.isRunning(entry.id)) return true
    const names = executablesFor(manifest, this.ctx.platform).filter((n) => !/[*?[\]{}]/.test(n))
    const report = await this.library.requirements(entry.id)
    if (report.executable) names.push(path.basename(report.executable))
    return isAnyRunning(names)
  }

  private text() {
    return mainText(this.ctx.store.getSettings().language)
  }

  private progress(p: UpdateProgress): void {
    this.ctx.emit('game:progress', p)
  }

  private notify(entry: GameEntry, body: string): void {
    if (!this.ctx.store.getSettings().notifications || !Notification.isSupported()) return
    const manifest = this.ctx.getManifest(entry.manifestId)
    const notification = new Notification({ title: entry.customName || manifest?.name || 'Relaunch', body })
    notification.on('click', () => {
      const win = this.ctx.window
      if (win) {
        if (win.isMinimized()) win.restore()
        win.show()
        win.focus()
      }
      this.ctx.emit('navigate:game', entry.id)
    })
    notification.show()
  }

  async start(entryId: string, opts: { automatic?: boolean } = {}): Promise<void> {
    let entry = this.library.requireEntry(entryId)
    const manifest = this.ctx.getManifest(entry.manifestId)
    const updates = githubUpdatesOf(manifest)
    if (!manifest || !updates) throw new AppError('UPDATES_DISABLED')
    if (this.library.isBusy(entryId)) throw new AppError('BUSY')

    let state = this.ctx.store.getUpdateState(entryId)
    if (!state.latest) {
      await this.check(entryId)
      state = this.ctx.store.getUpdateState(entryId)
    }
    const release = state.latest
    if (!release) throw new AppError('NO_RELEASE')
    // A consulta acima é assíncrona: relê a entrada (a pasta pode ter mudado) e marca como ocupado antes de usar.
    entry = this.library.requireEntry(entryId)
    if (this.library.isBusy(entryId)) throw new AppError('BUSY')

    const controller = new AbortController()
    this.controllers.set(entryId, controller)
    this.library.setBusy(entryId, true)
    await this.library.broadcast()
    const base = { entryId, kind: 'update' as const, version: release.tag }
    try {
      const executables = executablesFor(manifest, this.ctx.platform)
      // Só um nome de arquivo simples (sem pastas nem curingas) serve de nome para um binário solto.
      const rawTargetName = executables.find((n) => !/[*?[\]{}/\\]/.test(n) && n !== '.' && n !== '..')
      const result = await runUpdateFlow(
        {
          entryId,
          manifestId: manifest.id,
          updates,
          gameDir: entry.path,
          installedVersion: entry.installedVersion,
          release,
          platform: this.ctx.platform,
          rawTargetName
        },
        {
          fetchImpl: electronFetch,
          tmpRoot: os.tmpdir(),
          backupsDir: this.library.backupsDirFor(entry),
          isGameRunning: () => this.isGameRunning(entry, manifest),
          signal: controller.signal,
          onStage: (stage, extra) => this.progress({ ...base, stage, ...extra })
        }
      )
      const fresh = this.ctx.store.getEntry(entryId) ?? entry
      this.ctx.store.saveEntry({ ...fresh, installedVersion: result.version, installedPublishedAt: result.publishedAt })
      this.ctx.store.setUpdateState(entryId, { ...this.ctx.store.getUpdateState(entryId), available: false, error: undefined })
      if (opts.automatic) this.notify(entry, this.text().updatedTo(result.version))
    } catch (err) {
      const shape = toErrorShape(err)
      this.progress({ ...base, stage: shape.code === 'CANCELLED' ? 'cancelled' : 'error', error: shape })
      if (opts.automatic && shape.code !== 'CANCELLED' && shape.code !== 'GAME_RUNNING') {
        this.notify(entry, this.text().updateFailed(shape.message))
      }
      throw err
    } finally {
      this.controllers.delete(entryId)
      this.library.setBusy(entryId, false)
      await this.library.broadcast()
    }
  }

  cancel(entryId: string): void {
    this.controllers.get(entryId)?.abort()
  }

  async rollback(entryId: string): Promise<void> {
    const entry = this.library.requireEntry(entryId)
    const manifest = this.ctx.getManifest(entry.manifestId)
    if (!manifest) throw new AppError('NOT_FOUND')
    if (this.library.isBusy(entryId)) throw new AppError('BUSY')
    if (await this.isGameRunning(entry, manifest)) throw new AppError('GAME_RUNNING')
    const backups = await listBackups(this.library.backupsDirFor(entry), entryId)
    const backup = backups[0]
    if (!backup) throw new AppError('NO_BACKUP')

    const preserve = githubUpdatesOf(manifest)?.preserve ?? []
    const base = { entryId, kind: 'rollback' as const, version: backup.meta.version }
    this.library.setBusy(entryId, true)
    await this.library.broadcast()
    try {
      this.progress({ ...base, stage: 'restoring' })
      await rollbackFromBackup(entry.path, backup, preserve)
      const version = backup.meta.version === UNKNOWN_VERSION ? null : backup.meta.version
      this.ctx.store.saveEntry({ ...entry, installedVersion: version, installedPublishedAt: null })
      await fs.rm(backup.dir, { recursive: true, force: true })
      const state = this.ctx.store.getUpdateState(entryId)
      if (state.latest && version) {
        this.ctx.store.setUpdateState(entryId, { ...state, available: isNewerRelease(state.latest, version) })
      }
      this.progress({ ...base, stage: 'done', progress: 1 })
    } catch (err) {
      this.progress({ ...base, stage: 'error', error: toErrorShape(err) })
      throw err
    } finally {
      this.library.setBusy(entryId, false)
      await this.library.broadcast()
    }
  }
}
