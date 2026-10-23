import { createHash } from 'node:crypto'
import { createReadStream, promises as fs, type Dirent } from 'node:fs'
import path from 'node:path'
import picomatch from 'picomatch'
import { toPosix } from '../shared/patterns'

export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

export async function isDirectory(p: string): Promise<boolean> {
  try {
    return (await fs.stat(p)).isDirectory()
  } catch {
    return false
  }
}

export async function isFile(p: string): Promise<boolean> {
  try {
    return (await fs.stat(p)).isFile()
  } catch {
    return false
  }
}

export interface WalkedFile {
  /** Caminho relativo com "/" */
  rel: string
  abs: string
}

/** Lista arquivos recursivamente (sem seguir links simbólicos). */
export async function walkFiles(root: string, maxDepth = Infinity): Promise<WalkedFile[]> {
  const out: WalkedFile[] = []
  const visit = async (dir: string, depth: number) => {
    let entries: Dirent[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name)
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) {
        if (depth < maxDepth) await visit(abs, depth + 1)
      } else if (entry.isFile()) {
        out.push({ rel: toPosix(path.relative(root, abs)), abs })
      }
    }
  }
  await visit(root, 0)
  return out
}

/**
 * Filtra arquivos já listados pelos padrões (relativos à raiz; sem diferenciar maiúsculas).
 * Padrões sem "/" só casam com arquivos da raiz. Retorna na ordem dos padrões.
 */
export function matchWalked(files: WalkedFile[], patterns: string[]): string[] {
  const found: string[] = []
  for (const pattern of patterns) {
    const posix = toPosix(pattern)
    const isMatch = picomatch(posix, { nocase: true, dot: true })
    const rootOnly = !posix.includes('/')
    for (const file of files) {
      if (rootOnly && file.rel.includes('/')) continue
      if (isMatch(file.rel) && !found.includes(file.rel)) found.push(file.rel)
    }
  }
  return found
}

export async function hashFile(file: string, algorithm: 'sha1' | 'sha256'): Promise<string> {
  const hash = createHash(algorithm)
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(file)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve())
  })
  return hash.digest('hex')
}

/**
 * Lê um arquivo pequeno, recusando (null) se passar de `maxBytes`. Abre uma vez só e lê no máximo
 * maxBytes + 1: não há corrida entre conferir o tamanho e ler, nem arquivo enorme na memória.
 */
export async function readSmallFile(file: string, maxBytes: number): Promise<Buffer | null> {
  const handle = await fs.open(file, 'r')
  try {
    const buffer = Buffer.alloc(maxBytes + 1)
    let size = 0
    for (;;) {
      const { bytesRead } = await handle.read(buffer, size, buffer.length - size, size)
      if (bytesRead === 0) break
      size += bytesRead
      if (size > maxBytes) return null
    }
    return buffer.subarray(0, size)
  } finally {
    await handle.close()
  }
}

export async function readSmallTextFile(file: string, maxBytes: number): Promise<string | null> {
  return (await readSmallFile(file, maxBytes))?.toString('utf8') ?? null
}

/** Extensão de uma imagem PNG, JPEG, GIF ou WebP pelo conteúdo (assinatura), não pelo nome do arquivo. */
export function imageExtension(data: Buffer): '.png' | '.jpg' | '.gif' | '.webp' | null {
  const ascii = (start: number, end: number) => data.subarray(start, end).toString('latin1')
  if (ascii(0, 8) === '\x89PNG\r\n\x1a\n') return '.png'
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return '.jpg'
  if (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a') return '.gif'
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return '.webp'
  return null
}

/** Escrita atômica: grava em arquivo temporário e renomeia. */
export async function writeFileAtomic(file: string, content: string | Buffer): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(tmp, content)
  try {
    await fs.rename(tmp, file)
  } catch (err) {
    await fs.rm(tmp, { force: true })
    throw err
  }
}

/** Garante que `child` está dentro de `parent` (proteção contra "zip slip"). */
export function isInside(parent: string, child: string): boolean {
  const rel = path.relative(path.resolve(parent), path.resolve(child))
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
}

/** `child` é a própria pasta `parent` ou fica dentro dela. */
export function isSameOrInside(parent: string, child: string): boolean {
  return path.resolve(parent) === path.resolve(child) || isInside(parent, child)
}

export function sanitizeFileName(name: string): string {
  return (
    name
      // caracteres de controle também são inválidos em nomes de arquivo
      // eslint-disable-next-line no-control-regex
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
      .replace(/^\.+/, '_')
      .slice(0, 120) || 'arquivo'
  )
}
