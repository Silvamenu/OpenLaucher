import { describe, expect, it } from 'vitest'
import { compareVersions, isNewerRelease, normalizeTag, parseVersion } from '../src/shared/version'

describe('comparação de versões', () => {
  it('interpreta tags comuns de release', () => {
    expect(parseVersion('v1.2.3')).toEqual({ numbers: [1, 2, 3], prerelease: null })
    expect(parseVersion('9.0.2')).toEqual({ numbers: [9, 0, 2], prerelease: null })
    expect(parseVersion('SoH-9.0.2')).toEqual({ numbers: [9, 0, 2], prerelease: null })
    expect(parseVersion('1.0.0-rc.1')).toEqual({ numbers: [1, 0, 0], prerelease: 'rc.1' })
    expect(parseVersion('1.0.0+build.5')).toEqual({ numbers: [1, 0, 0], prerelease: null })
    expect(parseVersion('Blair Bravo')).toBeNull()
    expect(parseVersion('')).toBeNull()
  })

  it.each([
    ['1.0.0', '1.0.0', 0],
    ['v1.0.0', '1.0.0', 0],
    ['1.0.1', '1.0.0', 1],
    ['1.10.0', '1.9.9', 1],
    ['2.0', '2.0.0', 0],
    ['0.9.9.1', '0.9.9', 1],
    ['1.0.0', '1.0.0-rc2', 1],
    ['1.0.0-rc.2', '1.0.0-rc.10', -1],
    ['1.0.0-alpha', '1.0.0-beta', -1],
    ['9.3.1', '10.0.0', -1]
  ])('compareVersions(%s, %s) = %s', (a, b, expected) => {
    expect(compareVersions(a, b)).toBe(expected)
  })

  it('retorna null quando não dá para comparar', () => {
    expect(compareVersions('Dewey Bravo', '9.3.1')).toBeNull()
    expect(compareVersions(null, '1.0.0')).toBeNull()
  })

  it('normaliza tags', () => {
    expect(normalizeTag(' V1.2.0 ')).toBe('1.2.0')
    expect(normalizeTag('version')).toBe('version')
  })
})

describe('detecção de release mais novo', () => {
  it('compara por versão quando possível', () => {
    expect(isNewerRelease({ tag: '9.3.1' }, '9.3.0')).toBe(true)
    expect(isNewerRelease({ tag: 'v1.2.2' }, 'v1.2.2')).toBe(false)
    expect(isNewerRelease({ tag: 'v1.2.2' }, '1.2.2')).toBe(false)
    expect(isNewerRelease({ tag: '1.0.0' }, '1.1.0')).toBe(false)
  })

  it('usa a data de publicação para tags sem versão', () => {
    expect(isNewerRelease({ tag: 'nightly-b', publishedAt: '2026-02-01T00:00:00Z' }, { tag: 'snapshot', publishedAt: '2026-01-01T00:00:00Z' })).toBe(true)
    expect(isNewerRelease({ tag: 'antigo', publishedAt: '2025-01-01T00:00:00Z' }, { tag: 'snapshot', publishedAt: '2026-01-01T00:00:00Z' })).toBe(false)
  })

  it('sem versão instalada conhecida não acusa atualização', () => {
    expect(isNewerRelease({ tag: '9.3.1' }, null)).toBe(false)
    expect(isNewerRelease({ tag: '9.3.1' }, undefined)).toBe(false)
  })

  it('tags diferentes e incomparáveis sem datas contam como novas', () => {
    expect(isNewerRelease({ tag: 'Bravo' }, 'Alfa')).toBe(true)
  })
})
