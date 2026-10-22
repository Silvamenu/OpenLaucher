import { createWriteStream, promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import yazl from 'yazl'

export async function tempDir(prefix = 'relaunch-test-'): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix))
}

/** Cria arquivos a partir de um mapa { "pasta/arquivo.txt": "conteúdo" }. */
export async function writeTree(root: string, tree: Record<string, string | Buffer>): Promise<void> {
  for (const [rel, content] of Object.entries(tree)) {
    const file = path.join(root, rel)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, content)
  }
}

export async function readTree(root: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  const visit = async (dir: string) => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name)
      if (entry.isDirectory()) await visit(abs)
      else out[path.relative(root, abs).split(path.sep).join('/')] = await fs.readFile(abs, 'utf8')
    }
  }
  await visit(root)
  return out
}

/** Gera um zip "falso" de release em memória/disco, como os publicados pelos ports. */
export async function makeZip(file: string, tree: Record<string, string | Buffer>): Promise<void> {
  const zip = new yazl.ZipFile()
  for (const [rel, content] of Object.entries(tree)) {
    zip.addBuffer(Buffer.isBuffer(content) ? content : Buffer.from(content), rel)
  }
  zip.end()
  await pipeline(zip.outputStream, createWriteStream(file))
}

export async function exists(p: string): Promise<boolean> {
  return fs.access(p).then(
    () => true,
    () => false
  )
}
