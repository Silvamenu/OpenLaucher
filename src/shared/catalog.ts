/**
 * Catálogo de projetos: listas (categorias), nível de compatibilidade e busca. Sem zod, para a
 * interface poder usar.
 */

/** Listas do catálogo, na ordem em que aparecem. A categoria é a plataforma original do jogo. */
export const CATEGORIES = ['nintendo', 'playstation', 'xbox', 'sega', 'pc', 'emulators', 'custom'] as const
export type Category = (typeof CATEGORIES)[number]

/** Quão bem o jogo roda hoje (principalmente nos jogos via emulador). */
export const COMPATIBILITY = ['playable', 'ingame', 'experimental'] as const
export type Compatibility = (typeof COMPATIBILITY)[number]

/** Id do requisito com o arquivo do jogo nos jogos que rodam num emulador. */
export const RUNNER_GAME_FILE = 'game'

export interface CatalogEntry {
  name: string
  originalGame?: string
  category: Category
}

/** Minúsculas e sem acentos: "Pokémon" e "pokemon" casam. */
export function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

/** Todas as palavras da busca precisam aparecer no nome ou no jogo original. */
export function matchesSearch(entry: CatalogEntry, query: string): boolean {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const haystack = normalizeSearch(`${entry.name} ${entry.originalGame ?? ''}`)
  return words.every((word) => haystack.includes(word))
}

/** Agrupa por categoria (na ordem de CATEGORIES, por nome dentro de cada uma) só o que casa com a busca. */
export function groupCatalog<T extends CatalogEntry>(entries: T[], query: string): { category: Category; entries: T[] }[] {
  const matching = entries.filter((entry) => matchesSearch(entry, query))
  return CATEGORIES.map((category) => ({
    category,
    entries: matching.filter((entry) => entry.category === category).sort((a, b) => a.name.localeCompare(b.name))
  })).filter((group) => group.entries.length > 0)
}
