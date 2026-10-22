import type { LibraryItem } from '../../../shared/types'
import { useI18n } from '../i18n'
import { Dot, Pill } from './ui'

export type StatusTone = 'ok' | 'warn' | 'bad' | 'info'

export function statusTone(item: LibraryItem): StatusTone {
  if (item.busy || item.running) return 'info'
  return item.status === 'ready' ? 'ok' : item.status === 'needsSetup' ? 'warn' : 'bad'
}

export function useStatusLabel(): (item: LibraryItem) => string {
  const { t } = useI18n()
  return (item) => (item.busy ? t('status.updating') : item.running ? t('status.running') : t(`status.${item.status}`))
}

export function StatusPill({ item }: { item: LibraryItem }) {
  const label = useStatusLabel()
  return (
    <Pill>
      <Dot tone={statusTone(item)} />
      {label(item)}
    </Pill>
  )
}
