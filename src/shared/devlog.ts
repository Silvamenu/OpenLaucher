import { compareVersions, normalizeTag } from './version'

/**
 * Decide o que fazer com o popup de novidades ao abrir o app.
 * - Primeira execução (nenhuma versão vista): não mostra, apenas registra a versão atual.
 * - Versão atual maior que a última vista: mostra (até o usuário fechar).
 * - Mesma versão ou downgrade: não mostra.
 */
export type DevlogDecision = { show: true } | { show: false; markSeen: boolean }

export function decideDevlog(currentVersion: string, lastSeenVersion: string | null | undefined): DevlogDecision {
  if (!lastSeenVersion) return { show: false, markSeen: true }
  if (normalizeTag(currentVersion) === normalizeTag(lastSeenVersion)) return { show: false, markSeen: false }
  const cmp = compareVersions(currentVersion, lastSeenVersion)
  if (cmp === null || cmp > 0) return { show: true }
  return { show: false, markSeen: true }
}

// ---------------------------------------------------------------------------
// CHANGELOG.md
// ---------------------------------------------------------------------------

export interface ChangelogEntry {
  version: string
  date: string | null
  body: string
}

const HEADING_RE = /^##\s+\[?v?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)\]?(?:\s*[-–—(]\s*(\d{4}-\d{2}-\d{2})\)?)?\s*$/

/** Lê todas as seções "## [x.y.z] - AAAA-MM-DD" de um CHANGELOG no formato Keep a Changelog. */
export function parseChangelog(markdown: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = []
  let current: { version: string; date: string | null; lines: string[] } | null = null
  for (const line of markdown.split(/\r?\n/)) {
    const heading = HEADING_RE.exec(line.trim())
    if (heading) {
      if (current) entries.push({ version: current.version, date: current.date, body: current.lines.join('\n').trim() })
      current = { version: heading[1], date: heading[2] ?? null, lines: [] }
      continue
    }
    if (/^##\s/.test(line) && current) {
      // Outra seção de nível 2 (ex.: "## [Não lançado]") encerra a atual.
      entries.push({ version: current.version, date: current.date, body: current.lines.join('\n').trim() })
      current = null
      continue
    }
    current?.lines.push(line)
  }
  if (current) entries.push({ version: current.version, date: current.date, body: current.lines.join('\n').trim() })
  return entries
}

export function findChangelogEntry(markdown: string, version: string): ChangelogEntry | null {
  const wanted = normalizeTag(version)
  return parseChangelog(markdown).find((e) => normalizeTag(e.version) === wanted) ?? null
}

// ---------------------------------------------------------------------------
// Agrupamento das notas em seções
// ---------------------------------------------------------------------------

export type NoteSectionKind = 'novidades' | 'melhorias' | 'correcoes' | 'outros'

export interface NoteSection {
  kind: NoteSectionKind
  title: string | null
  body: string
}

const KIND_ALIASES: Record<Exclude<NoteSectionKind, 'outros'>, string[]> = {
  novidades: ['novidades', 'novo', 'novos', 'adicionado', 'adicionados', 'added', 'new', 'features', 'feature', "what's new", 'whats new'],
  melhorias: [
    'melhorias',
    'melhoria',
    'alterado',
    'alterações',
    'alteracoes',
    'mudanças',
    'mudancas',
    'changed',
    'changes',
    'improvements',
    'improved',
    'enhancements'
  ],
  correcoes: ['correções', 'correcoes', 'correção', 'correcao', 'corrigido', 'fixed', 'fixes', 'bug fixes', 'bugfixes']
}

function stripEmoji(text: string): string {
  return text.replace(/[\p{Extended_Pictographic}️]/gu, '').trim()
}

export function sectionKindOf(title: string): NoteSectionKind {
  const clean = stripEmoji(title)
    .replace(/[:#*_]/g, '')
    .trim()
    .toLowerCase()
  for (const [kind, aliases] of Object.entries(KIND_ALIASES) as [NoteSectionKind, string[]][]) {
    if (aliases.includes(clean)) return kind
  }
  return 'outros'
}

/**
 * Divide notas de release em seções pelos cabeçalhos "###" (ou "##").
 * Cabeçalhos conhecidos (Novidades/Added, Melhorias/Changed, Correções/Fixed)
 * recebem um `kind` próprio para o popup exibir ícones e cores.
 */
export function groupReleaseNotes(markdown: string): NoteSection[] {
  const sections: NoteSection[] = []
  let current: { title: string | null; lines: string[] } = { title: null, lines: [] }
  const flush = () => {
    const body = current.lines.join('\n').trim()
    if (body || current.title) {
      sections.push({ kind: current.title ? sectionKindOf(current.title) : 'outros', title: current.title, body })
    }
  }
  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^#{2,3}\s+(.+?)\s*#*\s*$/.exec(line)
    if (heading) {
      flush()
      current = { title: heading[1], lines: [] }
    } else {
      current.lines.push(line)
    }
  }
  flush()
  return sections.filter((s) => s.body.length > 0)
}
