import { z } from 'zod'

/**
 * Esquema dos manifestos de jogos (manifests/<id>.json).
 *
 * Chaves que começam com "_" (ex.: "_todo", "_comment") são aceitas em qualquer
 * nível e ignoradas pelo app — servem para documentar pendências no próprio manifesto.
 */

export const PLATFORMS = ['win32', 'linux', 'darwin'] as const
export type Platform = (typeof PLATFORMS)[number]

const todoSchema = z.union([z.string(), z.array(z.string())]).optional()

function perPlatform<T extends z.ZodType>(item: T) {
  return z.object({ win32: item.optional(), linux: item.optional(), darwin: item.optional() })
}

const nonEmpty = z.string().trim().min(1)
const stringList = z.array(nonEmpty)

/** Caminho relativo à pasta do jogo: sem raiz, letra de unidade ou segmentos "..". */
export function isSafeRelativePath(value: string): boolean {
  const posix = value.replace(/\\/g, '/')
  return !/^(\/|[A-Za-z]:)/.test(posix) && !posix.split('/').includes('..')
}
const relativePath = nonEmpty.refine(isSafeRelativePath, { message: 'use um caminho relativo à pasta do jogo, sem ".."' })
const relativePathList = z.array(relativePath)
const httpsUrl = z.url({ protocol: /^https$/ })

const hashSchema = z.union([
  z.string().regex(/^[0-9a-fA-F]{40}$/, 'SHA-1 deve ter 40 caracteres hexadecimais'),
  z.object({
    sha1: z.string().regex(/^[0-9a-fA-F]{40}$/, 'SHA-1 deve ter 40 caracteres hexadecimais'),
    label: z.string().optional()
  })
])

const baseRequirement = {
  id: z
    .string()
    .regex(/^[a-z0-9][a-z0-9_-]*$/i)
    .optional(),
  label: nonEmpty,
  helpText: z.string().optional(),
  optional: z.boolean().default(false),
  _todo: todoSchema
}

const fileRequirement = z.object({
  ...baseRequirement,
  type: z.literal('file'),
  /**
   * Caminhos/globs relativos à pasta do jogo (basta um existir). Também aceita caminhos
   * absolutos com variáveis, ex.: "{localAppData}/Jogo/arquivo.bin".
   */
  patterns: stringList.min(1)
})

const userFileRequirement = z.object({
  ...baseRequirement,
  type: z.literal('userFile'),
  /** Extensões aceitas no seletor de arquivos (sem ponto). */
  extensions: z.array(z.string()).default([]),
  validation: z
    .object({
      sizes: z.array(z.number().int().positive()).optional(),
      sha1: z.array(hashSchema).optional()
    })
    .optional(),
  /** Se verdadeiro, o app oferece copiar o arquivo do usuário para a pasta do jogo. */
  copyToGameDir: z.boolean().default(false)
})

const firstRunRequirement = z.object({
  ...baseRequirement,
  type: z.literal('firstRun'),
  /** Se informado, o requisito é cumprido quando algum destes arquivos existir. */
  doneWhen: stringList.optional()
})

export const requirementSchema = z.discriminatedUnion('type', [fileRequirement, userFileRequirement, firstRunRequirement])

const pathCandidates = z.union([nonEmpty, stringList.min(1)])

export const configFileSchema = z.object({
  /**
   * Caminho do arquivo. Relativo à pasta do jogo, ou com variáveis:
   * {gameDir}, {appData}, {localAppData}, {home}, {documents}.
   * Pode variar por plataforma e ser uma lista de candidatos (o primeiro que existir é usado).
   */
  path: z.union([pathCandidates, perPlatform(pathCandidates)]),
  format: z.enum(['json', 'ini', 'text']),
  label: z.string().optional(),
  editable: z.boolean().default(true),
  _todo: todoSchema
})

const githubUpdates = z.object({
  source: z.literal('github-releases'),
  repo: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, 'use o formato "dono/repositorio"'),
  assetPatterns: perPlatform(z.union([nonEmpty, stringList.min(1)])),
  includePrereleases: z.boolean().default(false),
  preserve: relativePathList.default([]),
  _todo: todoSchema
})

const noUpdates = z.object({
  source: z.literal('none'),
  _todo: todoSchema
})

export const manifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9_-]*$/, 'id deve conter apenas letras minúsculas, números, "-" e "_"'),
  name: nonEmpty,
  originalGame: z.string().optional(),
  description: z.string().optional(),
  repoUrl: httpsUrl,
  website: httpsUrl.optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  executables: perPlatform(relativePathList.min(1)),
  detectFiles: relativePathList.min(1),
  requirements: z.array(requirementSchema).default([]),
  configFiles: z.array(configFileSchema).default([]),
  launchArgs: z.union([z.array(z.string()), perPlatform(z.array(z.string()))]).default([]),
  /** Variáveis de ambiente extras ao iniciar (aceitam as mesmas variáveis de caminho, ex.: {gameDir}). */
  launchEnv: perPlatform(z.record(z.string(), z.string())).default({}),
  updates: z.discriminatedUnion('source', [githubUpdates, noUpdates]).default({ source: 'none' }),
  _todo: todoSchema
})

type ParsedManifest = z.output<typeof manifestSchema>
type ParsedRequirement = z.output<typeof requirementSchema>

/** Requisito com id garantido (gerado a partir da posição quando ausente). */
export type Requirement = ParsedRequirement & { id: string }
export type UserFileRequirement = Extract<Requirement, { type: 'userFile' }>
export type ConfigFileSpec = z.output<typeof configFileSchema>
export type GithubUpdates = z.output<typeof githubUpdates>

export interface Manifest extends Omit<ParsedManifest, 'requirements'> {
  requirements: Requirement[]
  /** De onde o manifesto foi carregado (embutido no app ou pasta do usuário). */
  origin?: 'builtin' | 'user'
}

export type ManifestParseResult = { ok: true; manifest: Manifest } | { ok: false; error: string }

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const where = issue.path.length ? issue.path.join('.') : '(raiz)'
      return `${where}: ${issue.message}`
    })
    .join('; ')
}

/** Valida e normaliza um manifesto já convertido de JSON. */
export function parseManifest(data: unknown): ManifestParseResult {
  const result = manifestSchema.safeParse(data)
  if (!result.success) {
    return { ok: false, error: formatIssues(result.error) }
  }
  const parsed = result.data
  const seen = new Set<string>()
  const requirements: Requirement[] = []
  for (const [index, req] of parsed.requirements.entries()) {
    const id = req.id ?? `${req.type}-${index + 1}`
    if (seen.has(id)) {
      return { ok: false, error: `requirements.${index}.id: id duplicado "${id}"` }
    }
    seen.add(id)
    requirements.push({ ...req, id })
  }
  if (!Object.values(parsed.executables).some((list) => list && list.length > 0)) {
    return { ok: false, error: 'executables: informe ao menos uma plataforma' }
  }
  return { ok: true, manifest: { ...parsed, requirements } }
}

/** Converte o texto de um arquivo .json em manifesto validado. */
export function parseManifestText(text: string): ManifestParseResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (err) {
    return { ok: false, error: `JSON inválido: ${(err as Error).message}` }
  }
  return parseManifest(data)
}

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
