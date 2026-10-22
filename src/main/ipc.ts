import { app, dialog, ipcMain, shell, type OpenDialogOptions } from 'electron'
import path from 'node:path'
import { AppError, toErrorShape } from '../shared/errors'
import type { EntryPatch } from '../shared/ipc'
import type { AppInfo, ConfigFileView, IpcResult, SettingsPatch, SettingsView } from '../shared/types'
import type { AppUpdater } from './appUpdater'
import { listConfigBackups, readConfigFile, restoreConfigBackup, saveConfigFile } from './configFiles'
import type { AppContext } from './context'
import type { DevlogTracker } from './devlogState'
import type { GameUpdateService } from './gameUpdates'
import { mainText } from './i18n'
import { COVER_EXTENSIONS, type LibraryService } from './library'

export interface Services {
  ctx: AppContext
  library: LibraryService
  updates: GameUpdateService
  appUpdater: AppUpdater
  devlog: DevlogTracker
}

function str(value: unknown, name = 'valor'): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 4096) throw new AppError('UNKNOWN', `Parâmetro inválido: ${name}`)
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
  const { ctx, library, updates, appUpdater, devlog } = s
  const text = () => mainText(ctx.store.getSettings().language)

  const openDialog = async (options: OpenDialogOptions): Promise<string | null> => {
    const result = ctx.window ? await dialog.showOpenDialog(ctx.window, options) : await dialog.showOpenDialog(options)
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0]
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
    await ctx.reloadManifests()
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
  handle('library:pickCover', async (id) => {
    const file = await openDialog({
      title: text().pickCover,
      properties: ['openFile'],
      filters: [{ name: text().images, extensions: COVER_EXTENSIONS.map((ext) => ext.slice(1)) }]
    })
    return file ? library.setCover(str(id), file) : library.item(entryOrThrow(str(id)).entry)
  })
  handle('library:clearCover', (id) => library.clearCover(str(id)))

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
    if (typeof p.userName === 'string') clean.userName = p.userName.slice(0, 60)
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
