import { ArrowDownToLine } from 'lucide-react'
import type { LibraryItem } from '../../../shared/types'
import { useI18n } from '../i18n'
import { useAppState } from '../state/AppState'
import { GameCover } from './GameArt'
import { StatusPill } from './Status'
import { Pill, ProgressBar } from './ui'

export function GameCard({ item }: { item: LibraryItem }) {
  const { navigate, progress } = useAppState()
  const { t } = useI18n()
  const p = progress[item.entry.id]
  const open = () => navigate({ page: 'game', id: item.entry.id })
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => e.key === 'Enter' && open()}
      className="group cursor-pointer rounded-[14px] border border-surface-line bg-surface p-1.5 transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-chip-line"
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-[10px]">
        <GameCover item={item} />
        {item.update.available && !item.busy && (
          <span className="absolute top-2.5 right-2.5 flex h-6 items-center gap-1.5 rounded-[7px] bg-[#111112]/70 px-[9px] text-[11.5px] text-[#a8c4ff] backdrop-blur-md">
            <ArrowDownToLine size={11} strokeWidth={2.4} />
            {t('card.update')}
          </span>
        )}
        {item.busy && p && (
          <div className="absolute inset-x-2.5 bottom-2.5 rounded-lg bg-[#111112]/70 px-2.5 py-2 backdrop-blur-md">
            <div className="mb-1.5 flex justify-between font-mono text-[10.5px] text-white/80">
              <span>{t(`stage.${p.stage}`)}</span>
              {p.progress !== undefined && <span>{Math.round(p.progress * 100)}%</span>}
            </div>
            <ProgressBar value={p.progress} className="bg-white/15 [&>div]:bg-white" />
          </div>
        )}
      </div>
      <div className="px-2 pt-3 pb-2">
        <div className="truncate text-[14.5px] font-medium tracking-[-0.01em]">{item.name}</div>
        {item.manifest?.originalGame && <div className="mt-0.5 truncate text-[12px] text-subtle">{item.manifest.originalGame}</div>}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <StatusPill item={item} />
          <Pill mono>{item.entry.installedVersion ?? t('upd.unknown')}</Pill>
        </div>
      </div>
    </div>
  )
}
