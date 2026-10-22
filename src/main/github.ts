import { AppError } from '../shared/errors'
import type { RateLimitInfo, ReleaseAsset, ReleaseInfo } from '../shared/types'
import { REQUEST_TIMEOUT_MS, USER_AGENT } from './updateCore'

const API = 'https://api.github.com'

export interface HttpCacheEntry {
  etag: string
  data: unknown
  savedAt: string
}

export interface HttpCache {
  get(url: string): HttpCacheEntry | undefined
  set(url: string, entry: HttpCacheEntry): void
}

export interface GitHubClientOptions {
  fetchImpl: typeof fetch
  cache: HttpCache
  getToken: () => string | null | undefined
  onRateLimit?: (info: RateLimitInfo) => void
}

interface RawAsset {
  name: string
  size: number
  browser_download_url: string
  digest?: string | null
  state?: string
}

interface RawRelease {
  tag_name: string
  name: string | null
  body: string | null
  published_at: string | null
  prerelease: boolean
  draft: boolean
  html_url: string
  assets: RawAsset[]
}

export function toReleaseInfo(raw: RawRelease): ReleaseInfo {
  const assets: ReleaseAsset[] = (raw.assets ?? [])
    .filter((a) => !a.state || a.state === 'uploaded')
    .map((a) => ({ name: a.name, size: a.size, url: a.browser_download_url, digest: a.digest ?? null }))
  return {
    tag: raw.tag_name,
    name: raw.name || raw.tag_name,
    body: raw.body ?? '',
    publishedAt: raw.published_at,
    prerelease: raw.prerelease,
    htmlUrl: raw.html_url,
    assets
  }
}

/**
 * Cliente mínimo da API de Releases do GitHub.
 * Usa ETag/If-None-Match: respostas 304 reaproveitam o cache. Com token, as 304 não contam no limite da API.
 */
export class GitHubClient {
  constructor(private readonly opts: GitHubClientOptions) {}

  /** GET na API; null quando o recurso não existe (404). */
  private async getJson<T>(path: string): Promise<T | null> {
    const url = `${API}${path}`
    const cached = this.opts.cache.get(url)
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': USER_AGENT
    }
    const token = this.opts.getToken()
    if (token) headers.Authorization = `Bearer ${token}`
    if (cached) headers['If-None-Match'] = cached.etag

    let res: Response
    try {
      res = await this.opts.fetchImpl(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
    } catch (err) {
      throw new AppError('NETWORK', (err as Error).message)
    }
    this.reportRateLimit(res, !!token)

    if (res.status === 304 && cached) return cached.data as T
    if (res.status === 404) return null
    if (res.status === 401) throw new AppError('GITHUB_ERROR', 'Token do GitHub inválido ou expirado', { status: 401 })
    if (res.status === 429 || (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0')) {
      const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000
      throw new AppError('RATE_LIMITED', 'Limite de requisições do GitHub atingido', { resetAt: reset ? new Date(reset).toISOString() : '' })
    }
    if (!res.ok) throw new AppError('GITHUB_ERROR', `HTTP ${res.status}`, { status: res.status })

    const data = (await res.json().catch((err: Error) => {
      throw new AppError('NETWORK', err.message)
    })) as T
    const etag = res.headers.get('etag')
    if (etag) this.opts.cache.set(url, { etag, data, savedAt: new Date().toISOString() })
    return data
  }

  private reportRateLimit(res: Response, authenticated: boolean): void {
    const limit = Number(res.headers.get('x-ratelimit-limit'))
    const remaining = Number(res.headers.get('x-ratelimit-remaining'))
    const reset = Number(res.headers.get('x-ratelimit-reset'))
    if (Number.isFinite(limit) && limit > 0 && Number.isFinite(remaining)) {
      this.opts.onRateLimit?.({ limit, remaining, resetAt: new Date(reset * 1000).toISOString(), authenticated })
    }
  }

  /** Lista releases publicados (sem rascunhos), do mais novo para o mais antigo. */
  async listReleases(repo: string, perPage = 15): Promise<ReleaseInfo[]> {
    const data = await this.getJson<RawRelease[]>(`/repos/${repo}/releases?per_page=${perPage}`)
    if (!data) return []
    return data
      .filter((r) => !r.draft)
      .map(toReleaseInfo)
      .sort((a, b) => Date.parse(b.publishedAt ?? '0') - Date.parse(a.publishedAt ?? '0'))
  }

  /**
   * Release mais recente. Sem pré-releases usa /releases/latest; com pré-releases usa a lista.
   * Se `accept` for informado e o release mais recente não servir (ex.: sem binário para a
   * plataforma), procura na lista o mais novo que sirva.
   */
  async getLatestRelease(repo: string, includePrereleases: boolean, accept?: (release: ReleaseInfo) => boolean): Promise<ReleaseInfo | null> {
    if (!includePrereleases) {
      const data = await this.getJson<RawRelease>(`/repos/${repo}/releases/latest`)
      const latest = data ? toReleaseInfo(data) : null
      if (latest && (!accept || accept(latest))) return latest
      if (!latest) return null
    }
    const list = (await this.listReleases(repo)).filter((r) => includePrereleases || !r.prerelease)
    return list.find((r) => !accept || accept(r)) ?? null
  }
}
