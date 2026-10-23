import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { AppError } from '../shared/errors'
import type { EntryPatch } from '../shared/ipc'
import { parseManifest, RUNNER_GAME_FILE, type Manifest } from '../shared/manifest'
import { toPosix } from '../shared/patterns'
import type { ArtKind, DetectionCandidate, GameEntry, LibraryItem, RequirementsReport } from '../shared/types'
import type { AppContext } from './context'
import { detectGame } from './detect'
import {
  imageExtension,
  isDirectory,
  isFile,
  isInside,
  pathExists,
  readSmallFile,
  readSmallTextFile,
  sanitizeFileName,
  walkFiles,
  writeFileAtomic
} from './fsutil'
import { directPlan, runnerPlan, type GameLauncher } from './launcher'
import { rankExecutables, type ExecutableCandidate } from './repoInstall'
import { evaluateRequirements, validateUserFile, type RunnerState } from './requirements'
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
    else {
      this.busy.delete(id)
      // Instalação, atualização ou rollback trocaram os arquivos: o executável visto antes não vale mais.
      this.executables.delete(id)
    }
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
    const report = await evaluateRequirements(manifest, entry, this.ctx.platform, await this.runnerState(manifest))
    if (!manifest.runner) this.executables.set(id, report.executable)
    return report
  }

  /**
   * Emulador de um jogo via runner: a entrada dele usada por último que tem o executável. Emulador
   * sendo instalado ou atualizado não conta (os arquivos estão mudando), mas aparece como "instalando".
   */
  private async runnerState(manifest: Manifest): Promise<RunnerState | undefined> {
    if (!manifest.runner) return undefined
    const emulatorId = manifest.runner.manifest
    const emulator = this.ctx.getManifest(emulatorId)
    const name = emulator?.name ?? emulatorId
    const entries = this.ctx.store
      .getEntries()
      .filter((e) => e.manifestId === emulatorId)
      .sort((a, b) => (b.lastPlayedAt ?? b.addedAt).localeCompare(a.lastPlayedAt ?? a.addedAt))
    if (emulator) {
      for (const entry of entries.filter((e) => !this.busy.has(e.id))) {
        const exe = this.executables.get(entry.id) ?? (await evaluateRequirements(emulator, entry, this.ctx.platform)).executable
        if (exe) return { manifestId: emulatorId, name, entryId: entry.id, executable: path.join(entry.path, exe) }
      }
    }
    const installing = entries.find((e) => this.busy.has(e.id))
    return { manifestId: emulatorId, name, entryId: (installing ?? entries[0])?.id ?? null, executable: null, installing: !!installing }
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
    // Jogos via emulador ficam na pasta do dump do usuário: não ocupam a pasta para um port.
    const existing = this.ctx.store
      .getEntries()
      .find((e) => !this.ctx.getManifest(e.manifestId)?.runner && path.resolve(e.path).toLowerCase() === resolved.toLowerCase())
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
    const entry = this.requireEntry(id)
    // Num jogo via emulador a pasta é a do arquivo do jogo: muda escolhendo o arquivo de novo (setUserFile).
    if (this.ctx.getManifest(entry.manifestId)?.runner) throw new AppError('NOT_FOUND', entry.manifestId)
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
    // Jogo via emulador: a pasta do jogo acompanha o arquivo (o dump pode estar em outro lugar agora).
    const runnerGame = !!this.ctx.getManifest(entry.manifestId)?.runner && requirementId === RUNNER_GAME_FILE
    this.ctx.store.saveEntry({
      ...entry,
      path: runnerGame ? path.dirname(path.resolve(file)) : entry.path,
      userFiles: { ...entry.userFiles, [requirementId]: file }
    })
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
    if (!(await isDirectory(entry.path))) throw new AppError('FOLDER_NOT_FOUND', entry.path, { path: entry.path })
    if (manifest.runner) {
      const runner = await this.runnerState(manifest)
      const emulatorEntry = runner?.entryId ? this.ctx.store.getEntry(runner.entryId) : undefined
      const emulator = this.ctx.getManifest(manifest.runner.manifest)
      if (!runner?.executable || !emulatorEntry || !emulator)
        throw new AppError('RUNNER_MISSING', manifest.runner.manifest, { name: runner?.name ?? manifest.runner.manifest })
      const gameFile = entry.userFiles[RUNNER_GAME_FILE]
      if (!gameFile || !(await isFile(gameFile))) throw new AppError('GAME_FILE_MISSING', gameFile ?? '')
      const plan = runnerPlan({ manifest, entry, gameFile }, { manifest: emulator, entry: emulatorEntry, exe: runner.executable }, this.ctx.platform)
      await this.launcher.launch(entry.id, plan, [emulatorEntry.id])
      return
    }
    const report = await evaluateRequirements(manifest, entry, this.ctx.platform)
    if (!report.executable) throw new AppError('EXE_NOT_FOUND', '', { path: entry.path })
    await this.launcher.launch(entry.id, directPlan(manifest, entry, report.executable, this.ctx.platform))
  }

  /**
   * Jogo via emulador: a "pasta do jogo" é a do arquivo que o usuário escolheu (o dump dele). Vários
   * jogos podem ficar na mesma pasta, então a mesma escolha (manifesto + arquivo) é que não se repete.
   */
  async addRunnerGame(manifestId: string, file: string): Promise<LibraryItem> {
    const manifest = this.ctx.getManifest(manifestId)
    if (!manifest?.runner) throw new AppError('NOT_FOUND', `Manifesto ${manifestId}`)
    if (!(await isFile(file))) throw new AppError('INVALID_FILE', file)
    const resolved = path.resolve(file)
    const same = (other: string | undefined) => !!other && path.resolve(other).toLowerCase() === resolved.toLowerCase()
    const existing = this.ctx.store.getEntries().find((e) => e.manifestId === manifestId && same(e.userFiles[RUNNER_GAME_FILE]))
    if (existing) return this.item(existing)
    const entry: GameEntry = {
      id: randomUUID(),
      manifestId,
      path: path.dirname(resolved),
      addedAt: new Date().toISOString(),
      totalPlayTimeSec: 0,
      launchCount: 0,
      installedVersion: null,
      autoUpdate: false,
      userFiles: { [RUNNER_GAME_FILE]: resolved },
      firstRunDone: {}
    }
    this.ctx.store.saveEntry(entry)
    await this.broadcast()
    return this.item(entry)
  }

  // Projetos adicionados pelo link do repositório ----------------------------------

  /** Manifesto gerado pelo app (pasta de manifestos do usuário): o único que o app reescreve ou apaga. */
  private customManifestFile(manifestId: string): string {
    if (!this.ctx.getManifest(manifestId)?.generated) throw new AppError('NOT_FOUND', manifestId)
    const file = path.join(this.ctx.paths.userManifests, `${manifestId}.json`)
    if (!isInside(this.ctx.paths.userManifests, file)) throw new AppError('NOT_FOUND', manifestId)
    return file
  }

  /** Grava o executável escolhido (ou detectado) no manifesto gerado e o reconhece por ele daqui em diante. */
  async setCustomExecutable(manifestId: string, rel: string): Promise<void> {
    const file = this.customManifestFile(manifestId)
    const text = await readSmallTextFile(file, 1024 * 1024)
    if (text === null) throw new AppError('INVALID_FILE', file)
    const data = JSON.parse(text) as Record<string, unknown>
    const next = {
      ...data,
      executables: { ...(data.executables as object), [this.ctx.platform]: [rel] },
      detectFiles: [rel]
    }
    if (!parseManifest(next).ok) throw new AppError('INVALID_FILE', rel)
    await writeFileAtomic(file, `${JSON.stringify(next, null, 2)}\n`)
    await this.ctx.reloadManifests()
    this.ctx.emit('manifests:changed', this.ctx.manifestsReport)
    this.executables.clear()
    await this.broadcast()
  }

  /** Depois de instalar um projeto pelo link: acha o executável mais provável na pasta (se houver) e o grava. */
  async detectCustomExecutable(entryId: string): Promise<void> {
    const entry = this.requireEntry(entryId)
    const files = await walkFiles(entry.path, 3)
    const candidates: ExecutableCandidate[] = await Promise.all(
      files.map(async (f) => ({
        rel: f.rel,
        executable:
          this.ctx.platform !== 'win32' && !/\.[A-Za-z0-9]{1,5}$/.test(f.rel)
            ? await fs.stat(f.abs).then(
                (s) => (s.mode & 0o111) !== 0,
                () => false
              )
            : undefined
      }))
    )
    const repoName = this.ctx.getManifest(entry.manifestId)?.name ?? ''
    const best = rankExecutables(candidates, this.ctx.platform, repoName)[0]
    if (best) await this.setCustomExecutable(entry.manifestId, best)
  }

  /** O usuário escolhe o executável certo dentro da pasta do jogo (projetos adicionados pelo link). */
  async pickCustomExecutable(entryId: string, file: string): Promise<RequirementsReport> {
    const entry = this.requireEntry(entryId)
    this.customManifestFile(entry.manifestId)
    if (!isInside(entry.path, file) || !(await isFile(file))) throw new AppError('INVALID_FILE', file)
    await this.setCustomExecutable(entry.manifestId, toPosix(path.relative(entry.path, file)))
    return this.requirements(entryId)
  }

  /** Tira do catálogo um projeto adicionado pelo link (só quando nenhum jogo da biblioteca o usa). */
  async removeCustomManifest(manifestId: string): Promise<void> {
    const file = this.customManifestFile(manifestId)
    if (this.ctx.store.getEntries().some((e) => e.manifestId === manifestId)) throw new AppError('BUSY')
    await fs.rm(file, { force: true })
    await this.ctx.reloadManifests()
    this.ctx.emit('manifests:changed', this.ctx.manifestsReport)
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
    // Jogo via emulador: o ícone seria o do emulador, não o do jogo.
    if (this.ctx.getManifest(entry.manifestId)?.runner) return null
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
