import { promises as fs } from 'node:fs'
import path from 'node:path'
import { validateConfigText } from '../shared/configForm'
import { AppError } from '../shared/errors'
import { configPathCandidates, type ConfigFileSpec, type Platform } from '../shared/manifest'
import type { ConfigBackup, ConfigFileView } from '../shared/types'
import { pathExists, sanitizeFileName, writeFileAtomic } from './fsutil'
import { resolvePathTemplate } from './pathVars'

export const CONFIG_BACKUPS_TO_KEEP = 10

/** Resolve o caminho real do arquivo: o primeiro candidato existente, ou o primeiro da lista. */
export async function resolveConfigPath(spec: ConfigFileSpec, gameDir: string, platform: Platform): Promise<string | null> {
  const candidates = configPathCandidates(spec, platform).map((c) => resolvePathTemplate(c, { gameDir, platform }))
  if (candidates.length === 0) return null
  for (const candidate of candidates) {
    if (await pathExists(candidate)) return candidate
  }
  return candidates[0]
}

export async function readConfigFile(spec: ConfigFileSpec, index: number, gameDir: string, platform: Platform): Promise<ConfigFileView | null> {
  const file = await resolveConfigPath(spec, gameDir, platform)
  if (!file) return null
  let content = ''
  let exists = false
  try {
    content = await fs.readFile(file, 'utf8')
    exists = true
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }
  return {
    index,
    label: spec.label ?? path.basename(file),
    path: file,
    format: spec.format,
    editable: spec.editable,
    exists,
    content
  }
}

function backupDirFor(backupsRoot: string, entryId: string, file: string): string {
  return path.join(backupsRoot, entryId, sanitizeFileName(path.basename(file)))
}

export async function listConfigBackups(backupsRoot: string, entryId: string, file: string): Promise<ConfigBackup[]> {
  const dir = backupDirFor(backupsRoot, entryId, file)
  const names = await fs.readdir(dir).catch(() => [] as string[])
  const out: ConfigBackup[] = []
  for (const name of names) {
    if (!name.endsWith('.bak')) continue
    const stat = await fs.stat(path.join(dir, name))
    out.push({ name, createdAt: stat.mtime.toISOString(), size: stat.size })
  }
  return out.sort((a, b) => b.name.localeCompare(a.name))
}

/** Copia o arquivo atual para a pasta de backups antes de qualquer alteração. */
export async function backupConfig(backupsRoot: string, entryId: string, file: string): Promise<string | null> {
  if (!(await pathExists(file))) return null
  const dir = backupDirFor(backupsRoot, entryId, file)
  await fs.mkdir(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const target = path.join(dir, `${stamp}.bak`)
  await fs.copyFile(file, target)
  const all = await listConfigBackups(backupsRoot, entryId, file)
  for (const old of all.slice(CONFIG_BACKUPS_TO_KEEP)) await fs.rm(path.join(dir, old.name), { force: true })
  return target
}

export async function saveConfigFile(opts: { spec: ConfigFileSpec; file: string; content: string; backupsRoot: string; entryId: string }): Promise<void> {
  if (!opts.spec.editable) throw new AppError('CONFIG_NOT_EDITABLE')
  const valid = validateConfigText(opts.spec.format, opts.content)
  if (!valid.ok) throw new AppError('INVALID_CONFIG', valid.message, { detail: valid.message })
  await backupConfig(opts.backupsRoot, opts.entryId, opts.file)
  await writeFileAtomic(opts.file, opts.content)
}

export async function restoreConfigBackup(backupsRoot: string, entryId: string, file: string, backupName: string): Promise<void> {
  if (!/^[\w-]+\.bak$/.test(backupName)) throw new AppError('NOT_FOUND', backupName)
  const source = path.join(backupDirFor(backupsRoot, entryId, file), backupName)
  if (!(await pathExists(source))) throw new AppError('NO_BACKUP')
  // O estado atual também vira backup, para o usuário poder desfazer a restauração.
  await backupConfig(backupsRoot, entryId, file)
  await writeFileAtomic(file, await fs.readFile(source))
}
