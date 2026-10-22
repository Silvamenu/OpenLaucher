import type { Manifest, Platform } from './manifest'
import type { NoteSection } from './devlog'

export type { Manifest, Platform }

// ---------------------------------------------------------------------------
// Configurações do app
// ---------------------------------------------------------------------------

export type ThemeSetting = 'dark' | 'light' | 'system'
export type Language = 'pt-BR' | 'en'

export interface Settings {
  theme: ThemeSetting
  language: Language
  userName: string
  notifications: boolean
  checkGameUpdates: boolean
}

/** O token do GitHub nunca volta para a interface; ela só sabe se existe. */
export interface SettingsView extends Settings {
  hasGithubToken: boolean
}

export interface SettingsPatch extends Partial<Settings> {
  /** string vazia remove o token. */
  githubToken?: string
}

// ---------------------------------------------------------------------------
// Biblioteca
// ---------------------------------------------------------------------------

export interface GameEntry {
  id: string
  manifestId: string
  path: string
  customName?: string
  addedAt: string
  lastPlayedAt?: string
  totalPlayTimeSec: number
  launchCount: number
  /** Tag do release instalado; null quando desconhecida (jogo adicionado manualmente). */
  installedVersion: string | null
  installedPublishedAt?: string | null
  autoUpdate: boolean
  userFiles: Record<string, string>
  firstRunDone: Record<string, boolean>
  /** Capa personalizada (incrementa a cada troca, para invalidar o cache da imagem). */
  coverVersion?: number
}

export type GameStatus = 'ready' | 'needsSetup' | 'missingFolder' | 'unknownManifest'

export type RequirementDetail = 'ok' | 'notFound' | 'notSelected' | 'missingFile' | 'sizeMismatch' | 'hashMismatch' | 'notDone' | 'markedDone'

export interface RequirementStatus {
  id: string
  type: 'executable' | 'file' | 'userFile' | 'firstRun'
  label: string
  helpText?: string
  optional: boolean
  ok: boolean
  detail: RequirementDetail
  /** Arquivo encontrado/selecionado (relativo à pasta do jogo ou caminho absoluto do usuário). */
  found?: string
  /** Nome da versão reconhecida pelo hash (ex.: "NTSC 1.0"). */
  matchedLabel?: string
  canCopyToGameDir?: boolean
  extensions?: string[]
}

export interface RequirementsReport {
  entryId: string
  status: GameStatus
  folderExists: boolean
  executable: string | null
  items: RequirementStatus[]
}

export interface ReleaseAsset {
  name: string
  size: number
  url: string
  digest?: string | null
}

export interface ReleaseInfo {
  tag: string
  name: string
  body: string
  publishedAt: string | null
  prerelease: boolean
  htmlUrl: string
  assets: ReleaseAsset[]
}

export interface GameUpdateState {
  checkedAt?: string
  latest?: ReleaseInfo
  available: boolean
  /** Asset escolhido para a plataforma atual (null = nenhum casou). */
  assetName?: string | null
  error?: AppErrorShape
  notifiedTag?: string
}

export interface BackupInfo {
  file: string
  version: string
  createdAt: string
  size: number
}

export interface LibraryItem {
  entry: GameEntry
  manifest: Manifest | null
  name: string
  status: GameStatus
  running: boolean
  update: GameUpdateState
  backups: BackupInfo[]
  /** Uma atualização/rollback está em andamento para este jogo. */
  busy: boolean
}

export interface DetectionCandidate {
  manifestId: string
  name: string
  path: string
  score: number
  matched: string[]
}

// ---------------------------------------------------------------------------
// Editor de configs
// ---------------------------------------------------------------------------

export interface ConfigFileView {
  index: number
  label: string
  path: string
  format: 'json' | 'ini' | 'text'
  editable: boolean
  exists: boolean
  content: string
}

export interface ConfigBackup {
  name: string
  createdAt: string
  size: number
}

// ---------------------------------------------------------------------------
// Progresso de atualização de jogo
// ---------------------------------------------------------------------------

export type UpdateStage = 'checking' | 'downloading' | 'verifying' | 'backup' | 'extracting' | 'applying' | 'restoring' | 'done' | 'error' | 'cancelled'

export interface UpdateProgress {
  entryId: string
  kind: 'update' | 'rollback'
  stage: UpdateStage
  /** 0–1 quando conhecido. */
  progress?: number
  receivedBytes?: number
  totalBytes?: number
  version?: string
  error?: AppErrorShape
}

// ---------------------------------------------------------------------------
// Atualização do próprio launcher
// ---------------------------------------------------------------------------

export type AppUpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error' | 'disabled'

export interface AppUpdateState {
  status: AppUpdateStatus
  version?: string
  percent?: number
  error?: string
}

export interface DevlogView {
  version: string
  date: string | null
  sections: NoteSection[]
}

export interface AppInfo {
  version: string
  platform: Platform
  isPackaged: boolean
  userDataPath: string
  manifestsUserPath: string
}

export interface RateLimitInfo {
  limit: number
  remaining: number
  resetAt: string
  authenticated: boolean
}

export interface ManifestsReport {
  manifests: Manifest[]
  errors: { file: string; message: string }[]
}

// ---------------------------------------------------------------------------
// Erros
// ---------------------------------------------------------------------------

export type AppErrorCode =
  | 'FOLDER_NOT_FOUND'
  | 'EXE_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'GAME_RUNNING'
  | 'ALREADY_RUNNING'
  | 'NO_MATCHING_ASSET'
  | 'NO_RELEASE'
  | 'UPDATES_DISABLED'
  | 'DOWNLOAD_FAILED'
  | 'SIZE_MISMATCH'
  | 'CHECKSUM_MISMATCH'
  | 'UNTRUSTED_URL'
  | 'UNSUPPORTED_ARCHIVE'
  | 'EXTRACT_FAILED'
  | 'CANCELLED'
  | 'RATE_LIMITED'
  | 'NETWORK'
  | 'GITHUB_ERROR'
  | 'INVALID_CONFIG'
  | 'CONFIG_NOT_EDITABLE'
  | 'NO_BACKUP'
  | 'BUSY'
  | 'UPDATE_FAILED_RESTORED'
  | 'RESTORE_FAILED'
  | 'NOT_FOUND'
  | 'INVALID_FILE'
  | 'DISK_FULL'
  | 'UNKNOWN'

export interface AppErrorShape {
  code: AppErrorCode
  message: string
  params?: Record<string, string | number>
}

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: AppErrorShape }
