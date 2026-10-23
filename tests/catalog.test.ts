import { describe, expect, it } from 'vitest'
import { groupCatalog, matchesSearch, normalizeSearch, type CatalogEntry } from '../src/shared/catalog'

const entries: CatalogEntry[] = [
  { name: 'God of War III Remastered', originalGame: 'PlayStation 4', category: 'playstation' },
  { name: 'Ship of Harkinian', originalGame: 'The Legend of Zelda: Ocarina of Time', category: 'nintendo' },
  { name: 'RPCS3', originalGame: 'Emulador de PlayStation 3', category: 'emulators' },
  { name: 'DevilutionX', originalGame: 'Diablo', category: 'pc' },
  { name: 'Bloodborne', originalGame: 'PlayStation 4', category: 'playstation' }
]

describe('catálogo', () => {
  it('busca sem diferenciar maiúsculas e acentos, com todas as palavras', () => {
    expect(normalizeSearch('Pokémon ÁGUA')).toBe('pokemon agua')
    expect(matchesSearch(entries[0], 'god war')).toBe(true)
    expect(matchesSearch(entries[0], 'god zelda')).toBe(false)
    expect(matchesSearch(entries[1], 'ocarina')).toBe(true)
    expect(matchesSearch(entries[1], '  ')).toBe(true)
  })

  it('agrupa na ordem das listas, por nome, e some com as listas vazias', () => {
    expect(groupCatalog(entries, '').map((g) => [g.category, g.entries.map((e) => e.name)])).toEqual([
      ['nintendo', ['Ship of Harkinian']],
      ['playstation', ['Bloodborne', 'God of War III Remastered']],
      ['pc', ['DevilutionX']],
      ['emulators', ['RPCS3']]
    ])
    expect(groupCatalog(entries, 'playstation').map((g) => g.category)).toEqual(['playstation', 'emulators'])
    expect(groupCatalog(entries, 'nada disso')).toEqual([])
  })
})
