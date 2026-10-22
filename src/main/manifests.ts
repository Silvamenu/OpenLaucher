import { promises as fs } from 'node:fs'
import path from 'node:path'
import { parseManifestText, type Manifest } from '../shared/manifest'
import type { ManifestsReport } from '../shared/types'

export interface ManifestSource {
  dir: string
  origin: 'builtin' | 'user'
}

/**
 * Carrega manifests/*.json de cada origem. Manifestos do usuário com o mesmo id
 * substituem os embutidos (permite corrigir/estender sem mexer no app).
 */
export async function loadManifests(sources: ManifestSource[]): Promise<ManifestsReport> {
  const byId = new Map<string, Manifest>()
  const errors: ManifestsReport['errors'] = []
  for (const source of sources) {
    const files = await fs.readdir(source.dir).catch(() => [] as string[])
    for (const name of files.sort()) {
      if (!name.toLowerCase().endsWith('.json')) continue
      const file = path.join(source.dir, name)
      let text: string
      try {
        text = await fs.readFile(file, 'utf8')
      } catch (err) {
        errors.push({ file, message: (err as Error).message })
        continue
      }
      const result = parseManifestText(text)
      if (!result.ok) {
        errors.push({ file, message: result.error })
        continue
      }
      const expectedId = path.basename(name, path.extname(name))
      if (result.manifest.id !== expectedId) {
        errors.push({ file, message: `o id "${result.manifest.id}" deve ser igual ao nome do arquivo ("${expectedId}")` })
        continue
      }
      byId.set(result.manifest.id, { ...result.manifest, origin: source.origin })
    }
  }
  const manifests = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
  return { manifests, errors }
}
