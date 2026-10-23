import { promises as fs } from 'node:fs'
import path from 'node:path'
import { parseManifestText, type Manifest } from '../shared/manifest'
import type { ManifestsReport } from '../shared/types'
import { isGeneratedManifest } from './repoInstall'

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
      const manifest: Manifest = { ...result.manifest, origin: source.origin }
      manifest.generated = isGeneratedManifest(manifest)
      // Substituto de um embutido sem "category" (anterior às listas) continua na lista do original.
      const replaced = byId.get(manifest.id)
      if (manifest.category === 'custom' && replaced && !manifest.generated) manifest.category = replaced.category
      byId.set(manifest.id, manifest)
    }
  }
  // Jogos via emulador só valem se o emulador existir e for um programa (não outro jogo via emulador).
  for (const manifest of [...byId.values()]) {
    if (!manifest.runner) continue
    const runner = byId.get(manifest.runner.manifest)
    if (!runner || runner.runner) {
      byId.delete(manifest.id)
      errors.push({ file: manifest.id, message: `runner.manifest: emulador "${manifest.runner.manifest}" não encontrado` })
    }
  }
  const manifests = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
  return { manifests, errors }
}
