import type { AppErrorShape } from '../../../shared/types'
import type { TFunction, TranslationKey } from '../i18n'

export function formatBytes(bytes: number | undefined, locale: string): string {
  if (bytes === undefined || !Number.isFinite(bytes)) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toLocaleString(locale, { maximumFractionDigits: unit === 0 ? 0 : 1 })} ${units[unit]}`
}

export function formatPlaytime(seconds: number): string {
  if (seconds < 60) return seconds > 0 ? '< 1 min' : '0 min'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h} h ${m.toString().padStart(2, '0')} min` : `${m} min`
}

export function formatDate(iso: string | null | undefined, locale: string, withTime = false): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return withTime ? date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) : date.toLocaleDateString(locale, { dateStyle: 'medium' })
}

export function formatRelative(iso: string | null | undefined, t: TFunction, locale: string): string {
  if (!iso) return '—'
  const diff = Date.now() - Date.parse(iso)
  if (!Number.isFinite(diff)) return '—'
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return t('common.justNow')
  if (minutes < 60) return t('common.minutesAgo', { n: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('common.hoursAgo', { n: hours })
  const days = Math.floor(hours / 24)
  if (days < 30) return t('common.daysAgo', { n: days })
  return formatDate(iso, locale)
}

/** Iniciais para o avatar ("Ana Maria Silva" → "AS"). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Mensagem traduzida para um erro vindo da API. */
export function errorMessage(err: unknown, t: TFunction): string {
  const e = err as Partial<AppErrorShape> & { message?: string }
  const code = e?.code
  if (code) {
    const key = `error.${code}` as TranslationKey
    return t(key, { message: e.message ?? '', ...(e.params ?? {}) })
  }
  return t('error.UNKNOWN', { message: e?.message ?? String(err) })
}

export function isApiError(err: unknown, code: AppErrorShape['code']): boolean {
  return (err as { code?: string })?.code === code
}
