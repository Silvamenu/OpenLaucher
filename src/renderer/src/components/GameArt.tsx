import { useEffect, useState } from 'react'
import type { LibraryItem } from '../../../shared/types'

const iconCache = new Map<string, Promise<string | null>>()

/** Ícone extraído do executável (só no Windows; cacheado por sessão). */
export function useExeIcon(item: LibraryItem): string | null {
  const [icon, setIcon] = useState<string | null>(null)
  const key = `${item.entry.id}|${item.entry.path}|${item.status}`
  useEffect(() => {
    let alive = true
    if (!iconCache.has(key))
      iconCache.set(
        key,
        window.api.library.icon(item.entry.id).catch(() => null)
      )
    void iconCache.get(key)!.then((url) => alive && setIcon(url))
    return () => {
      alive = false
    }
  }, [key, item.entry.id])
  return icon
}

/** Matiz OKLCH (0–360) de uma cor hex — mantém luminosidade/croma iguais entre jogos. */
export function hueOf(hex: string | undefined): number {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return 255
  const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const [r, g, b] = [1, 3, 5].map((i) => toLinear(Number.parseInt(hex.slice(i, i + 2), 16) / 255))
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const h = (Math.atan2(B, A) * 180) / Math.PI
  return Math.round(h < 0 ? h + 360 : h)
}

export function hueOfItem(item: LibraryItem): number {
  return hueOf(item.manifest?.accentColor)
}

/** Gradiente da "capa" gerada — o app não usa artes oficiais dos jogos. */
export function coverGradient(hue: number): string {
  return `linear-gradient(160deg, oklch(0.48 0.1 ${hue}), oklch(0.26 0.06 ${hue + 20}))`
}

export function tileColor(hue: number): string {
  return `oklch(0.45 0.1 ${hue})`
}

export function monogram(name: string): string {
  // Números no meio do nome ("Zelda 64: Recompiled") entram só como 1º caractere.
  const words = name
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return words
    .slice(0, 3)
    .map((w) => (/^\d+$/.test(w) ? w.slice(0, 2) : w[0]))
    .join('')
    .slice(0, 3)
    .toUpperCase()
}

export function coverUrl(item: LibraryItem): string | null {
  return item.entry.coverVersion ? `rl-cover://cover/${item.entry.id}?v=${item.entry.coverVersion}` : null
}

/** Capa: imagem escolhida pelo usuário, ou gradiente listrado com ícone do .exe / monograma. */
export function GameCover({ item, fontSize = 44, className = '' }: { item: LibraryItem; fontSize?: number; className?: string }) {
  const icon = useExeIcon(item)
  const cover = coverUrl(item)
  if (cover) return <img src={cover} alt="" draggable={false} className={`h-full w-full object-cover ${className}`} />
  return (
    <div className={`relative h-full w-full ${className}`} style={{ background: coverGradient(hueOfItem(item)) }}>
      <div className="stripes absolute inset-0" />
      <div className="absolute inset-0 grid place-items-center">
        {icon ? (
          <img
            src={icon}
            alt=""
            draggable={false}
            style={{ width: fontSize * 1.2, height: fontSize * 1.2 }}
            className="drop-shadow-[0_8px_18px_rgba(0,0,0,0.4)]"
          />
        ) : (
          <span className="font-bold tracking-[-0.04em] text-white/90" style={{ fontSize }}>
            {monogram(item.name)}
          </span>
        )}
      </div>
    </div>
  )
}

/** Quadradinho colorido com as iniciais (lista da barra lateral). */
export function GameTile({ item, size = 22 }: { item: LibraryItem; size?: number }) {
  const cover = coverUrl(item)
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-md font-bold tracking-[-0.02em] text-white"
      style={{ width: size, height: size, background: tileColor(hueOfItem(item)), fontSize: size * 0.39 }}
    >
      {cover ? <img src={cover} alt="" className="h-full w-full object-cover" draggable={false} /> : monogram(item.name)}
    </span>
  )
}
