import { app, type BrowserWindow } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { ApiEventName, ApiEvents } from '../shared/ipc'
import type { Manifest, Platform } from '../shared/manifest'
import type { ManifestsReport } from '../shared/types'
import { loadManifests } from './manifests'
import { AppStore } from './store'

export interface AppPaths {
  userData: string
  backups: string
  configBackups: string
  covers: string
  userManifests: string
  builtinManifests: string
  changelog: string
}

export function resolvePlatform(): Platform {
  return process.platform === 'win32' || process.platform === 'darwin' ? process.platform : 'linux'
}

/** Arquivos que acompanham o app (manifests/ e CHANGELOG.md): em resources/ quando empacotado. */
function resourcePath(name: string): string {
  return app.isPackaged ? path.join(process.resourcesPath, name) : path.join(app.getAppPath(), name)
}

export function resolvePaths(): AppPaths {
  const userData = app.getPath('userData')
  return {
    userData,
    backups: path.join(userData, 'backups'),
    configBackups: path.join(userData, 'config-backups'),
    covers: path.join(userData, 'covers'),
    userManifests: path.join(userData, 'manifests'),
    builtinManifests: resourcePath('manifests'),
    changelog: resourcePath('CHANGELOG.md')
  }
}

/** Estado compartilhado entre os serviços do processo principal. */
export class AppContext {
  readonly store = new AppStore()
  readonly paths = resolvePaths()
  readonly platform = resolvePlatform()
  manifestsReport: ManifestsReport = { manifests: [], errors: [] }
  window: BrowserWindow | null = null

  async reloadManifests(): Promise<ManifestsReport> {
    await fs.mkdir(this.paths.userManifests, { recursive: true }).catch(() => undefined)
    this.manifestsReport = await loadManifests([
      { dir: this.paths.builtinManifests, origin: 'builtin' },
      { dir: this.paths.userManifests, origin: 'user' }
    ])
    return this.manifestsReport
  }

  getManifest(id: string): Manifest | null {
    return this.manifestsReport.manifests.find((m) => m.id === id) ?? null
  }

  emit<K extends ApiEventName>(event: K, payload: ApiEvents[K]): void {
    const win = this.window
    if (win && !win.isDestroyed()) win.webContents.send('api:event', event, payload)
  }
}
