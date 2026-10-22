// Gera build/icon.png (512x512) desenhando o logo do RecompHub sem dependências externas.
// Uso: npm run icon
import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SIZE = 512
const SS = 4 // supersampling por eixo (anti-aliasing)
const S = SIZE / 64 // o desenho usa a mesma grade 64x64 do logo.svg

const inRoundRect = (x, y, rx, ry, w, h, r) => {
  if (x < rx || y < ry || x > rx + w || y > ry + h) return false
  const cx = Math.min(Math.max(x, rx + r), rx + w - r)
  const cy = Math.min(Math.max(y, ry + r), ry + h - r)
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}
const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r
const inTriangle = (x, y) => y >= 9 && y <= 15 && Math.abs(x - 32) <= ((y - 9) / 6) * 5
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))

const C1 = hex('#60a5fa')
const C2 = hex('#4f46e5')
const WHITE = [255, 255, 255]
const BLUE = hex('#3b82f6')
const AMBER = hex('#f59e0b')

/** Cor (RGBA) de um ponto na grade 64x64. */
function shade(x, y) {
  if (!inRoundRect(x, y, 2, 2, 60, 60, 16)) return null
  let color = mix(C1, C2, Math.min(1, Math.max(0, (x + y - 4) / 120)))
  if (inTriangle(x, y)) color = mix(color, WHITE, 0.9)
  if (inRoundRect(x, y, 13, 20, 38, 26, 13)) {
    color = mix(color, WHITE, 0.95)
    if (inRoundRect(x, y, 20, 31, 10, 4, 2) || inRoundRect(x, y, 23, 28, 4, 10, 2)) color = C2
    if (inCircle(x, y, 39, 30.5, 2.6)) color = BLUE
    if (inCircle(x, y, 44, 35.5, 2.6)) color = AMBER
  }
  return color
}

const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE)
for (let py = 0; py < SIZE; py++) {
  raw[py * (SIZE * 4 + 1)] = 0 // filtro "none"
  for (let px = 0; px < SIZE; px++) {
    let r = 0, g = 0, b = 0, a = 0
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const c = shade((px + (sx + 0.5) / SS) / S, (py + (sy + 0.5) / SS) / S)
        if (c) {
          r += c[0]; g += c[1]; b += c[2]; a += 1
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
