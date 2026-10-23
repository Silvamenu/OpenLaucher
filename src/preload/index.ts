import { contextBridge, ipcRenderer } from 'electron'
import type { ApiEventName, ApiEvents, RelaunchApi } from '../shared/ipc'
import type { AppErrorShape, IpcResult } from '../shared/types'

/**
 * Erros cruzam o contextBridge como objetos simples: instâncias de Error perderiam
 * as propriedades extras (code/params) na cópia entre os mundos isolados.
 */
function apiError(shape: AppErrorShape) {
  return { name: 'ApiError', code: shape.code, message: shape.message, params: shape.params }
}

async function call<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<T>
  if (!result.ok) throw apiError(result.error)
  return result.data
}

const api: RelaunchApi = {
  app: {
    info: () => call('app:info'),
    openExternal: (url) => call('app:openExternal', url),
    openPath: (p) => call('app:openPath', p)
  },
  manifests: {
    list: () => call('manifests:list')
  },
  library: {
    list: () => call('library:list'),
    rescan: () => call('library:rescan'),
    pickFolder: () => call('library:pickFolder'),
    detect: (folder) => call('library:detect', folder),
    add: (folder, manifestId) => call('library:add', folder, manifestId),
    remove: (id) => call('library:remove', id),
    update: (id, patch) => call('library:update', id, patch),
    changeFolder: (id) => call('library:changeFolder', id),
    requirements: (id) => call('library:requirements', id),
    pickUserFile: (id, reqId) => call('library:pickUserFile', id, reqId),
    copyUserFile: (id, reqId) => call('library:copyUserFile', id, reqId),
    setFirstRunDone: (id, reqId, done) => call('library:setFirstRunDone', id, reqId, done),
    openFolder: (id) => call('library:openFolder', id),
    launch: (id) => call('library:launch', id),
    icon: (id) => call('library:icon', id),
    pickArt: (id, kind) => call('library:pickArt', id, kind),
    clearArt: (id, kind) => call('library:clearArt', id, kind),
    install: (manifestId) => call('library:install', manifestId),
    addRunnerGame: (manifestId) => call('library:addRunnerGame', manifestId),
    inspectRepo: (url) => call('library:inspectRepo', url),
    installFromRepo: (url, assetName) => call('library:installFromRepo', url, assetName),
    pickExecutable: (id) => call('library:pickExecutable', id),
    removeCustomManifest: (manifestId) => call('library:removeCustomManifest', manifestId)
  },
  profiles: {
    state: () => call('profiles:state'),
    create: (profile) => call('profiles:create', profile),
    enter: (id, pin) => call('profiles:enter', id, pin),
    leave: () => call('profiles:leave'),
    update: (id, patch) => call('profiles:update', id, patch),
    remove: (id) => call('profiles:remove', id),
    import: () => call('profiles:import'),
    export: () => call('profiles:export')
  },
  configs: {
    list: (id) => call('configs:list', id),
    save: (id, index, content) => call('configs:save', id, index, content),
    backups: (id, index) => call('configs:backups', id, index),
    restore: (id, index, name) => call('configs:restore', id, index, name)
  },
  updates: {
    check: (id) => call('updates:check', id),
    releases: (id) => call('updates:releases', id),
    start: (id) => call('updates:start', id),
    cancel: (id) => call('updates:cancel', id),
    rollback: (id) => call('updates:rollback', id),
    rateLimit: () => call('updates:rateLimit')
  },
  settings: {
    get: () => call('settings:get'),
    set: (patch) => call('settings:set', patch)
  },
  appUpdate: {
    state: () => call('appUpdate:state'),
    check: () => call('appUpdate:check'),
    install: () => call('appUpdate:install')
  },
  devlog: {
    pending: () => call('devlog:pending'),
    current: () => call('devlog:current'),
    markSeen: () => call('devlog:markSeen')
  },
  on<K extends ApiEventName>(event: K, listener: (payload: ApiEvents[K]) => void) {
    const wrapped = (_e: Electron.IpcRendererEvent, name: string, payload: ApiEvents[K]) => {
      if (name === event) listener(payload)
    }
    ipcRenderer.on('api:event', wrapped)
    return () => {
      ipcRenderer.removeListener('api:event', wrapped)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
