import { safeStorage } from 'electron'
import Store from 'electron-store'
import type { HttpCacheEntry } from './github'
import { STORE_NAME } from './legacyData'
import type { GameEntry, GameUpdateState, RateLimitInfo, Settings, SettingsView } from '../shared/types'

interface StoredToken {
  encrypted: boolean
  value: string
}

interface Schema {
  settings: Settings
  library: GameEntry[]
  updateState: Record<string, GameUpdateState>
  httpCache: Record<string, HttpCacheEntry>
  githubToken: StoredToken | null
  rateLimit: RateLimitInfo | null
  app: {
    lastSeenVersion?: string
    releaseNotes: Record<string, { notes: string; date: string | null }>
  }
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  language: 'pt-BR',
  userName: '',
  notifications: true,
  checkGameUpdates: true
}

const HTTP_CACHE_LIMIT = 60

/** Persistência local em JSON (electron-store) com acesso tipado. */
export class AppStore {
  private readonly store: Store<Schema>

  constructor() {
    this.store = new Store<Schema>({
      name: STORE_NAME,
      defaults: {
        settings: DEFAULT_SETTINGS,
        library: [],
        updateState: {},
        httpCache: {},
        githubToken: null,
        rateLimit: null,
        app: { releaseNotes: {} }
      }
    })
  }

  get path(): string {
    return this.store.path
  }

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
    const list = this.getEntries()
    const index = list.findIndex((e) => e.id === entry.id)
    if (index >= 0) list[index] = entry
    else list.push(entry)
    this.store.set('library', list)
  }

  patchEntry(id: string, patch: Partial<GameEntry>): GameEntry | undefined {
    const entry = this.getEntry(id)
    if (!entry) return undefined
    const next = { ...entry, ...patch }
    this.saveEntry(next)
    return next
  }

  removeEntry(id: string): void {
    this.store.set(
      'library',
      this.getEntries().filter((e) => e.id !== id)
    )
    const states = this.store.get('updateState')
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
      get: (url: string) => this.store.get('httpCache')[url],
      set: (url: string, entry: HttpCacheEntry) => {
        const cache = { ...this.store.get('httpCache'), [url]: entry }
        const keys = Object.keys(cache).sort((a, b) => cache[a].savedAt.localeCompare(cache[b].savedAt))
        while (keys.length > HTTP_CACHE_LIMIT) delete cache[keys.shift()!]
        this.store.set('httpCache', cache)
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
