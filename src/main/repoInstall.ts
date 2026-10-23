import { createHash } from 'node:crypto'
import picomatch from 'picomatch'
import type { Manifest, Platform } from '../shared/manifest'
import { isSideFile, toPosix } from '../shared/patterns'
import type { ReleaseAsset } from '../shared/types'
import { archiveKindOf } from './archive'

/**
 * Instalação a partir do link de um repositório do GitHub escolhido pelo usuário. O app gera um
 * manifesto para ele (pasta de manifestos do usuário) e segue o mesmo caminho validado dos
 * projetos embutidos: só baixa dos releases desse repositório, por HTTPS.
 */

const NAME_PART = /^[A-Za-z0-9_.-]+$/

/** "https://github.com/dono/repo" (com ou sem https://, .git, /releases…) → "dono/repo". */
export function parseRepoUrl(input: string): string | null {
  let text = input.trim()
  if (!text) return null
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) text = `https://${text}`
  let url: URL
  try {
    url = new URL(text)
  } catch {
    return null
  }
  // Nada é baixado deste endereço: ele só identifica o repositório (a API e os downloads são sempre HTTPS).
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  const host = url.hostname.toLowerCase()
  if ((host !== 'github.com' && host !== 'www.github.com') || url.username || url.password || url.port) return null
  const [owner, rawRepo] = url.pathname.split('/').filter(Boolean)
  const repo = rawRepo?.replace(/\.git$/i, '')
  const valid = (part: string | undefined): part is string => !!part && NAME_PART.test(part) && part !== '.' && part !== '..'
  return valid(owner) && valid(repo) ? `${owner}/${repo}` : null
}

const OS_WORDS: Record<Platform | 'other', RegExp> = {
  win32: /(^|[^a-z])(win|windows|win32|win64|msvc|mingw)([^a-z]|$)|\.exe$/i,
  linux: /(^|[^a-z])(linux|appimage|ubuntu|debian|steamdeck|deck)([^a-z]|$)|\.(appimage|x86_64)$/i,
  darwin: /(^|[^a-z])(mac|macos|osx|darwin|apple|universal)([^a-z]|$)|\.dmg$/i,
  other: /(^|[^a-z])(android|ios|switch|wasm|web|freebsd|haiku)([^a-z]|$)|\.(apk|ipa)$/i
}
/** Não servem para instalar (símbolos, código-fonte, instaladores, outras arquiteturas). */
const UNWANTED =
  /(^|[^a-z])(debug|dbg|symbols?|pdb|src|source)([^a-z]|$)|\.(msi|deb|rpm|pkg|flatpak|snap)$|(^|[^a-z])(arm64|aarch64|armhf|armv7|arm)([^a-z0-9]|$)/i
/** Instalador solto (.exe): baixado como "o jogo", ele seria aberto a cada "Jogar". */
const RAW_INSTALLER = /(setup|installer|install|unins)/i

export interface ScoredAsset<T> {
  asset: T
  score: number
}

/**
 * Assets que o app consegue instalar, do mais provável ao menos provável para a plataforma.
 * Os de outro sistema ficam de fora; os neutros (ex.: "jogo.zip") entram com nota menor.
 */
export function rankAssets<T extends Pick<ReleaseAsset, 'name'>>(assets: T[], platform: Platform): ScoredAsset<T>[] {
  return assets
    .filter((asset) => {
      const kind = archiveKindOf(asset.name)
      return !isSideFile(asset.name) && kind !== null && !UNWANTED.test(asset.name) && !(kind === 'raw' && RAW_INSTALLER.test(asset.name))
    })
    .map((asset) => {
      const name = asset.name
      const ownSystem = OS_WORDS[platform].test(name)
      const otherSystem = (Object.keys(OS_WORDS) as (Platform | 'other')[]).some((os) => os !== platform && OS_WORDS[os].test(name))
      let score = ownSystem ? 3 : otherSystem ? -10 : 0
      if (/(x64|x86_64|amd64|64bit|win64)/i.test(name)) score += 1
      if (/(^|[^a-z0-9])(x86|i386|i686|32bit|win32)([^a-z0-9]|$)/i.test(name) && !/64/.test(name)) score -= 1
      return { asset, score }
    })
    .filter((s) => s.score >= 0)
    .sort((a, b) => b.score - a.score || a.asset.name.localeCompare(b.asset.name))
}

/** O mais provável, só quando ele não empata com o segundo (no empate, o usuário escolhe). */
export function suggestAsset<T>(ranked: ScoredAsset<T>[]): T | null {
  if (ranked.length === 0) return null
  return ranked.length === 1 || ranked[0].score > ranked[1].score ? ranked[0].asset : null
}

function escapeGlob(text: string): string {
  return text.replace(/[\\*?[\]{}()!+@|]/g, (c) => `\\${c}`)
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Trechos do nome que são a versão: a tag (ou ela sem o "v"), números com pontos ("1.2.3") e
 * números entre separadores ("1_2_3", "2024-05-01", "4"). Arquitetura ("x86_64", "64-bit") não é versão.
 */
function versionMask(name: string, tag: string): boolean[] {
  const mask: boolean[] = new Array<boolean>(name.length).fill(false)
  const mark = (re: RegExp, text: string) => {
    for (const m of text.matchAll(re)) mask.fill(true, m.index, m.index + m[0].length)
  }
  const lower = name.toLowerCase()
  for (const value of new Set([tag, tag.replace(/^v(?=\d)/i, '')])) {
    if (value) mark(new RegExp(`(?<![a-z0-9])${escapeRegExp(value.toLowerCase())}(?![a-z0-9])`, 'g'), lower)
  }
  const shielded = name.replace(/x86[_-]64|\d+[-_]?bits?/gi, (m) => m.replace(/\d/g, 'x'))
  mark(/(?<![A-Za-z0-9])v?\d+(?:[._-]\d+)*(?![A-Za-z0-9])/g, shielded)
  mark(/\d+(?:\.\d+)+/g, shielded)
  return mask
}

function withVersion(name: string, mask: boolean[], version: string): string {
  let out = ''
  for (let i = 0; i < name.length;) {
    if (mask[i]) {
      while (mask[i]) i++
      out += version
    } else out += escapeGlob(name[i++])
  }
  return out
}

/**
 * Padrão para achar o mesmo asset nas próximas versões: a versão vira "*".
 * Ex.: "Jogo-v1.2.3-win64.zip" (tag v1.2.3) → "Jogo-*-win64.zip".
 * Segurança: o padrão precisa achar o próprio asset e nenhum outro do release (`others`), senão a
 * atualização poderia baixar outro arquivo (ex.: o de outro sistema). Nesse caso a versão vira só
 * números e pontos e, em último caso, fica o nome exato.
 */
export function assetPatternFrom(assetName: string, tag: string, others: string[] = []): string {
  const mask = versionMask(assetName, tag)
  const rivals = others.filter((other) => other !== assetName && !isSideFile(other))
  for (const pattern of [withVersion(assetName, mask, '*'), withVersion(assetName, mask, '?(v)+([0-9._-])')]) {
    const isMatch = picomatch(pattern, { nocase: true, dot: true })
    if (isMatch(assetName) && !rivals.some((other) => isMatch(other))) return pattern
  }
  return escapeGlob(assetName)
}

/**
 * Id do manifesto gerado: "gh-dono-repo-<hash>". O hash do repositório separa os que dariam o
 * mesmo nome (ex.: "a/b-c", "a-b/c" e "a/b.c").
 */
export function customManifestId(repo: string): string {
  const lower = repo.toLowerCase()
  const slug = lower
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
    .replace(/-$/, '')
  return `gh-${slug}-${createHash('sha256').update(lower).digest('hex').slice(0, 8)}`
}

/** Manifesto que o próprio app gerou pelo link de um repositório: o único que ele reescreve ou apaga. */
export function isGeneratedManifest(manifest: Pick<Manifest, 'id' | 'origin' | 'updates'>): boolean {
  return manifest.origin === 'user' && manifest.updates.source === 'github-releases' && manifest.id === customManifestId(manifest.updates.repo)
}

/** Saves, configurações e mods mais comuns: nunca sobrescritos ao atualizar. */
const CUSTOM_PRESERVE = ['saves/**', 'save/**', 'Saves/**', 'Save/**', 'mods/**', 'config/**', '*.sav', '*.cfg', '*.ini', 'portable.txt']

/**
 * Manifesto para um repositório escolhido pelo usuário. O executável de um pacote compactado só é
 * conhecido depois da instalação (detectado e gravado em seguida); o binário solto já sai com nome fixo.
 */
export function buildCustomManifest(opts: {
  repo: string
  platform: Platform
  assetName: string
  tag: string
  prerelease?: boolean
  /** Os outros arquivos do release: o padrão de atualização não pode achar nenhum deles. */
  otherAssets?: string[]
}) {
  const id = customManifestId(opts.repo)
  const name = opts.repo.split('/')[1]
  const raw = archiveKindOf(opts.assetName) === 'raw'
  const ext = raw ? (/\.[A-Za-z0-9_]+$/.exec(opts.assetName)?.[0] ?? '').toLowerCase() : ''
  const executables = raw ? [`${name}${ext}`] : opts.platform === 'win32' ? ['*.exe'] : ['*.AppImage', '*.x86_64']
  return {
    id,
    name,
    category: 'custom' as const,
    repoUrl: `https://github.com/${opts.repo}`,
    executables: { [opts.platform]: executables },
    // Nome que nunca existe: enquanto o executável não é conhecido, o manifesto não "reconhece" pastas de outros jogos.
    detectFiles: raw ? executables : [`.relaunch-${id}`],
    updates: {
      source: 'github-releases' as const,
      repo: opts.repo,
      assetPatterns: { [opts.platform]: assetPatternFrom(opts.assetName, opts.tag, opts.otherAssets) } as Partial<Record<Platform, string>>,
      includePrereleases: opts.prerelease === true,
      preserve: CUSTOM_PRESERVE
    }
  }
}

/** Programas que acompanham jogos mas não são o jogo (desinstaladores, atualizadores, relatórios de erro…). */
const NOT_THE_GAME =
  /(unins|uninstall|setup|installer|update|updater|crash|report|redist|vcredist|dxsetup|dxweb|directx|dotnet|helper|elevate|7z|curl|wget|qtwebengine|cef|notification|benchmark|config(urator)?|server|dedicated|editor|tool)/i

export interface ExecutableCandidate {
  rel: string
  /** Bit de execução (Linux): binários sem extensão só contam com ele. */
  executable?: boolean
}

/** Executáveis prováveis do jogo instalado, do mais provável ao menos provável. */
export function rankExecutables(files: ExecutableCandidate[], platform: Platform, repoName: string): string[] {
  const hint = repoName.toLowerCase().replace(/[^a-z0-9]/g, '')
  const isCandidate = (file: ExecutableCandidate) => {
    const lower = file.rel.toLowerCase()
    if (platform === 'win32') return lower.endsWith('.exe')
    return /\.(appimage|x86_64|sh)$/.test(lower) || (!/\.[a-z0-9]{1,5}$/.test(baseName(lower)) && file.executable === true)
  }
  return files
    .filter(isCandidate)
    .map((file) => {
      const rel = toPosix(file.rel)
      const base = baseName(rel).toLowerCase()
      const stem = base.replace(/\.[^.]+$/, '').replace(/[^a-z0-9]/g, '')
      let score = -rel.split('/').length
      if (hint && (stem.includes(hint) || hint.includes(stem))) score += 4
      if (NOT_THE_GAME.test(base)) score -= 6
      if (/\.appimage$/.test(base)) score += 2
      return { rel, score }
    })
    .sort((a, b) => b.score - a.score || a.rel.localeCompare(b.rel))
    .map((c) => c.rel)
}

function baseName(rel: string): string {
  return rel.split('/').pop() ?? rel
}
