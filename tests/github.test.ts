import { describe, expect, it } from 'vitest'
import { GitHubClient, type HttpCacheEntry } from '../src/main/github'
import { pickAsset } from '../src/shared/patterns'
import type { RateLimitInfo } from '../src/shared/types'

interface FakeResponse {
  status: number
  body?: unknown
  headers?: Record<string, string>
}

function fakeFetch(routes: Record<string, FakeResponse | ((init: RequestInit) => FakeResponse)>) {
  const calls: { url: string; headers: Record<string, string> }[] = []
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    const headers = (init?.headers ?? {}) as Record<string, string>
    calls.push({ url, headers })
    const route = routes[url]
    if (!route) return new Response('not found', { status: 404 })
    const res = typeof route === 'function' ? route(init ?? {}) : route
    return new Response(res.status === 304 ? null : JSON.stringify(res.body ?? {}), {
      status: res.status,
      headers: { 'x-ratelimit-limit': '60', 'x-ratelimit-remaining': '59', 'x-ratelimit-reset': '1900000000', ...res.headers }
    })
  }) as typeof fetch
  return { impl, calls }
}

function memoryCache() {
  const map = new Map<string, HttpCacheEntry>()
  return { map, get: (u: string) => map.get(u), set: (u: string, e: HttpCacheEntry) => void map.set(u, e) }
}

const rawRelease = (tag: string, assets: string[], extra: Record<string, unknown> = {}) => ({
  tag_name: tag,
  name: `Release ${tag}`,
  body: '### Novidades\n- coisa',
  published_at: '2026-10-01T00:00:00Z',
  prerelease: false,
  draft: false,
  html_url: `https://github.com/o/r/releases/tag/${tag}`,
  assets: assets.map((name) => ({ name, size: 10, browser_download_url: `https://github.com/o/r/releases/download/${tag}/${name}` })),
  ...extra
})

const LATEST = 'https://api.github.com/repos/o/r/releases/latest'
const LIST = 'https://api.github.com/repos/o/r/releases?per_page=15'

describe('cliente da API de Releases', () => {
  it('usa ETag: a segunda consulta envia If-None-Match e aproveita o cache no 304', async () => {
    const cache = memoryCache()
    const { impl, calls } = fakeFetch({
      [LATEST]: (init) =>
        (init.headers as Record<string, string>)['If-None-Match'] === '"abc"'
          ? { status: 304, headers: { etag: '"abc"' } }
          : { status: 200, body: rawRelease('9.3.1', ['SoH-Win64.zip']), headers: { etag: '"abc"' } }
    })
    const client = new GitHubClient({ fetchImpl: impl, cache, getToken: () => null })
    const first = await client.getLatestRelease('o/r', false)
    const second = await client.getLatestRelease('o/r', false)
    expect(first?.tag).toBe('9.3.1')
    expect(second).toEqual(first)
    expect(calls[0].headers['If-None-Match']).toBeUndefined()
    expect(calls[1].headers['If-None-Match']).toBe('"abc"')
    expect(cache.map.size).toBe(1)
  })

  it('envia o token pessoal quando configurado e informa o limite', async () => {
    const limits: RateLimitInfo[] = []
    const { impl, calls } = fakeFetch({ [LATEST]: { status: 200, body: rawRelease('1.0.0', []), headers: { 'x-ratelimit-limit': '5000' } } })
    const client = new GitHubClient({ fetchImpl: impl, cache: memoryCache(), getToken: () => 'ghp_teste', onRateLimit: (i) => limits.push(i) })
    await client.getLatestRelease('o/r', false)
    expect(calls[0].headers.Authorization).toBe('Bearer ghp_teste')
    expect(limits[0]).toMatchObject({ limit: 5000, authenticated: true })
  })

  it('transforma limite estourado em erro RATE_LIMITED', async () => {
    const { impl } = fakeFetch({ [LATEST]: { status: 403, body: { message: 'rate limit' }, headers: { 'x-ratelimit-remaining': '0' } } })
    const client = new GitHubClient({ fetchImpl: impl, cache: memoryCache(), getToken: () => null })
    await expect(client.getLatestRelease('o/r', false)).rejects.toMatchObject({ code: 'RATE_LIMITED' })
  })

  it('repositório sem releases retorna null', async () => {
    const { impl } = fakeFetch({})
    const client = new GitHubClient({ fetchImpl: impl, cache: memoryCache(), getToken: () => null })
    expect(await client.getLatestRelease('o/r', false)).toBeNull()
  })

  it('com pré-releases usa a lista e ignora rascunhos', async () => {
    const { impl } = fakeFetch({
      [LIST]: {
        status: 200,
        body: [
          rawRelease('2.0.0-beta', ['a-windows.zip'], { prerelease: true, published_at: '2026-10-10T00:00:00Z' }),
          rawRelease('3.0.0', ['a-windows.zip'], { draft: true, published_at: '2026-10-20T00:00:00Z' }),
          rawRelease('1.0.0', ['a-windows.zip'])
        ]
      }
    })
    const client = new GitHubClient({ fetchImpl: impl, cache: memoryCache(), getToken: () => null })
    expect((await client.getLatestRelease('o/r', true))?.tag).toBe('2.0.0-beta')
  })

  it('se o release mais recente não tem binário da plataforma, procura o mais novo que tenha', async () => {
    const { impl } = fakeFetch({
      [LATEST]: { status: 200, body: rawRelease('let-it-snow-2024', []) },
      [LIST]: {
        status: 200,
        body: [rawRelease('let-it-snow-2024', [], { published_at: '2026-12-20T00:00:00Z' }), rawRelease('9.3.1', ['SoH-Win64.zip'])]
      }
    })
    const client = new GitHubClient({ fetchImpl: impl, cache: memoryCache(), getToken: () => null })
    const release = await client.getLatestRelease('o/r', false, (r) => pickAsset(r.assets, ['*Win64*.zip']) !== null)
    expect(release?.tag).toBe('9.3.1')
  })
})
