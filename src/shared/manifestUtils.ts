import type { ConfigFileSpec, GithubUpdates, Manifest, Platform } from './manifest'

/**
 * Leitura de campos de um manifesto já validado. Fica fora de manifest.ts para a interface
 * não carregar o zod (o validador), que ela não usa.
 */

export function executablesFor(manifest: Manifest, platform: Platform): string[] {
  return manifest.executables[platform] ?? []
}

export function launchArgsFor(manifest: Manifest, platform: Platform): string[] {
  const args = manifest.launchArgs
  if (Array.isArray(args)) return args
  return args[platform] ?? []
}

export function launchEnvFor(manifest: Manifest, platform: Platform): Record<string, string> {
  return manifest.launchEnv[platform] ?? {}
}

/** Caminhos candidatos de um arquivo de config para a plataforma. */
export function configPathCandidates(spec: ConfigFileSpec, platform: Platform): string[] {
  const value = typeof spec.path === 'string' || Array.isArray(spec.path) ? spec.path : spec.path[platform]
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

export function assetPatternsFor(updates: GithubUpdates, platform: Platform): string[] {
  const value = updates.assetPatterns[platform]
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

/** O projeto publica binários para a plataforma (pode ser baixado e instalado pelo app). */
export function installableOn(manifest: Manifest, platform: Platform): boolean {
  return manifest.updates.source === 'github-releases' && assetPatternsFor(manifest.updates, platform).length > 0
}

export function todosOf(value: { _todo?: string | string[] } | undefined): string[] {
  if (!value?._todo) return []
  return Array.isArray(value._todo) ? value._todo : [value._todo]
}

/** Junta todas as pendências "_todo" do manifesto (raiz, requisitos, configs e updates). */
export function collectTodos(manifest: Manifest): string[] {
  return [
    ...todosOf(manifest),
    ...manifest.requirements.flatMap((r) => todosOf(r)),
    ...manifest.configFiles.flatMap((c) => todosOf(c)),
    ...todosOf(manifest.updates)
  ]
}
