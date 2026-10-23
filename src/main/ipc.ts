import { app, dialog, ipcMain, shell, type OpenDialogOptions, type SaveDialogOptions } from 'electron'
import path from 'node:path'
import { AppError, toErrorShape } from '../shared/errors'
import type { EntryPatch } from '../shared/ipc'
import { RUNNER_GAME_FILE } from '../shared/manifest'
import { installableOn } from '../shared/manifestUtils'
import type { AppInfo, ArtKind, ConfigFileView, IpcResult, SettingsPatch, SettingsView } from '../shared/types'
import type { AppUpdater } from './appUpdater'
import { listConfigBackups, readConfigFile, restoreConfigBackup, saveConfigFile } from './configFiles'
import type { AppContext } from './context'
import type { DevlogTracker } from './devlogState'
import { readSmallTextFile, sanitizeFileName, writeFileAtomic } from './fsutil'
import type { GameUpdateService } from './gameUpdates'
import { mainText } from './i18n'
import { COVER_EXTENSIONS, type LibraryService } from './library'
import type { ProfileService } from './profiles'

/** Um arquivo .relaunch tem poucos bytes; o limite só evita ler um arquivo enorme por engano. */
const PROFILE_FILE_MAX_BYTES = 64 * 1024

export interface Services {
  ctx: AppContext
  library: LibraryService
  updates: GameUpdateService
  appUpdater: AppUpdater
  devlog: DevlogTracker
  profiles: ProfileService
}

function str(value: unknown, name = 'valor'): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 4096) throw new AppError('UNKNOWN', `Parâmetro inválido: ${name}`)
  return value
}

function artKind(value: unknown): ArtKind {
  if (value !== 'cover' && value !== 'banner') throw new AppError('UNKNOWN', 'Parâmetro inválido: kind')
  return value
}

function int(value: unknown, name = 'valor'): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw new AppError('UNKNOWN', `Parâmetro inválido: ${name}`)
  return value
}

function handle(channel: string, fn: (...args: unknown[]) => unknown): void {
  ipcMain.handle(channel, async (_event, ...args): Promise<IpcResult<unknown>> => {
    try {
      return { ok: true, data: await fn(...args) }
    } catch (err) {
      const shape = toErrorShape(err)
      if (shape.code === 'UNKNOWN') console.error(`[ipc] ${channel}`, err)
      return { ok: false, error: shape }
    }
  })
}

export function registerIpc(s: Services): void {
  const { ctx, library, updates, appUpdater, devlog, profiles } = s
  const text = () => mainText(ctx.store.getSettings().language)

  const openDialog = async (options: OpenDialogOptions): Promise<string | null> => {
    const result = ctx.window ? await dialog.showOpenDialog(ctx.window, options) : await dialog.showOpenDialog(options)
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0]
  }

  const saveDialog = async (options: SaveDialogOptions): Promise<string | null> => {
    const result = ctx.window ? await dialog.showSaveDialog(ctx.window, options) : await dialog.showSaveDialog(options)
    return result.canceled || !result.filePath ? null : result.filePath
  }

  const entryOrThrow = (id: string) => {
    const entry = library.requireEntry(id)
    const manifest = ctx.getManifest(entry.manifestId)
    if (!manifest) throw new AppError('NOT_FOUND', entry.manifestId)
    return { entry, manifest }
  }

  // App ---------------------------------------------------------------------
  handle('app:info', (): AppInfo => ({
    version: app.getVersion(),
    platform: ctx.platform,
    isPackaged: app.isPackaged,
    userDataPath: ctx.paths.userData,
    manifestsUserPath: ctx.paths.userManifests
  }))
  handle('app:openExternal', async (url) => {
    const target = str(url, 'url')
    if (!/^https:\/\//i.test(target)) throw new AppError('UNTRUSTED_URL', target)
    await shell.openExternal(target)
  })
  // Só as pastas que a interface oferece: abrir um arquivo qualquer executaria programas.
  handle('app:openPath', async (p) => {
    const target = path.resolve(str(p, 'path'))
    const allowed = [ctx.paths.userData, ctx.paths.userManifests].some((dir) => path.resolve(dir) === target)
    if (!allowed) throw new AppError('PERMISSION_DENIED', target)
    const error = await shell.openPath(target)
    if (error) throw new AppError('NOT_FOUND', error, { path: target })
  })

  // Manifestos --------------------------------------------------------------
  handle('manifests:list', () => ctx.manifestsReport)

  // Biblioteca --------------------------------------------------------------
  handle('library:list', () => library.list())
  handle('library:rescan', async () => {
    ctx.emit('manifests:changed', await ctx.reloadManifests())
    return library.broadcast()
  })
  // Só pastas escolhidas pelo usuário no diálogo (ou a subpasta imediata que a detecção acha nelas).
  const pickedFolders = new Set<string>()
  const pickedFolder = (value: unknown): string => {
    const folder = path.resolve(str(value, 'folder'))
    if (!pickedFolders.has(folder) && !pickedFolders.has(path.dirname(folder))) throw new AppError('PERMISSION_DENIED', folder)
    return folder
  }
  handle('library:pickFolder', async () => {
    const folder = await openDialog({ title: text().pickGameFolder, properties: ['openDirectory'] })
    if (folder) pickedFolders.add(path.resolve(folder))
    return folder
  })
  handle('library:detect', (folder) => library.detect(pickedFolder(folder)))
  handle('library:add', (folder, manifestId) => library.add(pickedFolder(folder), str(manifestId, 'manifestId')))
  handle('library:remove', (id) => library.remove(str(id)))
  handle('library:update', (id, patch) => {
    const p = (patch ?? {}) as EntryPatch
    const clean: EntryPatch = {}
    if (p.customName === null || typeof p.customName === 'string') clean.customName = p.customName
    if (typeof p.autoUpdate === 'boolean') clean.autoUpdate = p.autoUpdate
    if (p.installedVersion === null || typeof p.installedVersion === 'string') {
      clean.installedVersion = p.installedVersion
      clean.installedPublishedAt = typeof p.installedPublishedAt === 'string' ? p.installedPublishedAt : null
    }
    return library.update(str(id), clean)
  })
  handle('library:changeFolder', async (id) => {
    const folder = await openDialog({ title: text().pickGameFolder, properties: ['openDirectory'] })
    return folder ? library.changeFolder(str(id), folder) : null
  })
  handle('library:requirements', (id) => library.requirements(str(id)))
  handle('library:pickUserFile', async (id, reqId) => {
    const { manifest } = entryOrThrow(str(id))
    const req = manifest.requirements.find((r) => r.id === reqId)
    if (!req || req.type !== 'userFile') throw new AppError('NOT_FOUND')
    const filters =
      req.extensions.length > 0
        ? [
            { name: req.label, extensions: req.extensions },
            { name: text().allFiles, extensions: ['*'] }
          ]
        : undefined
    const file = await openDialog({ title: text().pickFile, properties: ['openFile'], filters })
    if (!file) return library.requirements(str(id))
    return library.setUserFile(str(id), req.id, file)
  })
  handle('library:copyUserFile', (id, reqId) => library.copyUserFile(str(id), str(reqId)))
  handle('library:setFirstRunDone', (id, reqId, done) => library.setFirstRunDone(str(id), str(reqId), done === true))
  handle('library:openFolder', async (id) => {
    const { entry } = entryOrThrow(str(id))
    const error = await shell.openPath(entry.path)
    if (error) throw new AppError('FOLDER_NOT_FOUND', error, { path: entry.path })
  })
  handle('library:launch', (id) => library.launch(str(id)))
  handle('library:icon', (id) => library.icon(str(id)))
  handle('library:pickArt', async (id, kind) => {
    const entryId = library.requireEntry(str(id)).id
    const art = artKind(kind)
    const file = await openDialog({
      title: art === 'cover' ? text().pickCover : text().pickBanner,
      properties: ['openFile'],
      filters: [{ name: text().images, extensions: COVER_EXTENSIONS.map((ext) => ext.slice(1)) }]
    })
    return file ? library.setArt(entryId, art, file) : library.item(library.requireEntry(entryId))
  })
  handle('library:clearArt', (id, kind) => library.clearArt(str(id), artKind(kind)))
  // Jogo via emulador: o usuário escolhe o arquivo do jogo dele (o dump) aqui no diálogo.
  handle('library:addRunnerGame', async (manifestId) => {
    const manifest = ctx.getManifest(str(manifestId, 'manifestId'))
    const req = manifest?.runner ? manifest.requirements.find((r) => r.id === RUNNER_GAME_FILE) : undefined
    if (!manifest || !req || req.type !== 'userFile') throw new AppError('NOT_FOUND')
    const filters =
      req.extensions.length > 0
        ? [
            { name: req.label, extensions: req.extensions },
            { name: text().allFiles, extensions: ['*'] }
          ]
        : undefined
    const file = await openDialog({ title: text().pickGameFile(manifest.name), properties: ['openFile'], filters })
    return file ? library.addRunnerGame(manifest.id, file) : null
  })
  // Projetos adicionados pelo link do repositório do GitHub.
  handle('library:inspectRepo', (url) => updates.inspectRepo(str(url, 'url')))
  handle('library:installFromRepo', async (url, assetName) => {
    const inspection = await updates.inspectRepo(str(url, 'url'))
    const parent = await openDialog({ title: text().pickInstallFolder(inspection.repo.split('/')[1]), properties: ['openDirectory', 'createDirectory'] })
    // Projeto que já está no catálogo não precisa de arquivo escolhido (usa o manifesto pronto).
    const asset = typeof assetName === 'string' ? assetName.slice(0, 512) : ''
    return parent ? updates.installFromRepo(str(url, 'url'), asset, parent) : null
  })
  handle('library:pickExecutable', async (id) => {
    const { entry } = entryOrThrow(str(id))
    const file = await openDialog({
      title: text().pickExecutable,
      defaultPath: entry.path,
      properties: ['openFile'],
      filters: ctx.platform === 'win32' ? [{ name: text().programs, extensions: ['exe'] }] : undefined
    })
    return file ? library.pickCustomExecutable(entry.id, file) : library.requirements(entry.id)
  })
  handle('library:removeCustomManifest', (manifestId) => library.removeCustomManifest(str(manifestId, 'manifestId')))
  // Pasta escolhida aqui no diálogo; o download segue o mesmo caminho validado das atualizações.
  handle('library:install', async (manifestId) => {
    const manifest = ctx.getManifest(str(manifestId, 'manifestId'))
    if (!manifest || !installableOn(manifest, ctx.platform)) throw new AppError('UPDATES_DISABLED')
    const parent = await openDialog({ title: text().pickInstallFolder(manifest.name), properties: ['openDirectory', 'createDirectory'] })
    return parent ? updates.install(manifest, parent) : null
  })

  // Perfis ------------------------------------------------------------------
  const profileFilters = () => [{ name: text().profileFile, extensions: ['relaunch'] }]
  handle('profiles:state', () => profiles.state())
  handle('profiles:create', (input) => profiles.create(input))
  handle('profiles:enter', (id, pin) => profiles.enter(str(id), pin))
  handle('profiles:leave', () => profiles.leave())
  handle('profiles:update', (id, patch) => profiles.update(str(id), patch))
  handle('profiles:remove', (id) => profiles.remove(str(id)))
  handle('profiles:import', async () => {
    const file = await openDialog({ title: text().importProfile, properties: ['openFile'], filters: profileFilters() })
    if (!file) return null
    const content = await readSmallTextFile(file, PROFILE_FILE_MAX_BYTES)
    if (content === null) throw new AppError('INVALID_FILE')
    return profiles.importFile(content)
  })
  handle('profiles:export', async () => {
    const { name, content } = profiles.exportCurrent()
    const file = await saveDialog({ title: text().exportProfile, defaultPath: `${sanitizeFileName(name)}.relaunch`, filters: profileFilters() })
    if (!file) return false
    await writeFileAtomic(file, content)
    return true
  })

  // Configs -----------------------------------------------------------------
  const configView = async (
    id: string,
    index: number
  ): Promise<{ view: ConfigFileView; spec: (typeof ctx.manifestsReport.manifests)[number]['configFiles'][number] }> => {
    const { entry, manifest } = entryOrThrow(id)
    const spec = manifest.configFiles[index]
    if (!spec) throw new AppError('NOT_FOUND')
    const view = await readConfigFile(spec, index, entry.path, ctx.platform)
    if (!view) throw new AppError('NOT_FOUND')
    return { view, spec }
  }
  handle('configs:list', async (id) => {
    const { entry, manifest } = entryOrThrow(str(id))
    const views = await Promise.all(manifest.configFiles.map((spec, i) => readConfigFile(spec, i, entry.path, ctx.platform)))
    return views.filter((v): v is ConfigFileView => v !== null)
  })
  handle('configs:save', async (id, index, content) => {
    if (typeof content !== 'string') throw new AppError('INVALID_CONFIG')
    const { view, spec } = await configView(str(id), int(index))
    await saveConfigFile({ spec, file: view.path, content, backupsRoot: ctx.paths.configBackups, entryId: str(id) })
    return (await configView(str(id), int(index))).view
  })
  handle('configs:backups', async (id, index) => {
    const { view } = await configView(str(id), int(index))
    return listConfigBackups(ctx.paths.configBackups, str(id), view.path)
  })
  handle('configs:restore', async (id, index, name) => {
    const { view, spec } = await configView(str(id), int(index))
    if (!spec.editable) throw new AppError('CONFIG_NOT_EDITABLE')
    await restoreConfigBackup(ctx.paths.configBackups, str(id), view.path, str(name))
    return (await configView(str(id), int(index))).view
  })

  // Atualizações dos jogos --------------------------------------------------
  handle('updates:check', (id) => updates.check(typeof id === 'string' ? id : undefined))
  handle('updates:releases', (id) => updates.releases(str(id)))
  handle('updates:start', (id) => updates.start(str(id)))
  handle('updates:cancel', (id) => updates.cancel(str(id)))
  handle('updates:rollback', (id) => updates.rollback(str(id)))
  handle('updates:rateLimit', () => ctx.store.getRateLimit())

  // Configurações -----------------------------------------------------------
  handle('settings:get', (): SettingsView => ctx.store.settingsView())
  handle('settings:set', (patch): SettingsView => {
    const p = (patch ?? {}) as SettingsPatch
    const clean: Partial<SettingsView> = {}
    if (p.theme === 'dark' || p.theme === 'light' || p.theme === 'system') clean.theme = p.theme
    if (p.language === 'pt-BR' || p.language === 'en') clean.language = p.language
    if (typeof p.notifications === 'boolean') clean.notifications = p.notifications
    if (typeof p.checkGameUpdates === 'boolean') clean.checkGameUpdates = p.checkGameUpdates
    ctx.store.setSettings(clean)
    if (typeof p.githubToken === 'string') ctx.store.setGithubToken(p.githubToken)
    const view = ctx.store.settingsView()
    ctx.emit('settings:changed', view)
    return view
  })

  // Atualização do launcher -------------------------------------------------
  handle('appUpdate:state', () => appUpdater.getState())
  handle('appUpdate:check', () => appUpdater.check())
  handle('appUpdate:install', () => appUpdater.install())

  // Devlog ------------------------------------------------------------------
  handle('devlog:pending', () => devlog.pending())
  handle('devlog:current', () => devlog.current())
  handle('devlog:markSeen', () => devlog.markSeen())
}
