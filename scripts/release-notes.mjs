// Extrai do CHANGELOG.md a seção da versão atual (package.json) e grava em build/release-notes.md,
// arquivo que o electron-builder usa como notas do GitHub Release. Assim o CHANGELOG é a única fonte.
// Uso: npm run release-notes [-- <versão>]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const version = process.argv[2] ?? JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version
const changelog = readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8')

const lines = changelog.split(/\r?\n/)
const escaped = version.replace(/^v/, '').replace(/[.+]/g, '\\$&')
const start = lines.findIndex((l) => new RegExp(`^##\\s+\\[?v?${escaped}\\]?(\\s|$)`).test(l))
if (start < 0) {
  console.error(`CHANGELOG.md não tem uma seção "## [${version}]". Adicione as notas antes de publicar.`)
  process.exit(1)
}
let end = lines.findIndex((l, i) => i > start && /^##\s/.test(l))
if (end < 0) end = lines.length
const body = lines.slice(start + 1, end).join('\n').trim()
if (!body) {
  console.error(`A seção ${version} do CHANGELOG.md está vazia.`)
  process.exit(1)
}
const out = path.join(root, 'build', 'release-notes.md')
mkdirSync(path.dirname(out), { recursive: true })
writeFileSync(out, `${body}\n`)
console.log(`Notas da v${version} gravadas em ${path.relative(root, out)}`)
