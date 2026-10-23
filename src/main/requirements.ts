import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { Manifest, Platform, UserFileRequirement } from '../shared/manifest'
import { executablesFor } from '../shared/manifestUtils'
import type { GameEntry, GameStatus, RequirementStatus, RequirementsReport } from '../shared/types'
import { hashFile, isDirectory, matchWalked, pathExists, walkFiles, type WalkedFile } from './fsutil'
import { hasPathVariables, resolvePathTemplate } from './pathVars'

/** Onde guardar os SHA-1 já calculados (chave: caminho|tamanho|data de modificação). */
export interface HashCache {
  get(key: string): string | undefined
  set(key: string, hash: string): unknown
}

let hashCache: HashCache = new Map<string, string>()

/** O app usa um cache persistente: sem ele, cada abertura relê todas as ROMs para conferir o SHA-1. */
export function setHashCache(cache: HashCache): void {
  hashCache = cache
}

async function sha1Cached(file: string): Promise<string> {
  const stat = await fs.stat(file)
  const key = `${file}|${stat.size}|${stat.mtimeMs}`
  const cached = hashCache.get(key)
  if (cached) return cached
  const hash = await hashFile(file, 'sha1')
  hashCache.set(key, hash)
  return hash
}

export interface UserFileCheck {
  ok: boolean
  detail: RequirementStatus['detail']
  matchedLabel?: string
}

/** Valida um arquivo do usuário (ex.: ROM) por tamanho e/ou SHA-1 informados no manifesto. */
export async function validateUserFile(file: string, req: UserFileRequirement): Promise<UserFileCheck> {
  let size: number
  try {
    const stat = await fs.stat(file)
    if (!stat.isFile()) return { ok: false, detail: 'missingFile' }
    size = stat.size
  } catch {
    return { ok: false, detail: 'missingFile' }
  }
  const sizes = req.validation?.sizes
  if (sizes && sizes.length > 0 && !sizes.includes(size)) return { ok: false, detail: 'sizeMismatch' }
  const hashes = req.validation?.sha1
  if (hashes && hashes.length > 0) {
    const actual = (await sha1Cached(file)).toLowerCase()
    for (const h of hashes) {
      const expected = typeof h === 'string' ? h : h.sha1
      if (expected.toLowerCase() === actual) {
        return { ok: true, detail: 'ok', matchedLabel: typeof h === 'string' ? undefined : h.label }
      }
    }
    return { ok: false, detail: 'hashMismatch' }
  }
  return { ok: true, detail: 'ok' }
}

/**
 * Executável da plataforma encontrado na pasta (relativo). Se o primeiro padrão que acha algo acha
 * vários (ex.: "jogo_*.exe" com o nome da versão), vale o mais recente: a atualização não apaga o antigo.
 */
export async function findExecutable(files: WalkedFile[], manifest: Manifest, platform: Platform): Promise<string | null> {
  for (const pattern of executablesFor(manifest, platform)) {
    const found = matchWalked(files, [pattern])
    if (found.length <= 1) {
      if (found[0]) return found[0]
      continue
    }
    const byRel = new Map(files.map((f) => [f.rel, f.abs]))
    const dated = await Promise.all(
      found.map(async (rel) => ({
        rel,
        mtime: await fs.stat(byRel.get(rel) ?? rel).then(
          (s) => s.mtimeMs,
          () => 0
        )
      }))
    )
    return dated.reduce((a, b) => (b.mtime > a.mtime ? b : a)).rel
  }
  return null
}

/**
 * Primeiro arquivo que satisfaz a lista: padrões relativos são procurados na pasta do jogo;
 * padrões com variáveis ({localAppData}/...) são caminhos absolutos verificados diretamente.
 */
async function firstMatch(files: WalkedFile[], patterns: string[], gameDir: string, platform: Platform): Promise<string | undefined> {
  for (const pattern of patterns) {
    if (hasPathVariables(pattern)) {
      const abs = resolvePathTemplate(pattern, { gameDir, platform })
      if (await pathExists(abs)) return abs
    } else {
      const found = matchWalked(files, [pattern])[0]
      if (found) return found
    }
  }
  return undefined
}

/** Emulador de um jogo que roda via "runner", como está na biblioteca. */
export interface RunnerState {
  manifestId: string
  name: string
  /** Entrada do emulador na biblioteca e o caminho absoluto do executável (null: não instalado). */
  entryId: string | null
  executable: string | null
  /** O emulador está sendo instalado ou atualizado agora. */
  installing?: boolean
}

/**
 * Verifica a pasta do jogo contra os requisitos do manifesto. Jogos via emulador trocam o
 * executável pelo emulador (`runner`): o "executable" do relatório é o do emulador, absoluto.
 */
export async function evaluateRequirements(manifest: Manifest, entry: GameEntry, platform: Platform, runner?: RunnerState): Promise<RequirementsReport> {
  const folderExists = await isDirectory(entry.path)
  const items: RequirementStatus[] = []
  // A pasta de um jogo via emulador é a do dump do usuário (pode ser enorme): só é listada se algum requisito precisar.
  const needsFiles = !manifest.runner || manifest.requirements.some((r) => r.type === 'file' || (r.type === 'firstRun' && !!r.doneWhen?.length))
  const files = folderExists && needsFiles ? await walkFiles(entry.path, 3) : []

  let exe: string | null
  if (manifest.runner) {
    exe = runner?.executable ?? null
    items.push({
      id: '__runner',
      type: 'runner',
      label: runner?.name ?? manifest.runner.manifest,
      optional: false,
      ok: exe !== null,
      // Sem executável: instalando agora, instalado mas com a pasta ou o executável faltando, ou não instalado.
      detail: exe ? 'ok' : runner?.installing ? 'runnerBusy' : runner?.entryId ? 'runnerBroken' : 'runnerMissing',
      found: exe ?? undefined,
      runnerId: manifest.runner.manifest,
      runnerEntryId: runner?.entryId ?? undefined
    })
  } else {
    exe = folderExists ? await findExecutable(files, manifest, platform) : null
    const exeNames = executablesFor(manifest, platform)
    items.push({
      id: '__executable',
      type: 'executable',
      label: exeNames.join(' / ') || '—',
      optional: false,
      ok: exe !== null,
      detail: exe ? 'ok' : 'notFound',
      found: exe ?? undefined,
      canPickExecutable: manifest.generated === true
    })
  }

  for (const req of manifest.requirements) {
    const base = { id: req.id, label: req.label, helpText: req.helpText, optional: req.optional }
    if (req.type === 'file') {
      const found = folderExists ? await firstMatch(files, req.patterns, entry.path, platform) : undefined
      items.push({ ...base, type: 'file', ok: !!found, detail: found ? 'ok' : 'notFound', found })
    } else if (req.type === 'userFile') {
      const selected = entry.userFiles[req.id]
      if (!selected) {
        items.push({ ...base, type: 'userFile', ok: false, detail: 'notSelected', canCopyToGameDir: false, extensions: req.extensions })
        continue
      }
      const check = await validateUserFile(selected, req)
      const inGameDir = path.resolve(path.dirname(selected)) === path.resolve(entry.path)
      items.push({
        ...base,
        type: 'userFile',
        ok: check.ok,
        detail: check.detail,
        matchedLabel: check.matchedLabel,
        found: selected,
        canCopyToGameDir: req.copyToGameDir && check.ok && folderExists && !inGameDir,
        extensions: req.extensions
      })
    } else {
      if (req.doneWhen && req.doneWhen.length > 0) {
        const found = folderExists ? await firstMatch(files, req.doneWhen, entry.path, platform) : undefined
        const marked = entry.firstRunDone[req.id] === true
        items.push({ ...base, type: 'firstRun', ok: !!found || marked, detail: found ? 'ok' : marked ? 'markedDone' : 'notDone', found })
      } else {
        const done = entry.firstRunDone[req.id] === true || entry.launchCount > 0
        items.push({ ...base, type: 'firstRun', ok: done, detail: done ? 'markedDone' : 'notDone' })
      }
    }
  }

  let status: GameStatus
  if (!folderExists) status = 'missingFolder'
  else if (items.every((i) => i.ok || i.optional)) status = 'ready'
  else status = 'needsSetup'

  return { entryId: entry.id, status, folderExists, executable: exe, items }
}
