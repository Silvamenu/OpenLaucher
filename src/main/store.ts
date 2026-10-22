import { safeStorage } from 'electron'
import Store from 'electron-store'
import type { HttpCacheEntry } from './github'
import { STORE_NAME } from './legacyData'
import type { ProfileStore, StoredProfile } from './profiles'
import type { GameEntry, GameUpdateState, RateLimitInfo, Settings, SettingsView } from '../shared/types'

interface StoredToken {
  encrypted: boolean
  value: string
}

interface Schema {
  settings: Settings
  library: GameEntry[]
  updateState: Record<string, GameUpdateState>
  githubToken: StoredToken | null
  rateLimit: RateLimitInfo | null
  /** SHA-1 dos arquivos do usuário (ROMs), por caminho|tamanho|data de modificação. */
  fileHashes: Record<string, string>
  profiles: StoredProfile[]
  app: {
    lastSeenVersion?: string
    releaseNotes: Record<string, { notes: string; date: string | null }>
  }
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  language: 'pt-BR',
  notifications: true,
  checkGameUpdates: true
}

const HTTP_CACHE_LIMIT = 60
const FILE_HASH_LIMIT = 50

/**
 * Persistência local em JSON (electron-store) com acesso tipado.
 * Com `cache`, o arquivo é lido uma vez e os valores devolvidos vêm congelados: copie antes de alterar.
 */
export class AppStore implements ProfileStore {
  private readonly store = new Store<Schema>({
    name: STORE_NAME,
    cache: true,
    defaults: {
      settings: DEFAULT_SETTINGS,
      library: [],
      updateState: {},
      githubToken: null,
      rateLimit: null,
      fileHashes: {},
      profiles: [],
      app: { releaseNotes: {} }
    }
  })
  /** Respostas da API do GitHub (grandes) em arquivo próprio: as outras escritas não precisam regravá-las. */
  private readonly http = new Store<{ entries: Record<string, HttpCacheEntry> }>({
    name: 'http-cache',
    cache: true,
    defaults: { entries: {} }
  })

  // Configurações -----------------------------------------------------------

  getSettings(): Settings {
    return { ...DEFAULT_SETTINGS, ...this.store.get('settings') }
  }

  setSettings(patch: Partial<Settings>): Settings {
    const next = { ...this.getSettings(), ...patch }
    this.store.set('settings', next)
    return next
  }

  settingsView(): SettingsView {
    return { ...this.getSettings(), hasGithubToken: !!this.getGithubToken() }
  }

  /** Nome salvo pelas versões sem perfis; sai das configurações ao ser lido (vira o primeiro perfil uma vez só). */
  takeLegacyUserName(): string {
    const { userName, ...settings } = this.store.get('settings') as Settings & { userName?: unknown }
    if (userName === undefined) return ''
    this.store.set('settings', settings)
    return typeof userName === 'string' ? userName : ''
  }

  // Perfis ------------------------------------------------------------------

  getProfiles(): readonly StoredProfile[] {
    return this.store.get('profiles')
  }

  setProfiles(profiles: StoredProfile[]): void {
    this.store.set('profiles', profiles)
  }

  getGithubToken(): string | null {
    const stored = this.store.get('githubToken')
    if (!stored?.value) return null
    if (!stored.encrypted) return stored.value
    try {
      return safeStorage.decryptString(Buffer.from(stored.value, 'base64'))
    } catch {
      return null
    }
  }

  /** O token é cifrado com o cofre do sistema quando disponível (DPAPI no Windows). */
  setGithubToken(token: string | null): void {
    const clean = token?.trim()
    if (!clean) {
      this.store.set('githubToken', null)
      return
    }
    if (safeStorage.isEncryptionAvailable()) {
      this.store.set('githubToken', { encrypted: true, value: safeStorage.encryptString(clean).toString('base64') })
    } else {
      this.store.set('githubToken', { encrypted: false, value: clean })
    }
  }

  // Biblioteca --------------------------------------------------------------

  getEntries(): GameEntry[] {
    return this.store.get('library')
  }

  getEntry(id: string): GameEntry | undefined {
    return this.getEntries().find((e) => e.id === id)
  }

  saveEntry(entry: GameEntry): void {
    const list = [...this.getEntries()]
    const index = list.findIndex((e) => e.id === entry.id)
    if (index >= 0) list[index] = entry
    else list.push(entry)
    this.store.set('library', list)
  }

  removeEntry(id: string): void {
    this.store.set(
      'library',
      this.getEntries().filter((e) => e.id !== id)
    )
    const states = { ...this.store.get('updateState') }
    delete states[id]
    this.store.set('updateState', states)
  }

  // Estado de atualização dos jogos ----------------------------------------

  getUpdateState(entryId: string): GameUpdateState {
    return this.store.get('updateState')[entryId] ?? { available: false }
  }

  setUpdateState(entryId: string, state: GameUpdateState): void {
    this.store.set(`updateState.${entryId}`, state)
  }

  // Cache HTTP (ETag) -------------------------------------------------------

  httpCache() {
    return {
      get: (url: string) => this.http.get('entries')[url],
      set: (url: string, entry: HttpCacheEntry) => {
        const cache = { ...this.http.get('entries'), [url]: entry }
        const keys = Object.keys(cache).sort((a, b) => cache[a].savedAt.localeCompare(cache[b].savedAt))
        while (keys.length > HTTP_CACHE_LIMIT) delete cache[keys.shift()!]
        this.http.set('entries', cache)
      }
    }
  }

  // SHA-1 de arquivos do usuário -----------------------------------------------

  fileHashCache() {
    return {
      get: (key: string) => this.store.get('fileHashes')[key],
      set: (key: string, hash: string) => {
        // Chaves novas entram no fim: as mais antigas saem primeiro.
        const hashes = { ...this.store.get('fileHashes'), [key]: hash }
        for (const old of Object.keys(hashes).slice(0, -FILE_HASH_LIMIT)) delete hashes[old]
        this.store.set('fileHashes', hashes)
      }
    }
  }

  getRateLimit(): RateLimitInfo | null {
    return this.store.get('rateLimit')
  }

  setRateLimit(info: RateLimitInfo): void {
    this.store.set('rateLimit', info)
  }

  // Devlog ------------------------------------------------------------------

  getLastSeenVersion(): string | undefined {
    return this.store.get('app').lastSeenVersion
  }

  setLastSeenVersion(version: string): void {
    this.store.set('app.lastSeenVersion', version)
  }

  getReleaseNotes(version: string): { notes: string; date: string | null } | undefined {
    return this.store.get('app').releaseNotes?.[version]
  }

  setReleaseNotes(version: string, notes: string, date: string | null): void {
    const all = { ...(this.store.get('app').releaseNotes ?? {}), [version]: { notes, date } }
    this.store.set('app.releaseNotes', all)
  }
}
