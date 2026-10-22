import type {
  AppInfo,
  AppUpdateState,
  ConfigBackup,
  ConfigFileView,
  DetectionCandidate,
  DevlogView,
  LibraryItem,
  ManifestsReport,
  RateLimitInfo,
  ReleaseInfo,
  RequirementsReport,
  SettingsPatch,
  SettingsView,
  UpdateProgress
} from './types'

/** Protocolo interno que serve as capas escolhidas pelo usuário (main, interface e CSP). */
export const COVER_SCHEME = 'rl-cover'

/** Eventos enviados do processo principal para a interface. */
export interface ApiEvents {
  'library:changed': LibraryItem[]
  'game:progress': UpdateProgress
  'appUpdate:state': AppUpdateState
  'settings:changed': SettingsView
  'navigate:game': string
}

export type ApiEventName = keyof ApiEvents

export interface EntryPatch {
  customName?: string | null
  autoUpdate?: boolean
  installedVersion?: string | null
  installedPublishedAt?: string | null
}

/** API exposta em `window.api` pelo preload. Todos os métodos rejeitam com AppError. */
export interface RelaunchApi {
  app: {
    info(): Promise<AppInfo>
    openExternal(url: string): Promise<void>
    openPath(path: string): Promise<void>
  }
  manifests: {
    list(): Promise<ManifestsReport>
  }
  library: {
    list(): Promise<LibraryItem[]>
    rescan(): Promise<LibraryItem[]>
    pickFolder(): Promise<string | null>
    detect(folder: string): Promise<DetectionCandidate[]>
    add(folder: string, manifestId: string): Promise<LibraryItem>
    remove(entryId: string): Promise<void>
    update(entryId: string, patch: EntryPatch): Promise<LibraryItem>
    changeFolder(entryId: string): Promise<LibraryItem | null>
    requirements(entryId: string): Promise<RequirementsReport>
    pickUserFile(entryId: string, requirementId: string): Promise<RequirementsReport>
    copyUserFile(entryId: string, requirementId: string): Promise<RequirementsReport>
    setFirstRunDone(entryId: string, requirementId: string, done: boolean): Promise<RequirementsReport>
    openFolder(entryId: string): Promise<void>
    launch(entryId: string): Promise<void>
    icon(entryId: string): Promise<string | null>
    pickCover(entryId: string): Promise<LibraryItem>
    clearCover(entryId: string): Promise<LibraryItem>
  }
  configs: {
    list(entryId: string): Promise<ConfigFileView[]>
    save(entryId: string, index: number, content: string): Promise<ConfigFileView>
    backups(entryId: string, index: number): Promise<ConfigBackup[]>
    restore(entryId: string, index: number, backupName: string): Promise<ConfigFileView>
  }
  updates: {
    check(entryId?: string): Promise<LibraryItem[]>
    releases(entryId: string): Promise<ReleaseInfo[]>
    start(entryId: string): Promise<void>
    cancel(entryId: string): Promise<void>
    rollback(entryId: string): Promise<void>
    rateLimit(): Promise<RateLimitInfo | null>
  }
  settings: {
    get(): Promise<SettingsView>
    set(patch: SettingsPatch): Promise<SettingsView>
  }
  appUpdate: {
    state(): Promise<AppUpdateState>
    check(): Promise<AppUpdateState>
    install(): Promise<void>
  }
  devlog: {
    pending(): Promise<DevlogView | null>
    current(): Promise<DevlogView>
    markSeen(): Promise<void>
  }
  on<K extends ApiEventName>(event: K, listener: (payload: ApiEvents[K]) => void): () => void
}
