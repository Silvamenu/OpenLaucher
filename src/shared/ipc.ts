import type {
  AppInfo,
  ArtKind,
  AppUpdateState,
  ConfigBackup,
  ConfigFileView,
  DetectionCandidate,
  DevlogView,
  LibraryItem,
  ManifestsReport,
  NewProfile,
  ProfilePatch,
  ProfilesState,
  RateLimitInfo,
  ReleaseInfo,
  RepoInspection,
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
  'manifests:changed': ManifestsReport
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
    /** Escolhe a imagem no diálogo do processo principal (sem mudança se cancelar). */
    pickArt(entryId: string, kind: ArtKind): Promise<LibraryItem>
    clearArt(entryId: string, kind: ArtKind): Promise<LibraryItem>
    /** Escolhe a pasta, cadastra o jogo e baixa a versão mais recente em segundo plano (null se cancelar o diálogo). */
    install(manifestId: string): Promise<LibraryItem | null>
    /** Jogo via emulador: escolhe o arquivo do jogo do usuário e cadastra (null se cancelar). */
    addRunnerGame(manifestId: string): Promise<LibraryItem | null>
    /** Último release de um repositório do GitHub informado pelo usuário e o que dá para instalar dele. */
    inspectRepo(url: string): Promise<RepoInspection>
    /** Instala o arquivo escolhido do último release do repositório (null se cancelar o diálogo da pasta). */
    installFromRepo(url: string, assetName: string): Promise<LibraryItem | null>
    /** Escolhe o executável de um projeto adicionado pelo link. */
    pickExecutable(entryId: string): Promise<RequirementsReport>
    /** Tira do catálogo um projeto adicionado pelo link (sem jogo na biblioteca). */
    removeCustomManifest(manifestId: string): Promise<void>
  }
  profiles: {
    state(): Promise<ProfilesState>
    create(profile: NewProfile): Promise<ProfilesState>
    enter(profileId: string, pin?: string): Promise<ProfilesState>
    leave(): Promise<ProfilesState>
    /** Só o perfil em uso pode ser alterado. */
    update(profileId: string, patch: ProfilePatch): Promise<ProfilesState>
    remove(profileId: string): Promise<ProfilesState>
    /** Lê um arquivo .relaunch (null se cancelar o diálogo). */
    import(): Promise<ProfilesState | null>
    /** Salva o perfil em uso num arquivo .relaunch (false se cancelar o diálogo). */
    export(): Promise<boolean>
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
