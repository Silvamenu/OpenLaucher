/**
 * Termos técnicos que ganham uma dica (tooltip) na interface. Aqui fica só a detecção;
 * a explicação de cada termo está nas traduções (glossary.<id>.title e glossary.<id>.text).
 * Os padrões aceitam português e inglês porque os textos dos manifestos são em português.
 */
const TERMS = {
  rom: 'ROMs?',
  assets: '[Aa]ssets',
  // Sem hífen no prefixo: o termo começa onde começa a palavra, o que mantém a busca linear.
  o2r: '[\\p{L}\\p{N}_]*\\.o2r',
  port: '[Pp]orts?',
  sha1: 'SHA-1',
  romFormats: '\\.[znv]64',
  release: '[Rr]eleases?',
  manifest: '[Mm]anifest(?:os?|s)?',
  decomp: '[Dd]ecompila(?:ção|tion)'
} as const

export type GlossaryId = keyof typeof TERMS
export type GlossaryPart = string | { id: GlossaryId; text: string }

// O \b do JS só conhece ASCII ("portão" casaria "port"); esta fronteira entende acentos e também
// não corta nomes como "sm64-port" ou "dono/port" (repositórios e arquivos citados nos textos).
const edge = '[\\p{L}\\p{N}_/-]'
const pattern = new RegExp(
  `(?<!${edge})(?:${Object.entries(TERMS)
    .map(([id, source]) => `(?<${id}>${source})`)
    .join('|')})(?!${edge})`,
  'gu'
)

/** Separa o texto em trechos comuns e termos do glossário; cada termo só é marcado na primeira vez em que aparece. */
export function splitGlossary(text: string): GlossaryPart[] {
  const parts: GlossaryPart[] = []
  const seen = new Set<GlossaryId>()
  let last = 0
  for (const match of text.matchAll(pattern)) {
    const id = (Object.keys(TERMS) as GlossaryId[]).find((key) => match.groups?.[key] !== undefined)
    if (!id || seen.has(id)) continue
    seen.add(id)
    if (match.index > last) parts.push(text.slice(last, match.index))
    parts.push({ id, text: match[0] })
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}
