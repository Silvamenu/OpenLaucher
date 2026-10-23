import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { AppError } from '../shared/errors'
import type { EntryPatch } from '../shared/ipc'
import type { Manifest } from '../shared/manifest'
import type { ArtKind, DetectionCandidate, GameEntry, LibraryItem, RequirementsReport } from '../shared/types'
import type { AppContext } from './context'
import { detectGame } from './detect'
import { imageExtension, isDirectory, isFile, isInside, pathExists, readSmallFile, sanitizeFileName, writeFileAtomic } from './fsutil'
import type { GameLauncher } from './launcher'
import { evaluateRequirements, validateUserFile } from './requirements'
import { listBackups, toBackupInfo } from './updateCore'

export const COVER_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif']
/** Capa e banner escolhidos pelo usuário: até 20 MB, conferidos pelo conteúdo (não só pela extensão). */
const ART_MAX_BYTES = 20 * 1024 * 1024

export class LibraryService {
  private readonly busy = new Set<string>()
  private readonly iconCache = new Map<string, string | null>()
  /** Executável achado na última avaliação de cada jogo: o ícone não precisa varrer a pasta de novo. */
  private readonly executables = new Map<string, string | null>()
  private launcher!: GameLauncher

  constructor(private readonly ctx: AppContext) {}

  attachLauncher(launcher: GameLauncher): void {
    this.launcher = launcher
  }

  /** Entrada da biblioteca ou erro NOT_FOUND. */
  requireEntry(id: string): GameEntry {
    const entry = this.ctx.store.getEntry(id)
    if (!entry) throw new AppError('NOT_FOUND', `Jogo ${id} não encontrado`)
    return entry
  }

  setBusy(id: string, value: boolean): void {
    if (value) this.busy.add(id)
    else this.busy.delete(id)
  }

  isBusy(id: string): boolean {
    return this.busy.has(id)
  }

  isRunning(id: string): boolean {
    return this.launcher?.isRunning(id) ?? false
  }

  backupsDirFor(entry: GameEntry): string {
    return path.join(this.ctx.paths.backups, entry.manifestId)
  }

  async requirements(id: string): Promise<RequirementsReport> {
    const entry = this.requireEntry(id)
    const manifest = this.ctx.getManifest(entry.manifestId)
    if (!manifest) {
      return { entryId: id, status: 'unknownManifest', folderExists: await isDirectory(entry.path), executable: null, items: [] }
    }
    const report = await evaluateRequirements(manifest, entry, this.ctx.platform)
    this.executables.set(id, report.executable)
    return report
  }

  async item(entry: GameEntry): Promise<LibraryItem> {
    const manifest = this.ctx.getManifest(entry.manifestId)
    const report = await this.requirements(entry.id)
    const backups = await listBackups(this.backupsDirFor(entry), entry.id)
    return {
      entry,
      manifest,
      name: entry.customName || manifest?.name || entry.manifestId,
      status: report.status,
      running: this.isRunning(entry.id),
      update: this.ctx.store.getUpdateState(entry.id),
      backups: backups.map(toBackupInfo),
      busy: this.busy.has(entry.id)
    }
  }

  async list(): Promise<LibraryItem[]> {
    const entries = this.ctx.store.getEntries()
    const items = await Promise.all(entries.map((e) => this.item(e)))
    return items.sort((a, b) => (b.entry.lastPlayedAt ?? b.entry.addedAt).localeCompare(a.entry.lastPlayedAt ?? a.entry.addedAt))
  }

  async broadcast(): Promise<LibraryItem[]> {
    const items = await this.list()
    this.ctx.emit('library:changed', items)
    return items
  }

  async detect(folder: string): Promise<DetectionCandidate[]> {
    return detectGame(folder, this.ctx.manifestsReport.manifests)
  }

  async add(folder: string, manifestId: string): Promise<LibraryItem> {
    if (!(await isDirectory(folder))) throw new AppError('FOLDER_NOT_FOUND', folder, { path: folder })
    if (!this.ctx.getManifest(manifestId)) throw new AppError('NOT_FOUND', `Manifesto ${manifestId}`)
    const resolved = path.resolve(folder)
    const existing = this.ctx.store.getEntries().find((e) => path.resolve(e.path).toLowerCase() === resolved.toLowerCase())
    if (existing) return this.item(existing)
    const entry: GameEntry = {
      id: randomUUID(),
      manifestId,
      path: resolved,
      addedAt: new Date().toISOString(),
      totalPlayTimeSec: 0,
      launchCount: 0,
      installedVersion: null,
      autoUpdate: false,
      userFiles: {},
      firstRunDone: {}
    }
    this.ctx.store.saveEntry(entry)
    await this.broadcast()
    return this.item(entry)
  }

  /**
   * Pasta nova para instalar um port: <pasta escolhida>/<nome do jogo>. Ela precisa estar vazia
   * (ou não existir) e não pode já estar na biblioteca, para a instalação não misturar arquivos.
   */
  async prepareInstall(parent: string, manifest: Manifest): Promise<LibraryItem> {
    // "Zelda 64: Recompiled" vira "Zelda 64 Recompiled" (":" não vale em nome de pasta no Windows).
    const dir = path.join(path.resolve(parent), sanitizeFileName(manifest.name.replace(/:/g, '')))
    const inLibrary = this.ctx.store.getEntries().some((e) => path.resolve(e.path).toLowerCase() === dir.toLowerCase())
    // Só "não existe" conta como vazia; pasta que não dá para listar (permissão) não pode receber a instalação.
    const contents = await fs.readdir(dir).catch((err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') return []
      throw err
    })
    if (inLibrary || contents.length > 0) throw new AppError('FOLDER_NOT_EMPTY', dir, { path: dir })
    await fs.mkdir(dir, { recursive: true })
    return this.add(dir, manifest.id)
  }

  /** Desfaz uma instalação que não terminou: tira o jogo da biblioteca e apaga a pasta se ela ficou vazia. */
  async discardInstall(id: string): Promise<void> {
    const entry = this.ctx.store.getEntry(id)
    if (!entry) return
    await this.remove(id)
    await fs.rmdir(entry.path).catch(() => undefined)
  }

  async remove(id: string): Promise<void> {
    const entry = this.requireEntry(id)
    if (this.isRunning(id) || this.busy.has(id)) throw new AppError('BUSY')
    this.ctx.store.removeEntry(id)
    this.executables.delete(id)
    await this.removeArtFiles(id, 'cover')
    await this.removeArtFiles(id, 'banner')
    // Backups que o app fez deste jogo ficariam órfãos: readicionado, o jogo ganha outro id. Os arquivos do jogo ficam.
    for (const backup of await listBackups(this.backupsDirFor(entry), id)) {
      await fs.rm(backup.dir, { recursive: true, force: true }).catch(() => undefined)
    }
    const configBackups = path.join(this.ctx.paths.configBackups, id)
    if (isInside(this.ctx.paths.configBackups, configBackups)) await fs.rm(configBackups, { recursive: true, force: true }).catch(() => undefined)
    await this.broadcast()
  }

  async update(id: string, patch: EntryPatch): Promise<LibraryItem> {
    const entry = this.requireEntry(id)
    const next: GameEntry = { ...entry }
    if (patch.customName !== undefined) next.customName = patch.customName?.trim() || undefined
    if (patch.autoUpdate !== undefined) next.autoUpdate = patch.autoUpdate
    if (patch.installedVersion !== undefined) {
      next.installedVersion = patch.installedVersion
      next.installedPublishedAt = patch.installedPublishedAt ?? null
    }
    this.ctx.store.saveEntry(next)
    await this.broadcast()
    return this.item(next)
  }

  async changeFolder(id: string, folder: string): Promise<LibraryItem> {
    this.requireEntry(id)
    // Atualização/rollback em andamento usam a pasta atual; trocar agora misturaria as duas instalações.
    if (this.busy.has(id)) throw new AppError('BUSY')
    if (!(await isDirectory(folder))) throw new AppError('FOLDER_NOT_FOUND', folder, { path: folder })
    if (this.busy.has(id)) throw new AppError('BUSY')
    const next = { ...this.requireEntry(id), path: path.resolve(folder) }
    this.ctx.store.saveEntry(next)
    this.iconCache.clear()
    await this.broadcast()
    return this.item(next)
  }

  async setUserFile(id: string, requirementId: string, file: string): Promise<RequirementsReport> {
    const entry = this.requireEntry(id)
    if (!(await isFile(file))) throw new AppError('INVALID_FILE', file)
    this.ctx.store.saveEntry({ ...entry, userFiles: { ...entry.userFiles, [requirementId]: file } })
    await this.broadcast()
    return this.requirements(id)
  }

  /** Copia o arquivo do usuário (ex.: ROM) para a pasta do jogo — apenas localmente. */
  async copyUserFile(id: string, requirementId: string): Promise<RequirementsReport> {
    const entry = this.requireEntry(id)
    const manifest = this.ctx.getManifest(entry.manifestId)
    const req = manifest?.requirements.find((r) => r.id === requirementId)
    const source = entry.userFiles[requirementId]
    if (!req || req.type !== 'userFile' || !req.copyToGameDir || !source) throw new AppError('NOT_FOUND')
    const check = await validateUserFile(source, req)
    if (!check.ok) throw new AppError('INVALID_FILE', source)
    const target = path.join(entry.path, path.basename(source))
    if (!(await pathExists(target))) await fs.copyFile(source, target)
    await this.broadcast()
    return this.requirements(id)
  }

  async setFirstRunDone(id: string, requirementId: string, done: boolean): Promise<RequirementsReport> {
    const entry = this.requireEntry(id)
    this.ctx.store.saveEntry({ ...entry, firstRunDone: { ...entry.firstRunDone, [requirementId]: done } })
    await this.broadcast()
    return this.requirements(id)
  }

  async launch(id: string): Promise<void> {
    const entry = this.requireEntry(id)
    const manifest = this.ctx.getManifest(entry.manifestId)
    if (!manifest) throw new AppError('NOT_FOUND', entry.manifestId)
    if (this.busy.has(id)) throw new AppError('BUSY')
    const report = await evaluateRequirements(manifest, entry, this.ctx.platform)
    if (!report.folderExists) throw new AppError('FOLDER_NOT_FOUND', entry.path, { path: entry.path })
    await this.launcher.launch(entry, manifest, report.executable)
  }

  onGameStarted(id: string): void {
    const entry = this.ctx.store.getEntry(id)
    if (entry) {
      this.ctx.store.saveEntry({ ...entry, lastPlayedAt: new Date().toISOString(), launchCount: entry.launchCount + 1 })
    }
    void this.broadcast()
  }

  onGameExited(id: string, seconds: number): void {
    const entry = this.ctx.store.getEntry(id)
    if (entry) this.ctx.store.saveEntry({ ...entry, totalPlayTimeSec: entry.totalPlayTimeSec + Math.max(0, seconds) })
    void this.broadcast()
  }

  /**
   * Ícone do executável (extraído pelo sistema) como data URL. Só no Windows o .exe traz o
   * ícone do jogo; no Linux o sistema devolveria um ícone genérico de "executável".
   */
  async icon(id: string): Promise<string | null> {
    if (this.ctx.platform !== 'win32') return null
    const entry = this.requireEntry(id)
    const executable = this.executables.has(id) ? this.executables.get(id) : (await this.requirements(id)).executable
    if (!executable) return null
    const exe = path.join(entry.path, executable)
    if (this.iconCache.has(exe)) return this.iconCache.get(exe) ?? null
    let url: string | null
    try {
      const image = await app.getFileIcon(exe, { size: 'large' })
      url = image.isEmpty() ? null : image.toDataURL()
    } catch {
      url = null
    }
    this.iconCache.set(exe, url)
    return url
  }

  // Capas e banners personalizados ---------------------------------------------

  /** A capa mantém o nome de sempre (<id>.png); o banner ganha o sufixo -banner. */
  private artBase(id: string, kind: ArtKind): string {
    return path.join(this.ctx.paths.covers, kind === 'cover' ? id : `${id}-banner`)
  }

  async artFile(id: string, kind: ArtKind): Promise<string | null> {
    for (const ext of COVER_EXTENSIONS) {
      const file = `${this.artBase(id, kind)}${ext}`
      if (await pathExists(file)) return file
    }
    return null
  }

  private async removeArtFiles(id: string, kind: ArtKind, keep?: string): Promise<void> {
    for (const ext of COVER_EXTENSIONS) if (ext !== keep) await fs.rm(`${this.artBase(id, kind)}${ext}`, { force: true })
  }

  /**
   * Lê a entrada de novo depois das esperas: o tempo de jogo, por exemplo, pode ter mudado no meio.
   * A versão vai na URL da imagem e é um carimbo de tempo, não um contador: depois de remover e
   * escolher outra, a URL não repete a anterior (o Chromium mostraria a imagem antiga do cache).
   */
  private async saveArtVersion(id: string, kind: ArtKind, changed: boolean): Promise<LibraryItem> {
    const entry = this.requireEntry(id)
    const current = kind === 'cover' ? entry.coverVersion : entry.bannerVersion
    const version = changed ? Math.max(Date.now(), (current ?? 0) + 1) : undefined
    const next: GameEntry = kind === 'cover' ? { ...entry, coverVersion: version } : { ...entry, bannerVersion: version }
    this.ctx.store.saveEntry(next)
    await this.broadcast()
    return this.item(next)
  }

  async setArt(id: string, kind: ArtKind, source: string): Promise<LibraryItem> {
    this.requireEntry(id)
    const data = await readSmallFile(source, ART_MAX_BYTES)
    const ext = data && imageExtension(data)
    if (!data || !ext) throw new AppError('INVALID_IMAGE', source)
    await writeFileAtomic(`${this.artBase(id, kind)}${ext}`, data)
    await this.removeArtFiles(id, kind, ext)
    return this.saveArtVersion(id, kind, true)
  }

  async clearArt(id: string, kind: ArtKind): Promise<LibraryItem> {
    this.requireEntry(id)
    await this.removeArtFiles(id, kind)
    return this.saveArtVersion(id, kind, false)
  }
}
