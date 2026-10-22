import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { Manifest } from '../shared/manifest'
import type { DetectionCandidate } from '../shared/types'
import { isDirectory, matchWalked, walkFiles } from './fsutil'

async function scoreFolder(folder: string, manifests: Manifest[]): Promise<DetectionCandidate[]> {
  const files = await walkFiles(folder, 2)
  const out: DetectionCandidate[] = []
  for (const manifest of manifests) {
    const matched = manifest.detectFiles.filter((pattern) => matchWalked(files, [pattern]).length > 0)
    if (matched.length > 0) {
      out.push({
        manifestId: manifest.id,
        name: manifest.name,
        path: folder,
        score: matched.length / manifest.detectFiles.length,
        matched
      })
    }
  }
  return out
}

function rank(candidates: DetectionCandidate[]): DetectionCandidate[] {
  return candidates.sort((a, b) => b.score - a.score || b.matched.length - a.matched.length || a.name.localeCompare(b.name))
}

/**
 * Descobre qual projeto está instalado em `folder` comparando os `detectFiles` de cada manifesto.
 * Se nada for encontrado na pasta escolhida, procura também nas subpastas imediatas
 * (útil quando o usuário seleciona a pasta "pai" do jogo).
 */
export async function detectGame(folder: string, manifests: Manifest[]): Promise<DetectionCandidate[]> {
  if (!(await isDirectory(folder))) return []
  const direct = await scoreFolder(folder, manifests)
  if (direct.length > 0) return rank(direct)

  const children = await fs.readdir(folder, { withFileTypes: true }).catch(() => [])
  const nested: DetectionCandidate[] = []
  for (const child of children) {
    if (!child.isDirectory() || child.name.startsWith('.')) continue
    nested.push(...(await scoreFolder(path.join(folder, child.name), manifests)))
  }
  return rank(nested)
}
