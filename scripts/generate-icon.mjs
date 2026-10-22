// Gera build/icon.png (512x512) a partir do símbolo do Relaunch (docs/brand/relaunch-symbol-white.svg),
// sem dependências externas: o símbolo branco vai sobre um quadrado escuro arredondado,
// para ficar visível em barras de tarefas claras e escuras.
// Uso: npm run icon
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const SIZE = 512
const SS = 4 // supersampling por eixo (anti-aliasing)
const GRID = SIZE * SS
const BG = [17, 17, 18]
const FG = [255, 255, 255]
const TILE = { inset: 0.04, radius: 0.22 } // em fração do tamanho
const SYMBOL_SCALE = 0.6 // diâmetro do símbolo em fração do tamanho

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(path.join(root, 'docs', 'brand', 'relaunch-symbol-white.svg'), 'utf8')
const viewBox = /viewBox="([^"]+)"/.exec(svg)[1].split(/\s+/).map(Number)
const paths = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1])

/** Converte um atributo "d" (M, L, H, V, C, Z, absolutos ou relativos) em polígonos fechados. */
function toPolygons(d) {
  const tokens = d.match(/[MLHVCZmlhvcz]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g)
  const polygons = []
  let current = []
  let x = 0
  let y = 0
  let startX = 0
  let startY = 0
  let cmd = ''
  let i = 0
  const num = () => Number(tokens[i++])
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++]
    const rel = cmd === cmd.toLowerCase()
    switch (cmd.toUpperCase()) {
      case 'M': {
        if (current.length) polygons.push(current)
        x = num() + (rel ? x : 0)
        y = num() + (rel ? y : 0)
        startX = x
        startY = y
        current = [[x, y]]
        cmd = rel ? 'l' : 'L' // pares seguintes são linhas
        break
      }
      case 'L':
        x = num() + (rel ? x : 0)
        y = num() + (rel ? y : 0)
        current.push([x, y])
        break
      case 'H':
        x = num() + (rel ? x : 0)
        current.push([x, y])
        break
      case 'V':
        y = num() + (rel ? y : 0)
        current.push([x, y])
        break
      case 'C': {
        const [x1, y1, x2, y2, x3, y3] = Array.from({ length: 6 }, num)
        const p1 = rel ? [x + x1, y + y1] : [x1, y1]
        const p2 = rel ? [x + x2, y + y2] : [x2, y2]
        const p3 = rel ? [x + x3, y + y3] : [x3, y3]
        for (let s = 1; s <= 32; s++) {
          const t = s / 32
          const u = 1 - t
          current.push([
            u ** 3 * x + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0],
            u ** 3 * y + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1]
          ])
        }
        ;[x, y] = p3
        break
      }
      case 'Z':
        if (current.length) polygons.push(current)
        current = []
        x = startX
        y = startY
        break
      default:
        throw new Error(`Comando de path não suportado: ${cmd}`)
    }
  }
  if (current.length) polygons.push(current)
  return polygons
}

/** Máscara (GRID x GRID) dos polígonos pela regra nonzero, preenchida linha a linha. */
function rasterize(polygons) {
  const mask = new Uint8Array(GRID * GRID)
  const edges = polygons.flatMap((poly) => poly.map((p, k) => [p, poly[(k + 1) % poly.length]]))
  for (let row = 0; row < GRID; row++) {
    const sy = row + 0.5
    const crossings = []
    for (const [[x0, y0], [x1, y1]] of edges) {
      if (y0 === y1 || sy < Math.min(y0, y1) || sy >= Math.max(y0, y1)) continue
      crossings.push({ x: x0 + ((sy - y0) / (y1 - y0)) * (x1 - x0), dir: y1 > y0 ? 1 : -1 })
    }
    crossings.sort((a, b) => a.x - b.x)
    let winding = 0
    for (let k = 0; k < crossings.length - 1; k++) {
      winding += crossings[k].dir
      if (winding === 0) continue
      const from = Math.max(0, Math.ceil(crossings[k].x - 0.5))
      const to = Math.min(GRID - 1, Math.floor(crossings[k + 1].x - 0.5))
      for (let col = from; col <= to; col++) mask[row * GRID + col] = 1
    }
  }
  return mask
}

// Símbolo centralizado, escalado para SYMBOL_SCALE do ícone (coordenadas da grade supersampled).
const [vx, vy, vw, vh] = viewBox
const scale = (GRID * SYMBOL_SCALE) / Math.max(vw, vh)
const offX = (GRID - vw * scale) / 2 - vx * scale
const offY = (GRID - vh * scale) / 2 - vy * scale
const symbol = rasterize(paths.flatMap(toPolygons).map((poly) => poly.map(([px, py]) => [px * scale + offX, py * scale + offY])))

const inTile = (gx, gy) => {
  const min = GRID * TILE.inset
  const max = GRID - min
  const r = GRID * TILE.radius
  if (gx < min || gy < min || gx > max || gy > max) return false
  const cx = Math.min(Math.max(gx, min + r), max - r)
  const cy = Math.min(Math.max(gy, min + r), max - r)
  return (gx - cx) ** 2 + (gy - cy) ** 2 <= r * r
}

const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE)
for (let py = 0; py < SIZE; py++) {
  raw[py * (SIZE * 4 + 1)] = 0 // filtro "none"
  for (let px = 0; px < SIZE; px++) {
    let tile = 0
    let fg = 0
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const gx = px * SS + sx
        const gy = py * SS + sy
        if (!inTile(gx + 0.5, gy + 0.5)) continue
        tile++
        fg += symbol[gy * GRID + gx]
      }
    }
    const o = py * (SIZE * 4 + 1) + 1 + px * 4
    const mix = tile ? fg / tile : 0
    for (let c = 0; c < 3; c++) raw[o + c] = Math.round(BG[c] + (FG[c] - BG[c]) * mix)
    raw[o + 3] = Math.round((tile / (SS * SS)) * 255)
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8 // bits por canal
ihdr[9] = 6 // RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
])
const out = path.join(root, 'build', 'icon.png')
mkdirSync(path.dirname(out), { recursive: true })
writeFileSync(out, png)
console.log(`Ícone gerado: ${out} (${png.length} bytes)`)
