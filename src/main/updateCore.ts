import { createWriteStream, promises as fs } from 'node:fs'
import path from 'node:path'
import { AppError } from '../shared/errors'
import { assetPatternsFor, type GithubUpdates, type Platform } from '../shared/manifest'
import {
  checksumCandidates,
  createPreserveMatcher,
  isAllowedAssetUrl,
  isAllowedRedirectHost,
  parseChecksumFile,
  parseDigest,
  pickAsset,
  shouldSkipFile
} from '../shared/patterns'
import type { BackupInfo, ReleaseAsset, ReleaseInfo, UpdateStage } from '../shared/types'
import { archiveKindOf, createZipFromDir, ensureSafeTarget, extractPackage, extractZip, listZip } from './archive'
import { hashFile, isInside, isSameOrInside, pathExists, sanitizeFileName, walkFiles } from './fsutil'

export const USER_AGENT = 'Relaunch'
export const BACKUPS_TO_KEEP = 2
/** Versão gravada no backup quando a instalada não é conhecida. */
export const UNKNOWN_VERSION = 'desconhecida'

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

export interface DownloadOptions {
  url: string
  dest: string
  fetchImpl: typeof fetch
  expectedSize?: number
  signal?: AbortSignal
  onProgress?: (received: number, total: number) => void
}

export async function downloadFile(opts: DownloadOptions): Promise<void> {
  if (!opts.url.startsWith('https://')) throw new AppError('UNTRUSTED_URL', opts.url)
  let response: Response
  try {
    response = await opts.fetchImpl(opts.url, {
      redirect: 'follow',
      signal: opts.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/octet-stream' }
    })
  } catch (err) {
    if (opts.signal?.aborted) throw new AppError('CANCELLED')
    throw new AppError('NETWORK', (err as Error).message)
  }
  if (response.url && !isAllowedRedirectHost(response.url)) {
    throw new AppError('UNTRUSTED_URL', `Redirecionamento inesperado para ${new URL(response.url).host}`)
  }
  if (!response.ok || !response.body) {
    throw new AppError('DOWNLOAD_FAILED', `HTTP ${response.status}`, { status: response.status })
  }
  const total = Number(response.headers.get('content-length')) || opts.expectedSize || 0
  await fs.mkdir(path.dirname(opts.dest), { recursive: true })
  const out = createWriteStream(opts.dest)
  let received = 0
  let lastEmit = 0
  try {
    const reader = response.body.getReader()
    for (;;) {
      if (opts.signal?.aborted) throw new AppError('CANCELLED')
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      if (!out.write(value)) await new Promise<void>((resolve) => out.once('drain', () => resolve()))
      const now = Date.now()
      if (now - lastEmit > 150) {
        lastEmit = now
        opts.onProgress?.(received, total)
      }
    }
    opts.onProgress?.(received, total)
    await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())))
  } catch (err) {
    out.destroy()
    await fs.rm(opts.dest, { force: true })
    if (err instanceof AppError) throw err
    if (opts.signal?.aborted) throw new AppError('CANCELLED')
    throw new AppError('DOWNLOAD_FAILED', (err as Error).message)
  }
  if (opts.expectedSize && received !== opts.expectedSize) {
    throw new AppError('SIZE_MISMATCH', `Esperado ${opts.expectedSize} bytes, recebido ${received}`, {
      expected: opts.expectedSize,
      received
    })
  }
}

export async function verifySha256(file: string, expected: string): Promise<void> {
  const actual = await hashFile(file, 'sha256')
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new AppError('CHECKSUM_MISMATCH', `SHA-256 esperado ${expected}, obtido ${actual}`)
  }
}

/** Procura o SHA-256 do asset: campo `digest` da API ou arquivo de checksums no release. */
export async function resolveExpectedSha256(
  asset: ReleaseAsset,
  release: ReleaseInfo,
  repo: string,
  fetchImpl: typeof fetch,
  signal?: AbortSignal
): Promise<string | null> {
  const fromDigest = parseDigest(asset.digest)
  if (fromDigest) return fromDigest
  for (const candidate of checksumCandidates(release.assets, asset.name)) {
    if (!isAllowedAssetUrl(candidate.url, repo)) continue
    try {
      const res = await fetchImpl(candidate.url, { redirect: 'follow', signal, headers: { 'User-Agent': USER_AGENT } })
      if (!res.ok || (res.url && !isAllowedRedirectHost(res.url))) continue
      const hash = parseChecksumFile(await res.text(), asset.name)
      if (hash) return hash
    } catch {
      // Arquivo de checksum é opcional; segue sem ele.
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Backups
// ---------------------------------------------------------------------------

export interface BackupMeta {
  entryId: string
  manifestId: string
  version: string
  createdAt: string
  /** Arquivos que a atualização feita após este backup criou (para remover no rollback). */
  addedFiles: string[]
  /** Versão instalada pela atualização que gerou este backup. */
  updatedTo?: string
}

export interface StoredBackup {
  dir: string
  zip: string
  meta: BackupMeta
  size: number
}

const BACKUP_ZIP = 'backup.zip'
const BACKUP_META = 'meta.json'

export async function createBackup(opts: {
  gameDir: string
  backupsDir: string
  entryId: string
  manifestId: string
  version: string | null
  signal?: AbortSignal
  onProgress?: (done: number, total: number) => void
}): Promise<StoredBackup> {
  const version = opts.version ?? UNKNOWN_VERSION
  const base = path.join(opts.backupsDir, sanitizeFileName(version))
  let dir = base
  for (let i = 2; await pathExists(dir); i++) dir = `${base}-${i}`
  await fs.mkdir(dir, { recursive: true })
  const zip = path.join(dir, BACKUP_ZIP)
  try {
    await createZipFromDir(opts.gameDir, zip, { signal: opts.signal, onProgress: opts.onProgress })
  } catch (err) {
    await fs.rm(dir, { recursive: true, force: true })
    throw err
  }
  const meta: BackupMeta = {
    entryId: opts.entryId,
    manifestId: opts.manifestId,
    version,
    createdAt: new Date().toISOString(),
    addedFiles: []
  }
  const backup: StoredBackup = { dir, zip, meta, size: (await fs.stat(zip)).size }
  await writeBackupMeta(backup)
  return backup
}

export async function writeBackupMeta(backup: StoredBackup): Promise<void> {
  await fs.writeFile(path.join(backup.dir, BACKUP_META), JSON.stringify(backup.meta, null, 2))
}

/** Backups de um jogo, do mais recente para o mais antigo. */
export async function listBackups(backupsDir: string, entryId: string): Promise<StoredBackup[]> {
  const dirs = await fs.readdir(backupsDir, { withFileTypes: true }).catch(() => [])
  const out: StoredBackup[] = []
  for (const d of dirs) {
    if (!d.isDirectory()) continue
    const dir = path.join(backupsDir, d.name)
    try {
      const meta = JSON.parse(await fs.readFile(path.join(dir, BACKUP_META), 'utf8')) as BackupMeta
      if (meta.entryId !== entryId) continue
      const zip = path.join(dir, BACKUP_ZIP)
      const size = (await fs.stat(zip)).size
      out.push({ dir, zip, meta, size })
    } catch {
      // Backup incompleto/corrompido: ignorado.
    }
  }
  return out.sort((a, b) => b.meta.createdAt.localeCompare(a.meta.createdAt))
}

export async function pruneBackups(backupsDir: string, entryId: string, keep = BACKUPS_TO_KEEP): Promise<void> {
  const backups = await listBackups(backupsDir, entryId)
  for (const old of backups.slice(keep)) await fs.rm(old.dir, { recursive: true, force: true })
}

export function toBackupInfo(b: StoredBackup): BackupInfo {
  return { file: b.zip, version: b.meta.version, createdAt: b.meta.createdAt, size: b.size }
}

// ---------------------------------------------------------------------------
// Aplicação da atualização (com regra de preserve) e restauração
// ---------------------------------------------------------------------------

export interface ApplyJournal {
  added: string[]
  modified: string[]
  skipped: string[]
}

export function emptyJournal(): ApplyJournal {
  return { added: [], modified: [], skipped: [] }
}

export interface ApplyOptions {
  sourceDir: string
  gameDir: string
  preserve: string[]
  signal?: AbortSignal
  onProgress?: (done: number, total: number) => void
  /** Gancho para testes simularem falhas no meio da cópia. */
  beforeWrite?: (rel: string) => void | Promise<void>
}

/**
 * Copia os arquivos do pacote novo por cima da pasta do jogo, sem sobrescrever
 * nada que case com `preserve`. O `journal` é preenchido ANTES de cada escrita,
 * para que uma falha no meio possa ser desfeita.
 */
export async function applyUpdate(opts: ApplyOptions, journal: ApplyJournal): Promise<ApplyJournal> {
  const isPreserved = createPreserveMatcher(opts.preserve)
  const files = await walkFiles(opts.sourceDir)
  // Caminho real: links simbólicos/junções dentro da pasta do jogo não podem levar a escrita para fora dela.
  const realGame = await fs.realpath(opts.gameDir)
  let done = 0
  for (const file of files) {
    if (opts.signal?.aborted) throw new AppError('CANCELLED')
    const target = path.join(opts.gameDir, file.rel)
    if (!isInside(opts.gameDir, target)) throw new AppError('EXTRACT_FAILED', `Caminho inseguro: ${file.rel}`)
    const exists = (await fs.lstat(target).catch(() => null)) !== null
    if (shouldSkipFile(file.rel, exists, isPreserved)) {
      journal.skipped.push(file.rel)
    } else {
      await ensureSafeTarget(realGame, target, file.rel)
      ;(exists ? journal.modified : journal.added).push(file.rel)
      await opts.beforeWrite?.(file.rel)
      await fs.copyFile(file.abs, target)
      const mode = (await fs.stat(file.abs)).mode
      if (process.platform !== 'win32') await fs.chmod(target, mode & 0o777)
    }
    done++
    opts.onProgress?.(done, files.length)
  }
  return journal
}

/** Remove arquivos e, em seguida, as pastas que ficaram vazias por causa disso (sem sair de `gameDir`). */
async function removeFiles(gameDir: string, rels: string[]): Promise<void> {
  const dirs = new Set<string>()
  const realGame = await fs.realpath(gameDir)
  for (const rel of rels) {
    const file = path.join(gameDir, rel)
    if (!isInside(gameDir, file)) continue
    // Nunca apaga através de um link que aponte para fora da pasta do jogo.
    const realParent = await fs.realpath(path.dirname(file)).catch(() => null)
    if (!realParent || !isSameOrInside(realGame, realParent)) continue
    await fs.rm(file, { force: true })
    for (let dir = path.dirname(file); isInside(gameDir, dir); dir = path.dirname(dir)) dirs.add(dir)
  }
  // Das mais profundas para as mais rasas; rmdir falha (e é ignorado) se ainda houver conteúdo.
  for (const dir of [...dirs].sort((a, b) => b.length - a.length)) await fs.rmdir(dir).catch(() => undefined)
}

/** Desfaz uma aplicação parcial: remove arquivos novos e recupera os modificados do backup. */
export async function restoreFromJournal(gameDir: string, backupZip: string, journal: ApplyJournal): Promise<void> {
  await removeFiles(gameDir, journal.added)
  if (journal.modified.length > 0) {
    const wanted = new Set(journal.modified.map((r) => r.toLowerCase()))
    await extractZip(backupZip, gameDir, { filter: (rel) => wanted.has(rel.toLowerCase()) })
  }
}

/**
 * Volta para a versão do backup: restaura os arquivos do zip (sem sobrescrever
 * dados preservados que já existem, como saves) e remove os arquivos que a
 * atualização posterior adicionou.
 */
export async function rollbackFromBackup(gameDir: string, backup: StoredBackup, preserve: string[]): Promise<void> {
  const isPreserved = createPreserveMatcher(preserve)
  const entries = await listZip(backup.zip)
  const skip = new Set<string>()
  for (const rel of entries) {
    if (isPreserved(rel) && (await pathExists(path.join(gameDir, rel)))) skip.add(rel)
  }
  await extractZip(backup.zip, gameDir, { filter: (rel) => !skip.has(rel) })
  const inBackup = new Set(entries.map((e) => e.toLowerCase()))
  await removeFiles(
    gameDir,
    backup.meta.addedFiles.filter((rel) => !inBackup.has(rel.toLowerCase()) && !isPreserved(rel))
  )
}

// ---------------------------------------------------------------------------
// Fluxo completo
// ---------------------------------------------------------------------------

export interface UpdateFlowParams {
  entryId: string
  manifestId: string
  updates: GithubUpdates
  gameDir: string
  installedVersion: string | null
  release: ReleaseInfo
  platform: Platform
  /** Nome do executável usado quando o asset é um binário solto (ex.: AppImage). */
  rawTargetName?: string
}

export interface UpdateFlowDeps {
  fetchImpl: typeof fetch
  tmpRoot: string
  backupsDir: string
  isGameRunning: () => Promise<boolean>
  onStage: (stage: UpdateStage, progress?: { progress?: number; receivedBytes?: number; totalBytes?: number }) => void
  signal: AbortSignal
  /** Para testes: falhas simuladas durante a cópia. */
  beforeWrite?: (rel: string) => void | Promise<void>
}

export interface UpdateFlowResult {
  version: string
  publishedAt: string | null
  journal: ApplyJournal
  backup: StoredBackup
}

export async function runUpdateFlow(params: UpdateFlowParams, deps: UpdateFlowDeps): Promise<UpdateFlowResult> {
  const { release, updates } = params
  deps.onStage('checking')

  // 1. Asset da plataforma
  const asset = pickAsset(release.assets, assetPatternsFor(updates, params.platform))
  if (!asset) {
    throw new AppError('NO_MATCHING_ASSET', 'Nenhum arquivo do release corresponde a esta plataforma', {
      platform: params.platform,
      version: release.tag
    })
  }
  if (!isAllowedAssetUrl(asset.url, updates.repo)) throw new AppError('UNTRUSTED_URL', asset.url)
  if (!archiveKindOf(asset.name)) throw new AppError('UNSUPPORTED_ARCHIVE', asset.name, { file: asset.name })
  if (await deps.isGameRunning()) throw new AppError('GAME_RUNNING')

  const work = await fs.mkdtemp(path.join(deps.tmpRoot, `relaunch-${params.manifestId}-`))
  try {
    // 2. Download + validação
    const downloaded = path.join(work, sanitizeFileName(asset.name))
    deps.onStage('downloading', { progress: 0, receivedBytes: 0, totalBytes: asset.size })
    await downloadFile({
      url: asset.url,
      dest: downloaded,
      fetchImpl: deps.fetchImpl,
      expectedSize: asset.size,
      signal: deps.signal,
      onProgress: (received, total) =>
        deps.onStage('downloading', { progress: total ? received / total : undefined, receivedBytes: received, totalBytes: total })
    })
    deps.onStage('verifying')
    const sha256 = await resolveExpectedSha256(asset, release, updates.repo, deps.fetchImpl, deps.signal)
    if (sha256) await verifySha256(downloaded, sha256)

    // Extrai antes do backup: se o pacote estiver corrompido, nada é tocado.
    deps.onStage('extracting')
    const sourceDir = await extractPackage(downloaded, path.join(work, 'extracted'), {
      signal: deps.signal,
      rawTargetName: params.rawTargetName
    })

    if (deps.signal.aborted) throw new AppError('CANCELLED')
    if (await deps.isGameRunning()) throw new AppError('GAME_RUNNING')

    // 3. Backup
    deps.onStage('backup', { progress: 0 })
    const backup = await createBackup({
      gameDir: params.gameDir,
      backupsDir: deps.backupsDir,
      entryId: params.entryId,
      manifestId: params.manifestId,
      version: params.installedVersion,
      signal: deps.signal,
      onProgress: (done, total) => deps.onStage('backup', { progress: total ? done / total : undefined })
    })

    // 4. Cópia respeitando preserve; 6. restauração automática em caso de falha
    const journal = emptyJournal()
    try {
      deps.onStage('applying', { progress: 0 })
      await applyUpdate(
        {
          sourceDir,
          gameDir: params.gameDir,
          preserve: updates.preserve,
          signal: deps.signal,
          beforeWrite: deps.beforeWrite,
          onProgress: (done, total) => deps.onStage('applying', { progress: done / total })
        },
        journal
      )
      // Faz parte da transação: sem a lista de arquivos adicionados, o backup não desfaria esta versão.
      backup.meta.addedFiles = journal.added
      backup.meta.updatedTo = release.tag
      await writeBackupMeta(backup)
    } catch (err) {
      deps.onStage('restoring')
      try {
        await restoreFromJournal(params.gameDir, backup.zip, journal)
      } catch (restoreErr) {
        throw new AppError('RESTORE_FAILED', `${(err as Error).message} / ${(restoreErr as Error).message}`, { backup: backup.zip })
      }
      await fs.rm(backup.dir, { recursive: true, force: true })
      if (err instanceof AppError && err.code === 'CANCELLED') throw err
      throw new AppError('UPDATE_FAILED_RESTORED', (err as Error).message, {
        cause: err instanceof AppError ? err.code : ((err as NodeJS.ErrnoException).code ?? 'UNKNOWN')
      })
    }

    // Limpeza de backups antigos não é essencial: uma falha aqui (ex.: arquivo travado no Windows) não desfaz a atualização.
    await pruneBackups(deps.backupsDir, params.entryId).catch((err) => console.warn('[updates] limpeza de backups falhou', err))
    deps.onStage('done', { progress: 1 })
    return { version: release.tag, publishedAt: release.publishedAt, journal, backup }
  } finally {
    await fs.rm(work, { recursive: true, force: true }).catch(() => undefined)
  }
}
