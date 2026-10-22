import { spawn } from 'node:child_process'
import { constants as fsConstants, createReadStream, createWriteStream, promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { path7za } from '7zip-bin'
import * as tar from 'tar'
import yauzl from 'yauzl'
import yazl from 'yazl'
import { AppError } from '../shared/errors'
import { toPosix } from '../shared/patterns'
import { isInside, walkFiles } from './fsutil'

export type ArchiveKind = 'zip' | '7z' | 'tar' | 'raw'

const RAW_EXTENSIONS = ['.exe', '.appimage', '.dmg', '.bin', '.x86_64']

export function archiveKindOf(fileName: string): ArchiveKind | null {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.zip')) return 'zip'
  if (lower.endsWith('.7z')) return '7z'
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz') || lower.endsWith('.tar') || lower.endsWith('.tar.bz2')) return 'tar'
  if (RAW_EXTENSIONS.some((ext) => lower.endsWith(ext))) return 'raw'
  return null
}

// ---------------------------------------------------------------------------
// ZIP
// ---------------------------------------------------------------------------

function openZip(file: string): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(file, { lazyEntries: true, autoClose: true }, (err, zip) => (err || !zip ? reject(err) : resolve(zip)))
  })
}

function openEntryStream(zip: yauzl.ZipFile, entry: yauzl.Entry): Promise<NodeJS.ReadableStream> {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (err, stream) => (err || !stream ? reject(err) : resolve(stream)))
  })
}

export interface ExtractOptions {
  /** Retorne false para pular uma entrada (caminho relativo com "/"). */
  filter?: (rel: string) => boolean
  signal?: AbortSignal
  onEntry?: (rel: string) => void
}

/** Extrai um zip com proteção contra caminhos fora do destino. Retorna os arquivos extraídos. */
export async function extractZip(file: string, dest: string, options: ExtractOptions = {}): Promise<string[]> {
  await fs.mkdir(dest, { recursive: true })
  const zip = await openZip(file)
  const written: string[] = []
  await new Promise<void>((resolve, reject) => {
    const fail = (err: unknown) => {
      zip.close()
      reject(err)
    }
    zip.on('error', fail)
    zip.on('end', () => resolve())
    zip.on('entry', async (entry: yauzl.Entry) => {
      try {
        if (options.signal?.aborted) throw new AppError('CANCELLED')
        const rel = toPosix(entry.fileName)
        const target = path.join(dest, rel)
        if (!isInside(dest, target)) throw new AppError('EXTRACT_FAILED', `Entrada insegura no arquivo: ${entry.fileName}`)
        if (rel.endsWith('/')) {
          await fs.mkdir(target, { recursive: true })
        } else if (!options.filter || options.filter(rel)) {
          await fs.mkdir(path.dirname(target), { recursive: true })
          const stream = await openEntryStream(zip, entry)
          await pipeline(stream, createWriteStream(target))
          // Mantém o bit de execução de arquivos criados em Unix (ex.: AppImage).
          const mode = (entry.externalFileAttributes >>> 16) & 0o777
          if (mode && process.platform !== 'win32') await fs.chmod(target, mode | 0o600)
          written.push(rel)
          options.onEntry?.(rel)
        }
        zip.readEntry()
      } catch (err) {
        fail(err)
      }
    })
    zip.readEntry()
  })
  return written
}

export async function listZip(file: string): Promise<string[]> {
  const zip = await openZip(file)
  const names: string[] = []
  await new Promise<void>((resolve, reject) => {
    zip.on('error', reject)
    zip.on('end', () => resolve())
    zip.on('entry', (entry: yauzl.Entry) => {
      if (!entry.fileName.endsWith('/')) names.push(toPosix(entry.fileName))
      zip.readEntry()
    })
    zip.readEntry()
  })
  return names
}

export interface CreateZipOptions {
  onProgress?: (doneBytes: number, totalBytes: number) => void
  signal?: AbortSignal
  /** Arquivos (relativos) a ignorar. */
  exclude?: (rel: string) => boolean
}

/** Compacta uma pasta inteira em `outFile` (compressão rápida). Retorna o número de arquivos. */
export async function createZipFromDir(srcDir: string, outFile: string, options: CreateZipOptions = {}): Promise<number> {
  const files = (await walkFiles(srcDir)).filter((f) => !options.exclude?.(f.rel))
  const total = files.reduce((sum, f) => sum + f.size, 0)
  await fs.mkdir(path.dirname(outFile), { recursive: true })
  const zip = new yazl.ZipFile()
  const out = createWriteStream(outFile)
  const done = pipeline(zip.outputStream, out)
  let processed = 0
  for (const file of files) {
    if (options.signal?.aborted) {
      zip.end()
      await done.catch(() => undefined)
      throw new AppError('CANCELLED')
    }
    const stat = await fs.stat(file.abs)
    // Abre cada arquivo só quando chegar a vez dele (evita EMFILE em pastas grandes).
    zip.addReadStreamLazy(file.rel, { mtime: stat.mtime, mode: stat.mode, compressionLevel: 1 }, (cb) => {
      const readStream = createReadStream(file.abs)
      readStream.on('end', () => {
        processed += file.size
        options.onProgress?.(processed, total)
      })
      cb(null, readStream)
    })
  }
  zip.end()
  await done
  return files.length
}

// ---------------------------------------------------------------------------
// TAR / 7Z
// ---------------------------------------------------------------------------

async function extractTar(file: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true })
  // node-tar já remove caminhos absolutos e "..".
  await tar.x({ file, cwd: dest, preservePaths: false })
}

export function sevenZipPath(): string {
  // No app empacotado o binário fica fora do .asar (asarUnpack).
  return path7za.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`)
}

/**
 * No Linux o 7za embutido pode vir sem bit de execução e, dentro de um AppImage,
 * a pasta é somente leitura: nesse caso usamos uma cópia executável na pasta temporária.
 */
async function executable7z(): Promise<string> {
  const bin = sevenZipPath()
  if (process.platform === 'win32') return bin
  try {
    await fs.access(bin, fsConstants.X_OK)
    return bin
  } catch {
    // segue para as alternativas
  }
  try {
    await fs.chmod(bin, 0o755)
    return bin
  } catch {
    const copy = path.join(os.tmpdir(), `recomphub-7za-${process.getuid?.() ?? 0}`)
    await fs.copyFile(bin, copy)
    await fs.chmod(copy, 0o755)
    return copy
  }
}

async function extract7z(file: string, dest: string, signal?: AbortSignal): Promise<void> {
  await fs.mkdir(dest, { recursive: true })
  const bin = await executable7z()
  await new Promise<void>((resolve, reject) => {
    const child = spawn(bin, ['x', '-y', '-bd', `-o${dest}`, file], { stdio: ['ignore', 'ignore', 'pipe'], signal })
    let stderr = ''
    child.stderr?.on('data', (d) => (stderr += String(d)))
    child.on('error', reject)
    child.on('close', (code) => (code === 0 ? resolve() : reject(new AppError('EXTRACT_FAILED', stderr.trim() || `7za saiu com código ${code}`))))
  })
}

export interface ExtractPackageOptions {
  signal?: AbortSignal
  /** Nome final quando o asset não é um arquivo compactado (ex.: "SoH-Codename.appimage" → "soh.appimage"). */
  rawTargetName?: string
}

async function extractOne(file: string, dest: string, options: ExtractPackageOptions): Promise<void> {
  const kind = archiveKindOf(path.basename(file))
  switch (kind) {
    case 'zip':
      await extractZip(file, dest, { signal: options.signal })
      return
    case 'tar':
      await extractTar(file, dest)
      return
    case '7z':
      await extract7z(file, dest, options.signal)
      return
    case 'raw': {
      await fs.mkdir(dest, { recursive: true })
      const target = path.join(dest, options.rawTargetName ?? path.basename(file))
      await fs.copyFile(file, target)
      if (process.platform !== 'win32') await fs.chmod(target, 0o755)
      return
    }
    default:
      throw new AppError('UNSUPPORTED_ARCHIVE', `Formato não suportado: ${path.basename(file)}`, { file: path.basename(file) })
  }
}

/**
 * Extrai o pacote baixado em `dest` e devolve a pasta que representa a raiz do jogo:
 * - se o pacote tiver uma única pasta na raiz, ela é usada (zip com pasta raiz única);
 * - se contiver apenas outro arquivo compactado (ex.: zip com um .tar.gz dentro), ele também é extraído.
 */
export async function extractPackage(file: string, dest: string, options: ExtractPackageOptions = {}): Promise<string> {
  try {
    await extractOne(file, dest, options)
    let root = await singleRoot(dest)
    for (let depth = 0; depth < 2; depth++) {
      const entries = (await fs.readdir(root, { withFileTypes: true })).filter((e) => !/^readme(\.\w+)?$/i.test(e.name))
      const nested = entries.length === 1 && entries[0].isFile() ? entries[0].name : null
      const kind = nested ? archiveKindOf(nested) : null
      if (!nested || !kind || kind === 'raw') break
      const nestedDest = path.join(dest, `__nested${depth}`)
      await extractOne(path.join(root, nested), nestedDest, options)
      root = await singleRoot(nestedDest)
    }
    return root
  } catch (err) {
    if (err instanceof AppError) throw err
    throw new AppError('EXTRACT_FAILED', (err as Error).message)
  }
}

/** Desce enquanto a pasta tiver exatamente um item e ele for uma pasta. */
export async function singleRoot(dir: string): Promise<string> {
  let current = dir
  for (let i = 0; i < 3; i++) {
    const entries = (await fs.readdir(current, { withFileTypes: true })).filter((e) => e.name !== '__MACOSX')
    if (entries.length === 1 && entries[0].isDirectory()) current = path.join(current, entries[0].name)
    else break
  }
  return current
}
