import { ArrowDownToLine, CircleAlert, CircleCheck, FolderX, LoaderCircle, Play } from 'lucide-react'
import type { LibraryItem } from '../../../shared/types'
import { useI18n } from '../i18n'

const styles = {
  ready: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30',
  needsSetup: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-amber-500/30',
  missingFolder: 'bg-red-500/15 text-red-600 dark:text-red-400 ring-red-500/30',
  unknownManifest: 'bg-red-500/15 text-red-600 dark:text-red-400 ring-red-500/30',
  running: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 ring-sky-500/30',
  update: 'bg-blue-500/90 text-white ring-blue-400/40'
}

const iconColor = {
  ready: 'text-emerald-400',
  needsSetup: 'text-amber-400',
  missingFolder: 'text-red-400',
  unknownManifest: 'text-red-400'
}

/** `solid`: versão para usar sobre a arte do card (fundo escuro translúcido). */
export function StatusBadge({ item, solid = false }: { item: LibraryItem; solid?: boolean }) {
  const { t } = useI18n()
  const base = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1'
  const solidStyle = 'bg-black/55 text-white ring-white/15 backdrop-blur-md'
  if (item.busy || item.running) {
    return (
      <span className={`${base} ${solid ? solidStyle : styles.running}`}>
        {item.busy ? <LoaderCircle size={12} className="animate-spin text-sky-400" /> : <Play size={11} fill="currentColor" className={solid ? 'text-sky-400' : ''} />}
        {item.busy ? t('status.updating') : t('status.running')}
      </span>
    )
  }
  const Icon = item.status === 'ready' ? CircleCheck : item.status === 'needsSetup' ? CircleAlert : FolderX
  return (
    <span className={`${base} ${solid ? solidStyle : styles[item.status]}`}>
      <Icon size={12} className={solid ? iconColor[item.status] : ''} /> {t(`status.${item.status}`)}
    </span>
  )
}

export function UpdateBadge() {
  const { t } = useI18n()
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow ring-1 ${styles.update}`}>
      <ArrowDownToLine size={12} /> {t('badge.update')}
    </span>
  )
}
