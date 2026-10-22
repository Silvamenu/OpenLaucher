import { useEffect, useState } from 'react'
import type { LibraryItem } from '../../../shared/types'

const iconCache = new Map<string, Promise<string | null>>()

/** Ícone extraído do executável do jogo (cacheado por sessão). */
export function useExeIcon(item: LibraryItem): string | null {
  const [icon, setIcon] = useState<string | null>(null)
  const key = `${item.entry.id}|${item.entry.path}|${item.status}`
  useEffect(() => {
    let alive = true
    if (!iconCache.has(key)) iconCache.set(key, window.api.library.icon(item.entry.id).catch(() => null))
    void iconCache.get(key)!.then((url) => alive && setIcon(url))
    return () => {
      alive = false
    }
  }, [key, item.entry.id])
  return icon
}

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function accentOf(item: LibraryItem): string {
  return item.manifest?.accentColor ?? '#3b82f6'
}

/** Fundo gerado a partir da cor do projeto — o app não usa artes oficiais dos jogos. */
export function artBackground(accent: string): string {
  const [r, g, b] = hexToRgb(accent)
  return [
    `radial-gradient(120% 80% at 15% 10%, rgba(${r},${g},${b},0.95), transparent 60%)`,
    `radial-gradient(90% 70% at 100% 100%, rgba(${Math.min(255, r + 60)},${Math.min(255, g + 40)},${Math.min(255, b + 80)},0.55), transparent 65%)`,
    `linear-gradient(160deg, rgba(${r},${g},${b},0.85), rgba(${Math.round(r * 0.25)},${Math.round(g * 0.25)},${Math.round(b * 0.3)},1))`
  ].join(',')
}

export function monogram(name: string): string {
  // Números no meio do nome ("Zelda 64: Recompiled") só poluem o monograma.
  const words = name
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter((w, i) => w && (i === 0 || !/^\d+$/.test(w)))
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export function coverUrl(item: LibraryItem): string | null {
  return item.entry.coverVersion ? `rh-cover://cover/${item.entry.id}?v=${item.entry.coverVersion}` : null
}

/** Arte do card: capa personalizada, ou gradiente com o ícone do executável/monograma. */
export function GameArt({ item, iconSize = 72, className = '' }: { item: LibraryItem; iconSize?: number; className?: string }) {
  const icon = useExeIcon(item)
  const cover = coverUrl(item)
  if (cover) {
    return <img src={cover} alt="" draggable={false} className={`h-full w-full object-cover ${className}`} />
  }
  return (
    <div className={`relative flex h-full w-full items-center justify-center overflow-hidden ${className}`} style={{ background: artBackground(accentOf(item)) }}>
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)', backgroundSize: '14px 14px' }}
      />
      {icon ? (
        <img src={icon} alt="" draggable={false} style={{ width: iconSize, height: iconSize }} className="relative drop-shadow-[0_6px_16px_rgba(0,0,0,0.45)] [image-rendering:auto]" />
      ) : (
        <span className="relative font-black tracking-tight text-white/90 drop-shadow-[0_4px_14px_rgba(0,0,0,0.4)]" style={{ fontSize: iconSize * 0.62 }}>
          {monogram(item.name)}
        </span>
      )}
    </div>
  )
}
