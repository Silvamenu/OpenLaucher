import { ArrowDownToLine, ChevronsUpDown, Plus, Search, User } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useI18n } from '../i18n'
import { initials } from '../lib/format'
import { useAppState, type Route } from '../state/AppState'
import { GameTile } from './GameArt'
import { NavIcon, LogoMark } from './icons'
import { statusTone, useStatusLabel } from './Status'
import { Dot, Kbd, ProgressBar, ProgressRing, Tooltip } from './ui'

function NavItem({ active, icon, label, badge, onClick }: { active: boolean; icon: 'library' | 'downloads' | 'settings'; label: string; badge?: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex h-[38px] w-full items-center gap-[11px] rounded-[10px] px-2.5 text-left text-[13.5px] transition-colors ${
        active ? 'bg-hover text-fg' : 'text-muted hover:bg-hover/60 hover:text-fg'
      }`}
    >
      <NavIcon name={icon} />
      <span className="truncate">{label}</span>
      {!!badge && <span className="ml-auto rounded-md bg-accent-bg px-1.5 py-px font-mono text-[11px] text-accent-fg">{badge}</span>}
    </button>
  )
}

/** Botão circular azul: só aparece quando há atualização do launcher. Fica logo acima do avatar. */
export function AppUpdateButton() {
  const { appUpdate } = useAppState()
  const { t } = useI18n()
  const visible = appUpdate.status === 'available' || appUpdate.status === 'downloading' || appUpdate.status === 'downloaded'
  if (!visible) return null
  const version = appUpdate.version ?? ''
  const ready = appUpdate.status === 'downloaded'
  const percent = appUpdate.percent ?? 0
  const label = ready
    ? t('appUpdate.ready', { version })
    : appUpdate.status === 'downloading'
      ? `${t('appUpdate.available', { version })} (${percent}%)`
      : t('appUpdate.available', { version })
  return (
    <Tooltip text={label}>
      <span className="relative flex h-11 w-11 items-center justify-center">
        {!ready && <ProgressRing size={44} stroke={2.5} percent={percent} className="absolute inset-0 text-[#3B82F6]" />}
        <button
          type="button"
          aria-label={label}
          onClick={() => ready && void window.api.appUpdate.install()}
          className={`update-button relative flex h-9 w-9 items-center justify-center rounded-full bg-[#3B82F6] text-white transition hover:brightness-110 ${ready ? '' : 'cursor-default'}`}
        >
          <ArrowDownToLine size={17} strokeWidth={2.4} />
        </button>
      </span>
    </Tooltip>
  )
}

function ProfileCard() {
  const { settings, navigate } = useAppState()
  const { t } = useI18n()
  const name = settings?.userName?.trim() ?? ''
  const letters = initials(name)
  return (
    <button
      type="button"
      onClick={() => navigate({ page: 'settings' })}
      className="flex w-full items-center gap-2.5 rounded-xl border border-line-soft p-2 text-left transition-colors hover:border-line"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-chip text-[12px] font-semibold text-fg">{letters || <User size={16} />}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px]">{name || t('profile.anonymous')}</span>
        <span className="block truncate text-[11.5px] text-faint">{t('profile.local')}</span>
      </span>
      <ChevronsUpDown size={16} className="shrink-0 text-faint" />
    </button>
  )
}

/** Progresso das atualizações de jogos em andamento (acima do perfil). */
function DownloadWidget() {
  const { items, progress, navigate } = useAppState()
  const { t } = useI18n()
  const active = items.filter((i) => i.busy && progress[i.entry.id])
  if (active.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      {active.map((item) => {
        const p = progress[item.entry.id]
        const pct = p.progress !== undefined ? Math.round(p.progress * 100) : null
        return (
          <button
            key={item.entry.id}
            type="button"
            onClick={() => navigate({ page: 'downloads' })}
            className="animate-fade-in rounded-xl border border-line px-3 pt-2.5 pb-3 text-left transition-colors hover:border-chip-line"
          >
            <span className="flex items-center gap-2 text-[12.5px]">
              <span className="min-w-0 flex-1 truncate">
                {item.name} {p.version}
              </span>
              <span className="shrink-0 font-mono text-[11px] text-subtle">{pct !== null ? `${pct}%` : t(`stage.${p.stage}`)}</span>
            </span>
            <ProgressBar value={p.progress} className="mt-2" />
          </button>
        )
      })}
    </div>
  )
}

export function Sidebar() {
  const { route, navigate, items, info, query, setQuery, progress } = useAppState()
  const { t } = useI18n()
  const statusLabel = useStatusLabel()
  const search = useRef<HTMLInputElement>(null)
  const updates = items.filter((i) => i.update.available).length
  const downloads = items.filter((i) => i.busy).length
  const is = (page: Route['page']) => route.page === page

  // Ctrl+K / Cmd+K foca a busca
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        search.current?.focus()
        search.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col px-3.5 pt-3.5 pb-3 max-lg:w-56">
      <div className="flex items-center gap-2.5 px-1.5 pt-1 pb-[18px]">
        <LogoMark />
        <span className="text-[15px] font-semibold tracking-[-0.01em]">{t('app.name')}</span>
        {info && <span className="ml-auto rounded-md border border-line px-1.5 py-0.5 font-mono text-[10.5px] text-faint">v{info.version}</span>}
      </div>

      <label className="mb-3.5 flex h-9 items-center gap-2 rounded-[10px] border border-field-line bg-field px-2.5">
        <Search size={15} className="shrink-0 text-subtle" />
        <input
          ref={search}
          value={query}
          placeholder={t('search.placeholder')}
          onChange={(e) => {
            setQuery(e.target.value)
            if (route.page !== 'library') navigate({ page: 'library' })
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setQuery('')
              e.currentTarget.blur()
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none"
        />
        <span className="flex gap-[3px]">
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </span>
      </label>

      <nav className="flex flex-col gap-0.5">
        <NavItem active={is('library')} icon="library" label={t('nav.library')} badge={updates} onClick={() => navigate({ page: 'library' })} />
        <NavItem active={is('downloads')} icon="downloads" label={t('nav.downloads')} badge={downloads} onClick={() => navigate({ page: 'downloads' })} />
        <NavItem active={is('settings')} icon="settings" label={t('nav.settings')} onClick={() => navigate({ page: 'settings' })} />
      </nav>

      <div className="mx-1 mt-4 mb-3.5 h-px bg-line-soft" />
      <div className="flex items-center justify-between px-2.5 pb-2">
        <span className="text-[11.5px] tracking-[0.04em] text-faint uppercase">{t('nav.games')}</span>
        <button
          type="button"
          aria-label={t('nav.add')}
          title={t('nav.add')}
          onClick={() => navigate({ page: 'add' })}
          className={`-mr-1 rounded-md p-0.5 transition-colors hover:text-fg ${is('add') ? 'text-fg' : 'text-subtle'}`}
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto">
        {items.map((item) => {
          const active = route.page === 'game' && route.id === item.entry.id
          const busy = item.busy && progress[item.entry.id]
          return (
            <button
              key={item.entry.id}
              type="button"
              onClick={() => navigate({ page: 'game', id: item.entry.id })}
              className={`flex h-9 shrink-0 items-center gap-2.5 rounded-[9px] px-2.5 text-left text-[13px] transition-colors ${
                active ? 'bg-hover text-fg' : 'text-muted hover:bg-hover/60 hover:text-fg'
              }`}
            >
              <GameTile item={item} />
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              {item.update.available && !busy && <ArrowDownToLine size={13} className="shrink-0 text-accent-fg" aria-label={t('badge.update')} />}
              <span title={statusLabel(item)}>
                <Dot tone={statusTone(item)} />
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <DownloadWidget />
        <div className="flex flex-col items-start gap-1">
          {/* alinhado com o avatar do cartão de perfil */}
          <div className="pl-[3px]">
            <AppUpdateButton />
          </div>
          <ProfileCard />
        </div>
      </div>
    </aside>
  )
}
