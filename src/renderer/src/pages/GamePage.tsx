import { ArrowLeft, Clock, EllipsisVertical, ExternalLink, FolderOpen, FolderSearch, Image, ImageOff, Pencil, Play, TriangleAlert, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { collectTodos, executablesFor, launchArgsFor } from '../../../shared/manifest'
import type { LibraryItem } from '../../../shared/types'
import { GameArt, accentOf, artBackground } from '../components/GameArt'
import { StatusBadge, UpdateBadge } from '../components/StatusBadge'
import { Button, Card, ConfirmModal, PromptModal } from '../components/ui'
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
      className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition hover:bg-subtle ${danger ? 'text-red-500' : ''}`}
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
  const rows: [string, ReactNode][] = [
    [t('about.original'), m.originalGame ?? '—'],
    [
      t('about.repo'),
      <button key="repo" type="button" className="inline-flex items-center gap-1 text-accent hover:underline" onClick={() => void window.api.app.openExternal(m.repoUrl)}>
        {m.repoUrl.replace('https://github.com/', '')} <ExternalLink size={12} />
      </button>
    ],
    ...(m.website
      ? ([
          [
            t('about.website'),
            <button key="site" type="button" className="inline-flex items-center gap-1 text-accent hover:underline" onClick={() => void window.api.app.openExternal(m.website!)}>
              {m.website.replace('https://', '')} <ExternalLink size={12} />
            </button>
          ]
        ] as [string, ReactNode][])
      : []),
    [t('about.executables'), <code key="exe" className="font-mono text-xs">{executablesFor(m, platform).join(', ') || '—'}</code>],
    [t('about.launchArgs'), <code key="args" className="font-mono text-xs">{launchArgsFor(m, platform).join(' ') || t('about.none')}</code>],
    [t('game.folder'), <span key="folder" className="selectable font-mono text-xs break-all">{item.entry.path}</span>],
    [t('about.manifest'), `${m.id}.json — ${m.origin === 'user' ? t('about.manifestUser') : t('about.manifestBuiltin')}`],
    [t('about.added'), formatDate(item.entry.addedAt, locale)],
    [t('about.launches'), String(item.entry.launchCount)]
  ]
  return (
    <Card className="p-5">
      {m.description && <p className="mb-4 max-w-3xl text-sm leading-relaxed">{m.description}</p>}
      <dl className="grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-[180px_1fr]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd className="min-w-0">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

export function GamePage({ id, tab }: { id: string; tab?: GameTab }) {
  const { items, navigate, toast } = useAppState()
  const { t, locale } = useI18n()
  const item = items.find((i) => i.entry.id === id)
  const [activeTab, setActiveTab] = useState<GameTab>(tab ?? 'setup')
  const [menu, setMenu] = useState(false)
  const [dialog, setDialog] = useState<'rename' | 'remove' | null>(null)
  const [launching, setLaunching] = useState(false)
  const [todosOpen, setTodosOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (tab) setActiveTab(tab)
  }, [tab, id])

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
        <Button icon={<ArrowLeft size={16} />} onClick={() => navigate({ page: 'library' })}>
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

  const todos = item.manifest ? collectTodos(item.manifest) : []
  const canLaunch = item.status !== 'missingFolder' && item.status !== 'unknownManifest' && !item.running && !item.busy
  const tabs: { id: GameTab; label: string; badge?: boolean }[] = [
    { id: 'setup', label: t('game.tabs.setup'), badge: item.status === 'needsSetup' },
    { id: 'configs', label: t('game.tabs.configs') },
    { id: 'updates', label: t('game.tabs.updates'), badge: item.update.available },
    { id: 'about', label: t('game.tabs.about') }
  ]

  return (
    <div className="min-h-full">
      {/* Cabeçalho */}
      <div className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 opacity-60 dark:opacity-45" style={{ background: artBackground(accentOf(item)) }} />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/80 to-bg/10" />
        <div className="relative mx-auto max-w-[1400px] px-6 pt-5 pb-6 lg:px-8">
          <button type="button" onClick={() => navigate({ page: 'library' })} className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-fg">
            <ArrowLeft size={16} /> {t('game.back')}
          </button>
          <div className="flex flex-wrap items-end gap-6">
            <div className="h-36 w-28 shrink-0 overflow-hidden rounded-xl border border-white/10 shadow-2xl shadow-black/40">
              <GameArt item={item} iconSize={56} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap gap-2">
                <StatusBadge item={item} />
                {item.update.available && <UpdateBadge />}
              </div>
              <h1 className="truncate text-3xl font-extrabold tracking-tight">{item.name}</h1>
              {item.manifest?.originalGame && <p className="truncate text-sm text-muted">{item.manifest.originalGame}</p>}
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
                <span>
                  {t('game.version')}: <strong className="text-fg">{item.entry.installedVersion ?? t('upd.unknown')}</strong>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock size={12} /> {t('game.playtime')}: <strong className="text-fg">{formatPlaytime(item.entry.totalPlayTimeSec)}</strong>
                </span>
                <span>
                  {t('game.lastPlayed')}:{' '}
                  <strong className="text-fg" title={formatDate(item.entry.lastPlayedAt, locale, true)}>
                    {item.entry.lastPlayedAt ? formatRelative(item.entry.lastPlayedAt, t, locale) : t('game.never')}
                  </strong>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={item.status === 'ready' ? 'success' : 'primary'}
                size="lg"
                icon={<Play size={18} fill="currentColor" />}
                loading={launching}
                disabled={!canLaunch}
                onClick={launch}
                className="min-w-36"
              >
                {item.running ? t('game.running') : item.status === 'ready' ? t('game.play') : t('game.playAnyway')}
              </Button>
              <Button size="lg" icon={<FolderOpen size={18} />} onClick={() => act(() => window.api.library.openFolder(id))} disabled={item.status === 'missingFolder'} aria-label={t('game.openFolder')} title={t('game.openFolder')} />
              <div className="relative" ref={menuRef}>
                <Button size="lg" icon={<EllipsisVertical size={18} />} aria-label={t('game.more')} title={t('game.more')} onClick={() => setMenu((m) => !m)} />
                {menu && (
                  <div className="animate-pop-in absolute right-0 z-30 mt-2 w-60 rounded-xl border border-line bg-elevated p-1.5 shadow-2xl">
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
                    <div className="my-1 border-t border-line" />
                    <MenuItem icon={<Trash2 size={15} />} danger onClick={() => (setMenu(false), setDialog('remove'))}>
                      {t('game.remove')}
                    </MenuItem>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-6 py-6 lg:px-8">
        {item.status === 'missingFolder' && (
          <div className="mb-5 flex flex-wrap items-center gap-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <TriangleAlert size={22} className="shrink-0 text-red-500" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{t('game.missingFolder.title')}</div>
              <div className="selectable text-sm break-all text-muted">{t('game.missingFolder.body', { path: item.entry.path })}</div>
            </div>
            <Button variant="primary" icon={<FolderSearch size={16} />} onClick={() => act(() => window.api.library.changeFolder(id))}>
              {t('game.missingFolder.locate')}
            </Button>
            <Button variant="ghost" icon={<Trash2 size={16} />} onClick={() => setDialog('remove')}>
              {t('game.remove')}
            </Button>
          </div>
        )}

        {todos.length > 0 && (
          <div className="mb-5 rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-sm">
            <button type="button" onClick={() => setTodosOpen((o) => !o)} className="flex w-full items-center gap-2 text-left text-amber-700 dark:text-amber-300">
              <TriangleAlert size={16} className="shrink-0" />
              <span className="flex-1 font-medium">{t('game.todo.title')}</span>
              <span className="text-xs">{todosOpen ? '−' : `+${todos.length}`}</span>
            </button>
            {todosOpen && (
              <ul className="mt-2 ml-6 list-disc space-y-1 text-xs text-muted">
                {todos.map((todo) => (
                  <li key={todo}>{todo}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mb-5 flex flex-wrap gap-x-1 border-b border-line" role="tablist">
          {tabs.map((tb) => (
            <button
              key={tb.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tb.id}
              onClick={() => setActiveTab(tb.id)}
              className={`relative -mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition ${
                activeTab === tb.id ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg'
              }`}
            >
              {tb.label}
              {tb.badge && <span className="h-2 w-2 rounded-full bg-accent" />}
            </button>
          ))}
        </div>

        {activeTab === 'setup' && <ChecklistTab item={item} onLaunch={launch} />}
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
