// Gera build/icon.png (512x512) desenhando o logo do RecompHub sem dependências externas.
// Uso: npm run icon
import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SIZE = 512
const SS = 4 // supersampling por eixo (anti-aliasing)
const S = SIZE / 100 // desenho numa grade 100x100

// Marca do RecompHub (mesma do layout): quadrado claro arredondado com losango escuro.
const LIGHT = [237, 237, 238]
const DARK = [17, 17, 18]

const inRoundRect = (x, y, rx, ry, w, h, r) => {
  if (x < rx || y < ry || x > rx + w || y > ry + h) return false
  const cx = Math.min(Math.max(x, rx + r), rx + w - r)
  const cy = Math.min(Math.max(y, ry + r), ry + h - r)
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}

/** Cor de um ponto na grade 100x100 (null = transparente). */
function shade(x, y) {
  if (!inRoundRect(x, y, 4, 4, 92, 92, 24)) return null
  // losango: quadrado de 30% girado 45° em torno do centro
  const dx = x - 50
  const dy = y - 50
  const u = (dx + dy) / Math.SQRT2 + 50
  const v = (dy - dx) / Math.SQRT2 + 50
  if (inRoundRect(u, v, 35, 35, 30, 30, 6)) return DARK
  return LIGHT
}

const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE)
for (let py = 0; py < SIZE; py++) {
  raw[py * (SIZE * 4 + 1)] = 0 // filtro "none"
  for (let px = 0; px < SIZE; px++) {
    let r = 0,
      g = 0,
      b = 0,
      a = 0
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const c = shade((px + (sx + 0.5) / SS) / S, (py + (sy + 0.5) / SS) / S)
        if (c) {
          r += c[0]
          g += c[1]
          b += c[2]
          a += 1
        }
      }
    }
    const o = py * (SIZE * 4 + 1) + 1 + px * 4
    const n = SS * SS
    raw[o] = a ? Math.round(r / a) : 0
    raw[o + 1] = a ? Math.round(g / a) : 0
    raw[o + 2] = a ? Math.round(b / a) : 0
    raw[o + 3] = Math.round((a / n) * 255)
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
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'build', 'icon.png')
mkdirSync(path.dirname(out), { recursive: true })
writeFileSync(out, png)
console.log(`Ícone gerado: ${out} (${png.length} bytes)`)
