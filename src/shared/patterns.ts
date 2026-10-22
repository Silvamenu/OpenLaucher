import picomatch from 'picomatch'

/** Normaliza separadores para "/" e remove "./" inicial. */
export function toPosix(relPath: string): string {
  return relPath.replace(/\\/g, '/').replace(/^\.\/+/, '')
}

function compile(pattern: string): (input: string) => boolean {
  return picomatch(pattern, { nocase: true, dot: true })
}

/** Testa um nome de arquivo (sem diretório) contra uma lista de globs, sem diferenciar maiúsculas. */
export function matchesAnyName(name: string, patterns: string[]): boolean {
  return patterns.some((pattern) => compile(pattern)(name))
}

// ---------------------------------------------------------------------------
// Escolha do asset do release
// ---------------------------------------------------------------------------

export interface AssetLike {
  name: string
  size: number
}

const SIDE_FILE_RE = /\.(sha1|sha256|sha512|sha256sum|md5|sig|asc|minisig|blockmap|txt|json|yml|yaml)$/i

/**
 * Escolhe o asset do release que casa com os padrões da plataforma.
 * Os padrões são testados em ordem; o primeiro que casar com algum asset vence.
 * Arquivos auxiliares (checksums, assinaturas, metadados) são ignorados.
 */
export function pickAsset<T extends AssetLike>(assets: T[], patterns: string[]): T | null {
  const candidates = assets.filter((asset) => !SIDE_FILE_RE.test(asset.name))
  for (const pattern of patterns) {
    const isMatch = compile(pattern)
    const found = candidates.find((asset) => isMatch(asset.name))
    if (found) return found
  }
  return null
}

// ---------------------------------------------------------------------------
// Checksums publicados junto do release
// ---------------------------------------------------------------------------

/** Assets que podem conter o checksum SHA-256 de `assetName`, em ordem de preferência. */
export function checksumCandidates<T extends AssetLike>(assets: T[], assetName: string): T[] {
  const lower = assetName.toLowerCase()
  const exact = assets.filter((a) => {
    const n = a.name.toLowerCase()
    return n === `${lower}.sha256` || n === `${lower}.sha256sum` || n === `${lower}.sha256.txt`
  })
  const lists = assets.filter((a) => !exact.includes(a) && /(^|[-_.])(sha256sums?|checksums?)(\.txt)?$/i.test(a.name))
  return [...exact, ...lists].filter((a) => a.size > 0 && a.size < 1024 * 1024)
}

/**
 * Lê um arquivo de checksums ("<hash>  <arquivo>" por linha, ou apenas "<hash>")
 * e devolve o SHA-256 em minúsculas para `assetName`.
 */
export function parseChecksumFile(text: string, assetName: string): string | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const target = assetName.toLowerCase()
  for (const line of lines) {
    const match = /^([0-9a-fA-F]{64})(?:\s+\*?(.+))?$/.exec(line)
    if (match) {
      const file = match[2]?.trim().replace(/^\.\//, '').toLowerCase()
      if (!file || file === target || file.endsWith(`/${target}`)) return match[1].toLowerCase()
      continue
    }
    // Formato BSD: SHA256 (arquivo) = hash
    const bsd = /^SHA256\s*\((.+)\)\s*=\s*([0-9a-fA-F]{64})$/i.exec(line)
    if (bsd && bsd[1].trim().toLowerCase() === target) return bsd[2].toLowerCase()
  }
  return null
}

/** GitHub informa `digest: "sha256:<hex>"` nos assets mais recentes. */
export function parseDigest(digest: string | null | undefined): string | null {
  if (!digest) return null
  const match = /^sha256:([0-9a-fA-F]{64})$/.exec(digest.trim())
  return match ? match[1].toLowerCase() : null
}

// ---------------------------------------------------------------------------
// Origem dos downloads
// ---------------------------------------------------------------------------

/**
 * Só aceitamos downloads do próprio repositório declarado no manifesto, via HTTPS:
 * https://github.com/<dono>/<repo>/releases/download/...
 */
export function isAllowedAssetUrl(url: string, repo: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:') return false
  if (parsed.hostname.toLowerCase() !== 'github.com') return false
  if (parsed.username || parsed.password || parsed.port) return false
  const prefix = `/${repo.toLowerCase()}/releases/download/`
  return parsed.pathname.toLowerCase().startsWith(prefix) && !parsed.pathname.includes('/../')
}

/** Destinos de redirecionamento aceitos (CDN de releases do GitHub). */
export function isAllowedRedirectHost(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    const host = parsed.hostname.toLowerCase()
    return host === 'github.com' || host === 'objects.githubusercontent.com' || host === 'release-assets.githubusercontent.com'
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Regra de preservação na atualização
// ---------------------------------------------------------------------------

/**
 * Cria um verificador para os padrões `preserve` do manifesto.
 * Semântica parecida com .gitignore:
 *  - padrão sem "/" (ex.: "*.sav", "imgui.ini") casa com o nome do arquivo em qualquer pasta;
 *  - padrão com "/" (ex.: "Save/**", "mods/") é relativo à raiz do jogo;
 *  - padrão terminado em "/" significa a pasta inteira.
 */
export function createPreserveMatcher(patterns: string[]): (relPath: string) => boolean {
  const matchers = patterns
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => {
      let pattern = toPosix(raw).replace(/^\/+/, '')
      if (pattern.endsWith('/')) pattern = `${pattern}**`
      const hasSlash = pattern.includes('/')
      const isMatch = compile(pattern)
      if (hasSlash) {
        // "Save/**" também deve proteger a própria pasta "Save".
        const dirOnly = pattern.endsWith('/**') ? compile(pattern.slice(0, -3)) : null
        return (rel: string) => isMatch(rel) || (dirOnly ? dirOnly(rel) : false)
      }
      return (rel: string) => isMatch(rel.split('/').pop() ?? rel)
    })
  return (relPath: string) => {
    const rel = toPosix(relPath).replace(/^\/+/, '')
    return matchers.some((m) => m(rel))
  }
}

/**
 * Um arquivo do pacote novo deve ser pulado quando casa com `preserve`
 * e já existe na pasta do jogo (nunca sobrescrevemos dados do usuário).
 * Arquivos preservados que ainda não existem são copiados normalmente.
 */
export function shouldSkipFile(relPath: string, existsInDestination: boolean, isPreserved: (rel: string) => boolean): boolean {
  return existsInDestination && isPreserved(relPath)
}
