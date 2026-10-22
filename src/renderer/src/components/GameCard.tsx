import { Play } from 'lucide-react'
import { useState } from 'react'
import type { LibraryItem } from '../../../shared/types'
import { useI18n } from '../i18n'
import { errorMessage, formatRelative } from '../lib/format'
import { useAppState } from '../state/AppState'
import { GameArt } from './GameArt'
import { StatusBadge, UpdateBadge } from './StatusBadge'
import { ProgressBar } from './ui'

export function GameCard({ item }: { item: LibraryItem }) {
  const { navigate, toast, progress } = useAppState()
  const { t, locale } = useI18n()
  const [launching, setLaunching] = useState(false)
  const p = progress[item.entry.id]
  const canPlay = item.status !== 'missingFolder' && item.status !== 'unknownManifest' && !item.running && !item.busy

  const play = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setLaunching(true)
    try {
      await window.api.library.launch(item.entry.id)
    } catch (err) {
      toast('error', errorMessage(err, t))
    } finally {
      setLaunching(false)
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate({ page: 'game', id: item.entry.id })}
      onKeyDown={(e) => {
        if (e.key === 'Enter') navigate({ page: 'game', id: item.entry.id })
      }}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-line bg-card text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-xl hover:shadow-black/20 focus-visible:-translate-y-0.5"
    >
      <div className="relative aspect-[4/5] overflow-hidden">
        <GameArt item={item} className="transition duration-300 group-hover:scale-[1.03]" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute top-2.5 left-2.5 flex flex-col items-start gap-1.5">
          <StatusBadge item={item} solid />
          {item.update.available && !item.busy && <UpdateBadge />}
        </div>
        {item.manifest?.originalGame && (
          <div className="absolute right-3 bottom-2.5 left-3 truncate text-[11px] font-medium text-white/80">{item.manifest.originalGame}</div>
        )}
        {canPlay && (
          <button
            type="button"
            onClick={play}
            disabled={launching}
            aria-label={t('library.play')}
            className="absolute inset-0 m-auto flex h-14 w-14 scale-90 items-center justify-center rounded-full bg-white/95 text-slate-900 opacity-0 shadow-2xl transition group-hover:scale-100 group-hover:opacity-100 focus-visible:scale-100 focus-visible:opacity-100"
          >
            <Play size={24} fill="currentColor" className="ml-0.5" />
          </button>
        )}
        {item.busy && p && (
          <div className="absolute inset-x-3 bottom-3">
            <ProgressBar value={p.progress} />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 px-3.5 py-3">
        <div className="truncate text-[15px] font-semibold">{item.name}</div>
        <div className="flex items-center gap-1.5 truncate text-xs text-muted">
          <span>{item.entry.installedVersion ?? t('game.versionUnknown')}</span>
          <span aria-hidden>·</span>
          <span className="truncate">
            {item.entry.lastPlayedAt ? t('library.lastPlayed', { when: formatRelative(item.entry.lastPlayedAt, t, locale) }) : t('library.neverPlayed')}
          </span>
        </div>
      </div>
    </div>
  )
}
