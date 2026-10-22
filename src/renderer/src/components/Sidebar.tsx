import { ArrowDownToLine, LayoutGrid, Plus, Settings, User } from 'lucide-react'
import type { ReactNode } from 'react'
import { useI18n } from '../i18n'
import { initials } from '../lib/format'
import { useAppState, type Route } from '../state/AppState'
import { GameArt } from './GameArt'
import { ProgressRing, Tooltip } from './ui'

function NavButton({ active, icon, label, badge, onClick }: { active: boolean; icon: ReactNode; label: string; badge?: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`group relative flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition max-lg:justify-center max-lg:px-0 ${
        active ? 'bg-accent/12 text-accent' : 'text-muted hover:bg-subtle hover:text-fg'
      }`}
    >
      {active && <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-r bg-accent max-lg:hidden" />}
      {icon}
      <span className="truncate max-lg:hidden">{label}</span>
      {!!badge && (
        <span className="ml-auto rounded-full bg-accent px-1.5 text-[10px] leading-4 font-bold text-white max-lg:absolute max-lg:top-1 max-lg:right-1 max-lg:ml-0">
          {badge}
        </span>
      )}
    </button>
  )
}

/** Botão circular azul que só aparece quando há atualização do launcher. */
export function AppUpdateButton() {
  const { appUpdate } = useAppState()
  const { t } = useI18n()
  const visible = appUpdate.status === 'available' || appUpdate.status === 'downloading' || appUpdate.status === 'downloaded'
  if (!visible) return null
  const version = appUpdate.version ?? ''
  const downloading = appUpdate.status !== 'downloaded'
  const percent = appUpdate.percent ?? 0
  const label =
    appUpdate.status === 'downloaded'
      ? t('appUpdate.ready', { version })
      : appUpdate.status === 'downloading'
        ? `${t('appUpdate.available', { version })} (${percent}%)`
        : t('appUpdate.available', { version })
  return (
    <Tooltip text={label}>
      <span className="relative flex h-11 w-11 items-center justify-center">
        {downloading && <ProgressRing size={44} stroke={3} percent={percent} className="absolute inset-0 text-[#3B82F6]" />}
        <button
          type="button"
          aria-label={label}
          onClick={() => {
            if (appUpdate.status === 'downloaded') void window.api.appUpdate.install()
          }}
          className={`update-button relative flex h-9 w-9 items-center justify-center rounded-full bg-[#3B82F6] text-white shadow-lg shadow-blue-900/30 transition hover:brightness-110 ${
            appUpdate.status === 'downloaded' ? 'cursor-pointer' : 'cursor-default'
          }`}
        >
          <ArrowDownToLine size={18} strokeWidth={2.4} />
        </button>
      </span>
    </Tooltip>
  )
}

export function Avatar({ onClick }: { onClick: () => void }) {
  const { settings } = useAppState()
  const { t } = useI18n()
  const name = settings?.userName?.trim() ?? ''
  const letters = initials(name)
  return (
    <Tooltip text={name ? t('nav.profile', { name }) : t('nav.profileEmpty')}>
      <button
        type="button"
        onClick={onClick}
        aria-label={name || t('nav.settings')}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FACC15] text-[13px] font-bold text-slate-900 shadow ring-2 ring-black/5 transition hover:brightness-105"
      >
        {letters || <User size={18} strokeWidth={2.4} />}
      </button>
    </Tooltip>
  )
}

export function Sidebar() {
  const { route, navigate, items } = useAppState()
  const { t } = useI18n()
  const updates = items.filter((i) => i.update.available).length
  const is = (page: Route['page']) => route.page === page
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-line bg-sidebar max-lg:w-[76px]">
      <div className="flex h-16 items-center gap-2.5 px-4 max-lg:justify-center max-lg:px-0">
        <img src={new URL('../assets/logo.svg', import.meta.url).href} alt="" className="h-8 w-8" draggable={false} />
        <div className="leading-tight max-lg:hidden">
          <div className="text-[15px] font-bold tracking-tight">{t('app.name')}</div>
          <div className="text-[11px] text-muted">{t('app.tagline')}</div>
        </div>
      </div>

      <nav className="flex flex-col gap-1 px-3">
        <NavButton active={is('library')} icon={<LayoutGrid size={18} />} label={t('nav.library')} badge={updates} onClick={() => navigate({ page: 'library' })} />
        <NavButton active={is('add')} icon={<Plus size={18} />} label={t('nav.add')} onClick={() => navigate({ page: 'add' })} />
        <NavButton active={is('settings')} icon={<Settings size={18} />} label={t('nav.settings')} onClick={() => navigate({ page: 'settings' })} />
      </nav>

      {items.length > 0 && (
        <div className="mt-5 min-h-0 flex-1 overflow-y-auto px-3">
          <div className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-muted uppercase max-lg:hidden">{t('nav.games')}</div>
          <div className="flex flex-col gap-0.5">
            {items.map((item) => {
              const active = route.page === 'game' && route.id === item.entry.id
              return (
                <button
                  key={item.entry.id}
                  type="button"
                  title={item.name}
                  onClick={() => navigate({ page: 'game', id: item.entry.id })}
                  className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition max-lg:justify-center ${
                    active ? 'bg-subtle text-fg' : 'text-muted hover:bg-subtle hover:text-fg'
                  }`}
                >
                  <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-md">
                    <GameArt item={item} iconSize={20} />
                    <span
                      className={`absolute right-0.5 bottom-0.5 h-2 w-2 rounded-full ring-2 ring-sidebar ${
                        item.running ? 'bg-sky-400' : item.status === 'ready' ? 'bg-emerald-400' : item.status === 'needsSetup' ? 'bg-amber-400' : 'bg-red-500'
                      }`}
                    />
                  </span>
                  <span className="truncate max-lg:hidden">{item.name}</span>
                  {item.update.available && <ArrowDownToLine size={14} className="ml-auto shrink-0 text-accent max-lg:hidden" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
      {items.length === 0 && <div className="flex-1" />}

      <div className="flex flex-col items-center gap-3 border-t border-line py-4">
        <AppUpdateButton />
        <Avatar onClick={() => navigate({ page: 'settings' })} />
      </div>
    </aside>
  )
}
