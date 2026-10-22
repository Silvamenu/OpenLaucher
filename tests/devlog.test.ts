import { describe, expect, it } from 'vitest'
import { DevlogTracker, type DevlogStorage } from '../src/main/devlogState'
import { decideDevlog, findChangelogEntry, groupReleaseNotes, parseChangelog, shouldShowDevlog } from '../src/shared/devlog'

const CHANGELOG = `# Changelog

Todas as mudanças relevantes.

## [Não lançado]

- algo em andamento

## [0.2.0] - 2026-11-05

### Novidades
- Suporte a temas personalizados

### Melhorias
- Biblioteca mais rápida

### Correções
- Corrige travamento ao remover jogo

## [0.1.0] - 2026-10-22

### Added
- Primeira versão
`

class MemoryStorage implements DevlogStorage {
  lastSeen: string | undefined
  notes: Record<string, { notes: string; date: string | null }> = {}
  getLastSeen() {
    return this.lastSeen
  }
  setLastSeen(v: string) {
    this.lastSeen = v
  }
  getStoredNotes(v: string) {
    return this.notes[v]
  }
}

describe('decisão de exibir o devlog', () => {
  it('não exibe na primeira instalação, só registra a versão', () => {
    expect(decideDevlog('0.1.0', undefined)).toEqual({ show: false, markSeen: true })
  })

  it('exibe depois de uma atualização', () => {
    expect(shouldShowDevlog('0.2.0', '0.1.0')).toBe(true)
    expect(shouldShowDevlog('1.0.0', '0.9.9')).toBe(true)
  })

  it('não exibe na mesma versão nem em downgrade', () => {
    expect(shouldShowDevlog('0.2.0', '0.2.0')).toBe(false)
    expect(shouldShowDevlog('v0.2.0', '0.2.0')).toBe(false)
    expect(decideDevlog('0.1.0', '0.2.0')).toEqual({ show: false, markSeen: true })
  })
})

describe('DevlogTracker: aparece uma única vez por versão', () => {
  it('fluxo completo: instalação → atualização → popup → fechado → não aparece de novo', () => {
    const storage = new MemoryStorage()

    // 1ª execução da 0.1.0 (instalação nova)
    expect(new DevlogTracker('0.1.0', storage, () => CHANGELOG).pending()).toBeNull()
    expect(storage.lastSeen).toBe('0.1.0')

    // Reaberto na mesma versão
    expect(new DevlogTracker('0.1.0', storage, () => CHANGELOG).pending()).toBeNull()

    // Atualizou para 0.2.0: popup aparece até ser fechado
    const tracker = new DevlogTracker('0.2.0', storage, () => CHANGELOG)
    const shown = tracker.pending()
    expect(shown?.version).toBe('0.2.0')
    expect(shown?.date).toBe('2026-11-05')
    expect(shown?.sections.map((s) => s.kind)).toEqual(['novidades', 'melhorias', 'correcoes'])
    // Se o app fechar sem o usuário dispensar, aparece de novo
    expect(new DevlogTracker('0.2.0', storage, () => CHANGELOG).pending()).not.toBeNull()

    tracker.markSeen()
    expect(storage.lastSeen).toBe('0.2.0')
    expect(new DevlogTracker('0.2.0', storage, () => CHANGELOG).pending()).toBeNull()
  })

  it('usa as notas guardadas pelo atualizador se o CHANGELOG não tiver a versão', () => {
    const storage = new MemoryStorage()
    storage.lastSeen = '0.2.0'
    storage.notes['0.3.0'] = { notes: '### Correções\n- Corrige X', date: '2026-12-01' }
    const view = new DevlogTracker('0.3.0', storage, () => CHANGELOG).pending()
    expect(view?.sections).toEqual([{ kind: 'correcoes', title: 'Correções', body: '- Corrige X' }])
    expect(view?.date).toBe('2026-12-01')
  })

  it('"Ver novidades" sempre devolve as notas da versão atual', () => {
    const storage = new MemoryStorage()
    storage.lastSeen = '0.1.0'
    const view = new DevlogTracker('0.1.0', storage, () => null).current()
    expect(view.version).toBe('0.1.0')
    expect(view.sections).toEqual([])
  })
})

describe('CHANGELOG.md e agrupamento das notas', () => {
  it('lê as seções de versão e ignora "Não lançado"', () => {
    const entries = parseChangelog(CHANGELOG)
    expect(entries.map((e) => [e.version, e.date])).toEqual([
      ['0.2.0', '2026-11-05'],
      ['0.1.0', '2026-10-22']
    ])
    expect(findChangelogEntry(CHANGELOG, 'v0.1.0')?.body).toContain('Primeira versão')
    expect(findChangelogEntry(CHANGELOG, '9.9.9')).toBeNull()
  })

  it('mapeia cabeçalhos PT-BR e EN para Novidades/Melhorias/Correções', () => {
    const sections = groupReleaseNotes(`Intro do release

### ✨ Novidades
- A

### Changed
- B

## Bug fixes
- C

### Outros
- D
`)
    expect(sections.map((s) => [s.kind, s.title])).toEqual([
      ['outros', null],
      ['novidades', '✨ Novidades'],
      ['melhorias', 'Changed'],
      ['correcoes', 'Bug fixes'],
      ['outros', 'Outros']
    ])
  })

  it('notas sem cabeçalho viram uma seção única', () => {
    expect(groupReleaseNotes('- só uma lista')).toEqual([{ kind: 'outros', title: null, body: '- só uma lista' }])
    expect(groupReleaseNotes('')).toEqual([])
  })
})
