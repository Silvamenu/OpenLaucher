/**
 * Utilitários do editor de configs em modo formulário.
 * Usados pelo renderer (formulário) e pelo processo principal (validação ao salvar).
 */

// ---------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------

export type JsonPrimitive = string | number | boolean | null
export type JsonPath = (string | number)[]

export interface JsonField {
  path: JsonPath
  label: string
  value: JsonPrimitive
}

/** Lista os valores primitivos de um JSON (objetos aninhados viram "a.b.c"). */
export function flattenJson(value: unknown, limit = 5000): JsonField[] {
  const out: JsonField[] = []
  const walk = (node: unknown, path: JsonPath) => {
    if (out.length >= limit) return
    if (node === null || typeof node !== 'object') {
      if (path.length === 0) return
      out.push({
        path,
        label: path
          .map((p) => (typeof p === 'number' ? `[${p}]` : p))
          .join('.')
          .replace(/\.\[/g, '['),
        value: node as JsonPrimitive
      })
      return
    }
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, [...path, i]))
      return
    }
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) walk(child, [...path, key])
  }
  walk(value, [])
  return out
}

/** Retorna uma cópia de `root` com o valor em `path` substituído. */
export function setJsonPath<T>(root: T, path: JsonPath, value: JsonPrimitive): T {
  if (path.length === 0) return value as T
  const [head, ...rest] = path
  if (Array.isArray(root)) {
    const copy = [...root]
    copy[head as number] = setJsonPath(copy[head as number], rest, value)
    return copy as T
  }
  const obj = (root ?? {}) as Record<string, unknown>
  return { ...obj, [head]: setJsonPath(obj[head as string], rest, value) } as T
}

/** Detecta a indentação usada no arquivo original para manter o estilo ao salvar. */
export function detectIndent(text: string): string {
  const match = /^([ \t]+)\S/m.exec(text)
  return match ? match[1] : '  '
}

export function stringifyJsonLike(original: string, data: unknown): string {
  const eol = original.includes('\r\n') ? '\r\n' : '\n'
  const body = JSON.stringify(data, null, detectIndent(original))
  const out = eol === '\n' ? body : body.replace(/\n/g, eol)
  return original.endsWith('\n') ? out + eol : out
}

// ---------------------------------------------------------------------------
// INI (edição que preserva comentários, ordem e espaçamento)
// ---------------------------------------------------------------------------

export interface IniField {
  line: number
  section: string
  key: string
  value: string
}

const SECTION_RE = /^\s*\[(.*)\]\s*$/
const ENTRY_RE = /^(\s*([^=:;#\s[][^=:]*?)\s*[=:]\s*)(.*?)(\s*)$/

export function parseIniFields(text: string): IniField[] {
  const fields: IniField[] = []
  let section = ''
  text.split(/\r?\n/).forEach((line, index) => {
    const sec = SECTION_RE.exec(line)
    if (sec) {
      section = sec[1].trim()
      return
    }
    if (/^\s*[;#]/.test(line) || !line.trim()) return
    const entry = ENTRY_RE.exec(line)
    if (entry) fields.push({ line: index, section, key: entry[2].trim(), value: entry[3] })
  })
  return fields
}

/** Aplica novos valores linha a linha, sem tocar no restante do arquivo. */
export function applyIniEdits(text: string, edits: { line: number; value: string }[]): string {
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const lines = text.split(/\r?\n/)
  for (const edit of edits) {
    const current = lines[edit.line]
    if (current === undefined) continue
    const entry = ENTRY_RE.exec(current)
    if (!entry) continue
    lines[edit.line] = `${entry[1]}${edit.value.replace(/[\r\n]+/g, ' ')}${entry[4]}`
  }
  return lines.join(eol)
}

/** Validação leve: toda linha não vazia deve ser seção, comentário ou chave=valor. */
export function validateIni(text: string): { ok: true } | { ok: false; line: number } {
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim() || /^\s*[;#]/.test(line) || SECTION_RE.test(line) || ENTRY_RE.test(line)) continue
    return { ok: false, line: i + 1 }
  }
  return { ok: true }
}

export function validateConfigText(format: 'json' | 'ini' | 'text', text: string): { ok: true } | { ok: false; message: string } {
  if (format === 'json') {
    try {
      JSON.parse(text)
      return { ok: true }
    } catch (err) {
      return { ok: false, message: (err as Error).message }
    }
  }
  if (format === 'ini') {
    const result = validateIni(text)
    return result.ok ? { ok: true } : { ok: false, message: `linha ${result.line}` }
  }
  return { ok: true }
}
