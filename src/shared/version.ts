/**
 * Comparação de versões tolerante a tags de release do GitHub
 * ("v1.2.0", "9.0.2", "SoH-9.0.2", "1.0.0-rc.1", "2.0.0 Beta").
 */

export interface ParsedVersion {
  numbers: number[]
  prerelease: string | null
}

const VERSION_RE = /(\d+(?:\.\d+)*)(?:[-_+ ]?([0-9A-Za-z][0-9A-Za-z.\-_]*))?/

export function parseVersion(input: string | null | undefined): ParsedVersion | null {
  if (!input) return null
  const match = VERSION_RE.exec(input.trim())
  if (!match) return null
  const numbers = match[1].split('.').map((part) => Number.parseInt(part, 10))
  if (numbers.some((n) => !Number.isFinite(n))) return null
  let prerelease = match[2] ? match[2].toLowerCase() : null
  // "+build" metadata não conta para precedência.
  if (prerelease && input.includes(`+${match[2]}`)) prerelease = null
  return { numbers, prerelease }
}

function comparePrerelease(a: string | null, b: string | null): number {
  if (a === b) return 0
  if (a === null) return 1 // versão final > pré-release
  if (b === null) return -1
  const pa = a.split(/[.\-_]/)
  const pb = b.split(/[.\-_]/)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i]
    const y = pb[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    const nx = /^\d+$/.test(x) ? Number(x) : null
    const ny = /^\d+$/.test(y) ? Number(y) : null
    if (nx !== null && ny !== null) {
      if (nx !== ny) return nx < ny ? -1 : 1
    } else if (nx !== null) {
      return -1
    } else if (ny !== null) {
      return 1
    } else if (x !== y) {
      return x < y ? -1 : 1
    }
  }
  return 0
}

/**
 * Retorna -1, 0 ou 1. Retorna null quando alguma das versões não pode ser interpretada.
 */
export function compareVersions(a: string | null | undefined, b: string | null | undefined): -1 | 0 | 1 | null {
  const va = parseVersion(a)
  const vb = parseVersion(b)
  if (!va || !vb) return null
  const len = Math.max(va.numbers.length, vb.numbers.length)
  for (let i = 0; i < len; i++) {
    const x = va.numbers[i] ?? 0
    const y = vb.numbers[i] ?? 0
    if (x !== y) return x < y ? -1 : 1
  }
  const pre = comparePrerelease(va.prerelease, vb.prerelease)
  return pre === 0 ? 0 : pre < 0 ? -1 : 1
}

export function normalizeTag(tag: string): string {
  return tag
    .trim()
    .replace(/^v(?=\d)/i, '')
    .toLowerCase()
}

export interface ReleaseRef {
  tag: string
  publishedAt?: string | null
}

/**
 * Decide se `latest` é mais nova que a versão instalada.
 * - Tags iguais (ignorando "v" inicial): não.
 * - Ambas interpretáveis como versão: compara numericamente.
 * - Caso contrário, usa a data de publicação quando disponível.
 * - Sem como comparar e tags diferentes: considera nova (é o release mais recente do repositório).
 */
export function isNewerRelease(latest: ReleaseRef, installed: ReleaseRef | string | null | undefined): boolean {
  if (!installed) return false
  const inst: ReleaseRef = typeof installed === 'string' ? { tag: installed } : installed
  if (normalizeTag(latest.tag) === normalizeTag(inst.tag)) return false
  const cmp = compareVersions(latest.tag, inst.tag)
  if (cmp !== null) return cmp > 0
  if (latest.publishedAt && inst.publishedAt) {
    return Date.parse(latest.publishedAt) > Date.parse(inst.publishedAt)
  }
  return true
}
