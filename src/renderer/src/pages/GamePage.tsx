import { ChevronLeft, FolderSearch, Image, ImageOff, Pencil, Play, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { collectTodos, executablesFor, launchArgsFor } from '../../../shared/manifest'
import type { LibraryItem, RequirementsReport } from '../../../shared/types'
import { GameCover, coverGradient, coverUrl, hueOfItem } from '../components/GameArt'
import { GearIcon } from '../components/icons'
import { statusTone, useStatusLabel } from '../components/Status'
import { Button, Card, Chip, ConfirmModal, Dot, PromptModal } from '../components/ui'
import { useI18n } from '../i18n'
import { errorMessage, formatDate, formatPlaytime, formatRelative } from '../lib/format'
import { useAppState, type GameTab } from '../state/AppState'
import { ChecklistTab } from './game/ChecklistTab'
import { ConfigsTab } from './game/ConfigsTab'
import { UpdatesTab } from './game/UpdatesTab'

function MenuItem({ icon, children, onClick, danger }: { icon: ReactNode; children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-hover ${danger ? 'text-bad' : 'text-fg-2'}`}
    >
      {icon}
      {children}
    </button>
  )
}

function AboutTab({ item }: { item: LibraryItem }) {
  const { t, locale } = useI18n()
  const { info } = useAppState()
  const m = item.manifest
  if (!m) return null
  const platform = info?.platform ?? 'win32'
  const link = (url: string, label: string) => (
    <button type="button" className="text-link hover:underline" onClick={() => void window.api.app.openExternal(url)}>
      {label}
    </button>
  )
  const rows: [string, ReactNode][] = [
    [t('about.original'), m.originalGame ?? '—'],
    [t('about.repo'), link(m.repoUrl, m.repoUrl.replace('https://github.com/', ''))],
    ...(m.website ? ([[t('about.website'), link(m.website, m.website.replace('https://', ''))]] as [string, ReactNode][]) : []),
    [
      t('about.executables'),
      <span key="exe" className="font-mono text-[12.5px]">
        {executablesFor(m, platform).join(', ') || '—'}
      </span>
    ],
    [
      t('about.launchArgs'),
      <span key="args" className="font-mono text-[12.5px]">
        {launchArgsFor(m, platform).join(' ') || t('about.none')}
      </span>
    ],
    [
      t('about.manifest'),
      <span key="m">
        <span className="font-mono text-[12.5px]">{m.id}.json</span> · {m.origin === 'user' ? t('about.manifestUser') : t('about.manifestBuiltin')}
      </span>
    ],
    [t('about.added'), formatDate(item.entry.addedAt, locale)],
    [t('about.launches'), String(item.entry.launchCount)]
  ]
  return (
    <div className="max-w-[760px]">
      {m.description && <p className="mb-6 text-[13.5px] leading-relaxed text-fg-3">{m.description}</p>}
      <Card className="divide-y divide-line overflow-hidden">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 px-[18px] py-3 text-[13.5px] sm:grid-cols-[200px_1fr]">
            <div className="text-faint">{label}</div>
            <div className="min-w-0 break-words">{value}</div>
          </div>
        ))}
      </Card>
    </div>
  )
}

export function GamePage({ id, tab }: { id: string; tab?: GameTab }) {
  const { items, navigate, toast, progress } = useAppState()
  const { t, locale } = useI18n()
  const statusLabel = useStatusLabel()
  const item = items.find((i) => i.entry.id === id)
  const [activeTab, setActiveTab] = useState<GameTab>(tab ?? 'setup')
  const [report, setReport] = useState<RequirementsReport | null>(null)
  const [menu, setMenu] = useState(false)
  const [dialog, setDialog] = useState<'rename' | 'remove' | null>(null)
  const [launching, setLaunching] = useState(false)
  const [todosOpen, setTodosOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLDivElement>(null)

  // Uma notificação pode abrir o mesmo jogo em outra aba: ajusta o estado durante o render.
  const [requestedTab, setRequestedTab] = useState(tab)
  if (tab !== requestedTab) {
    setRequestedTab(tab)
    if (tab) setActiveTab(tab)
  }

  // Requisitos recarregados sempre que a biblioteca muda (ex.: arquivos gerados após abrir o jogo).
  useEffect(() => {
    let alive = true
    void window.api.library
      .requirements(id)
      .then((r) => alive && setReport(r))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [id, item])

  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [menu])

  if (!item) {
    return (
      <div className="p-8">
        <Button icon={<ChevronLeft size={16} />} onClick={() => navigate({ page: 'library' })}>
          {t('game.back')}
        </Button>
      </div>
    )
  }

  const act = async (fn: () => Promise<unknown>) => {
    setMenu(false)
    try {
      await fn()
    } catch (err) {
      toast('error', errorMessage(err, t))
    }
  }

  const launch = async () => {
    setLaunching(true)
    try {
      await window.api.library.launch(id)
    } catch (err) {
      toast('error', errorMessage(err, t))
    } finally {
      setLaunching(false)
    }
  }

  const showSection = (next: GameTab) => {
    setActiveTab(next)
    setTimeout(() => sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30)
  }

  const startUpdate = () =>
    act(async () => {
      try {
        await window.api.updates.start(id)
        toast('success', t('upd.updated', { name: item.name, version: item.update.latest?.tag ?? '' }))
      } catch (err) {
        if ((err as { code?: string }).code === 'GAME_RUNNING') showSection('updates')
        if ((err as { code?: string }).code !== 'CANCELLED') throw err
      }
    })

  const p = progress[id]
  const pending = report?.items.find((r) => !r.ok && !r.optional)
  const todos = item.manifest ? collectTodos(item.manifest) : []
  const cover = coverUrl(item)
  const canLaunch = item.status !== 'missingFolder' && item.status !== 'unknownManifest' && !item.running && !item.busy && !!report?.executable

  const primary = (() => {
    if (item.running)
      return (
        <Button variant="primary" size="lg" disabled icon={<Play size={13} fill="currentColor" />}>
          {t('game.running')}
        </Button>
      )
    if (item.status === 'missingFolder')
      return (
        <Button variant="primary" size="lg" icon={<FolderSearch size={16} />} onClick={() => act(() => window.api.library.changeFolder(id))}>
          {t('game.missingFolder.locate')}
        </Button>
      )
    if (item.status === 'needsSetup')
      return (
        <Button variant="primary" size="lg" icon={<SlidersHorizontal size={15} />} onClick={() => showSection('setup')}>
          {t('game.configure')}
        </Button>
      )
    return (
      <Button
        variant="primary"
        size="lg"
        className="font-semibold"
        icon={<Play size={13} fill="currentColor" />}
        loading={launching}
        disabled={!canLaunch}
        onClick={launch}
      >
        {t('game.play')}
      </Button>
    )
  })()

  const info: [string, string][] = [
    [t('game.version'), item.entry.installedVersion ?? t('upd.unknown')],
    [t('game.lastPlayed'), item.entry.lastPlayedAt ? formatRelative(item.entry.lastPlayedAt, t, locale) : t('game.never')],
    [t('game.playtime'), item.entry.totalPlayTimeSec > 0 ? formatPlaytime(item.entry.totalPlayTimeSec) : '—'],
    [t('game.status'), statusLabel(item)]
  ]

  const tabs: { id: GameTab; label: string }[] = [
    { id: 'setup', label: t('game.tabs.setup') },
    { id: 'configs', label: t('game.tabs.configs') },
    { id: 'updates', label: t('game.tabs.updates') },
    { id: 'about', label: t('game.tabs.about') }
  ]

  return (
    <div className="min-h-full">
      {/* Arte de fundo */}
      <div className="relative h-[300px] overflow-hidden" style={{ background: coverGradient(hueOfItem(item)) }}>
        {cover && <img src={cover} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" draggable={false} />}
        <div className="stripes absolute inset-0" />
        <div className="absolute inset-0 bg-[linear-gradient(rgb(0_0_0/0)_30%,var(--panel)_100%)]" />
        <button
          type="button"
          onClick={() => navigate({ page: 'library' })}
          className="absolute top-[18px] left-6 flex h-8 items-center gap-1.5 rounded-[9px] bg-[#111112]/55 pr-3 pl-2 text-[13px] text-[#ededee] backdrop-blur-md transition-colors hover:bg-[#111112]/75"
        >
          <ChevronLeft size={16} strokeWidth={2} />
          {t('game.back')}
        </button>
      </div>

      <div className="relative -mt-[84px] max-w-[980px] px-10 pb-12 max-md:px-6">
        <div className="flex flex-wrap items-end gap-[22px]">
          <div className="h-[150px] w-[120px] shrink-0 overflow-hidden rounded-xl border border-white/10 shadow-[0_20px_40px_rgb(0_0_0/0.4)]">
            <GameCover item={item} fontSize={30} />
          </div>
          <div className="min-w-[240px] flex-1 pb-1">
            {item.manifest?.originalGame && <div className="mb-1.5 text-[13px] text-muted">{item.manifest.originalGame}</div>}
            <h1 className="text-[34px] leading-[1.05] font-semibold tracking-[-0.03em]">{item.name}</h1>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap gap-2">
          {primary}
          {item.update.available && item.update.latest && item.update.assetName !== null && (
            <Button variant="accent" size="lg" disabled={item.busy || item.running} onClick={startUpdate}>
              {item.busy && p?.kind === 'update'
                ? `${t(`stage.${p.stage}`)}${p.progress !== undefined ? ` ${Math.round(p.progress * 100)}%` : ''}`
                : t('upd.update', { version: item.update.latest.tag })}
            </Button>
          )}
          <div className="relative" ref={menuRef}>
            <Button size="lg" icon={<GearIcon />} aria-label={t('game.more')} title={t('game.more')} onClick={() => setMenu((m) => !m)} />
            {menu && (
              <div className="animate-pop-in absolute left-0 z-30 mt-2 w-64 rounded-xl border border-control-line bg-control p-1.5 shadow-[0_20px_50px_var(--shadow)]">
                <MenuItem icon={<SlidersHorizontal size={15} />} onClick={() => (setMenu(false), showSection('configs'))}>
                  {t('game.tabs.configs')}
                </MenuItem>
                <MenuItem icon={<Pencil size={15} />} onClick={() => (setMenu(false), setDialog('rename'))}>
                  {t('game.rename')}
                </MenuItem>
                <MenuItem icon={<FolderSearch size={15} />} onClick={() => act(() => window.api.library.changeFolder(id))}>
                  {t('game.changeFolder')}
                </MenuItem>
                <MenuItem icon={<Image size={15} />} onClick={() => act(() => window.api.library.pickCover(id))}>
                  {t('game.setCover')}
                </MenuItem>
                {item.entry.coverVersion && (
                  <MenuItem icon={<ImageOff size={15} />} onClick={() => act(() => window.api.library.clearCover(id))}>
                    {t('game.clearCover')}
                  </MenuItem>
                )}
                <div className="mx-1 my-1 h-px bg-line" />
                <MenuItem icon={<Trash2 size={15} />} danger onClick={() => (setMenu(false), setDialog('remove'))}>
                  {t('game.remove')}
                </MenuItem>
              </div>
            )}
          </div>
        </div>

        {(item.status === 'needsSetup' || item.status === 'missingFolder') && (
          <button
            type="button"
            onClick={() => (item.status === 'missingFolder' ? act(() => window.api.library.changeFolder(id)) : showSection('setup'))}
            className="mt-5 flex w-full max-w-[560px] items-center gap-3 rounded-xl border border-line px-4 py-3 text-left text-[13px] text-fg-3 transition-colors hover:border-chip-line"
          >
            <Dot tone={statusTone(item)} />
            <span className="min-w-0 flex-1">
              {item.status === 'missingFolder'
                ? t('game.note.missing')
                : pending
                  ? t('game.note.setup', { label: pending.type === 'executable' ? t('req.executable') : pending.label })
                  : t('status.needsSetup')}
            </span>
          </button>
        )}

        <div className="mt-9 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] overflow-hidden rounded-[14px] border border-line">
          {info.map(([label, value]) => (
            <div key={label} className="border-r border-line px-[18px] py-4 last:border-r-0">
              <div className="mb-1.5 text-[12px] text-faint">{label}</div>
              <div className="truncate text-[14px]" title={value}>
                {value}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-7 flex min-w-0 items-center gap-2.5 text-[12.5px] text-subtle">
          <span className="selectable min-w-0 truncate font-mono" title={item.entry.path}>
            {item.entry.path}
          </span>
          <span className="shrink-0 text-ghost">·</span>
          {item.status === 'missingFolder' ? (
            <button type="button" className="shrink-0 text-link hover:underline" onClick={() => act(() => window.api.library.changeFolder(id))}>
              {t('game.missingFolder.locate')}
            </button>
          ) : (
            <button type="button" className="shrink-0 text-link hover:underline" onClick={() => act(() => window.api.library.openFolder(id))}>
              {t('game.openFolder')}
            </button>
          )}
        </div>

        {todos.length > 0 && (
          <div className="mt-3 text-[12px] text-faint">
            <button type="button" onClick={() => setTodosOpen((o) => !o)} className="flex items-center gap-2 hover:text-subtle">
              <Dot tone="warn" />
              {t('game.todo.title')} ({todos.length})
            </button>
            {todosOpen && (
              <ul className="mt-2 ml-4 list-disc space-y-1">
                {todos.map((todo) => (
                  <li key={todo}>{todo}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div ref={sectionRef} className="mt-10 mb-5 flex scroll-mt-6 flex-wrap gap-1.5" role="tablist">
          {tabs.map((tb) => (
            <Chip key={tb.id} active={activeTab === tb.id} onClick={() => setActiveTab(tb.id)}>
              <span className="flex items-center gap-2">
                {tb.label}
                {tb.id === 'setup' && item.status === 'needsSetup' && <Dot tone="warn" />}
                {tb.id === 'updates' && item.update.available && <Dot tone="info" />}
              </span>
            </Chip>
          ))}
        </div>

        {activeTab === 'setup' && <ChecklistTab item={item} report={report} onReport={setReport} onLaunch={launch} />}
        {activeTab === 'configs' && <ConfigsTab item={item} />}
        {activeTab === 'updates' && <UpdatesTab item={item} />}
        {activeTab === 'about' && <AboutTab item={item} />}
      </div>

      {dialog === 'rename' && (
        <PromptModal
          title={t('game.renamePrompt')}
          initial={item.name}
          confirmLabel={t('common.save')}
          cancelLabel={t('common.cancel')}
          onCancel={() => setDialog(null)}
          onConfirm={(value) => {
            setDialog(null)
            void act(() => window.api.library.update(id, { customName: value.trim() === item.manifest?.name ? null : value }))
          }}
        />
      )}
      {dialog === 'remove' && (
        <ConfirmModal
          title={t('game.remove')}
          body={t('game.removeConfirm', { name: item.name })}
          confirmLabel={t('game.remove')}
          cancelLabel={t('common.cancel')}
          danger
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            setDialog(null)
            void act(async () => {
              await window.api.library.remove(id)
              navigate({ page: 'library' })
            })
          }}
        />
      )}
    </div>
  )
}
