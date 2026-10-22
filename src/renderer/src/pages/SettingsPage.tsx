import { ExternalLink, FolderOpen, KeyRound, Monitor, Moon, RefreshCw, ShieldCheck, Sparkles, Sun, TriangleAlert } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import type { RateLimitInfo, ThemeSetting } from '../../../shared/types'
import { Avatar } from '../components/Sidebar'
import { Button, Card, Toggle } from '../components/ui'
import { useI18n } from '../i18n'
import { errorMessage } from '../lib/format'
import { useAppState } from '../state/AppState'

const LAUNCHER_REPO = 'https://github.com/Silvamenu/OpenLaucher'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">{title}</h2>
      <Card className="divide-y divide-line">{children}</Card>
    </section>
  )
}

function Row({ children }: { children: ReactNode }) {
  return <div className="p-4">{children}</div>
}

export function SettingsPage() {
  const { settings, updateSettings, items, setItems, manifests, setManifests, info, appUpdate, toast, openDevlog, navigate } = useAppState()
  const { t } = useI18n()
  const [name, setName] = useState(settings?.userName ?? '')
  const [token, setToken] = useState('')
  const [rescanning, setRescanning] = useState(false)
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null)

  useEffect(() => setName(settings?.userName ?? ''), [settings?.userName])
  useEffect(() => {
    void window.api.updates.rateLimit().then(setRateLimit)
  }, [settings?.hasGithubToken])

  if (!settings) return null

  const save = async (fn: () => Promise<unknown>, success?: string) => {
    try {
      await fn()
      if (success) toast('success', success)
    } catch (err) {
      toast('error', errorMessage(err, t))
    }
  }

  const rescan = async () => {
    setRescanning(true)
    try {
      setItems(await window.api.library.rescan())
      setManifests(await window.api.manifests.list())
      toast('success', t('settings.rescanned'))
    } catch (err) {
      toast('error', errorMessage(err, t))
    } finally {
      setRescanning(false)
    }
  }

  const themes: { id: ThemeSetting; label: string; icon: ReactNode }[] = [
    { id: 'dark', label: t('settings.theme.dark'), icon: <Moon size={15} /> },
    { id: 'light', label: t('settings.theme.light'), icon: <Sun size={15} /> },
    { id: 'system', label: t('settings.theme.system'), icon: <Monitor size={15} /> }
  ]

  const appUpdateText = (() => {
    switch (appUpdate.status) {
      case 'disabled':
        return t('settings.appUpdate.disabled')
      case 'checking':
        return t('settings.appUpdate.checking')
      case 'not-available':
        return t('settings.appUpdate.none')
      case 'available':
      case 'downloading':
        return t('settings.appUpdate.available', { version: appUpdate.version ?? '' })
      case 'downloaded':
        return t('settings.appUpdate.ready', { version: appUpdate.version ?? '' })
      case 'error':
        return t('settings.appUpdate.error', { error: appUpdate.error ?? '' })
      default:
        return ''
    }
  })()

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-6 py-8 lg:px-8">
      <h1 className="text-2xl font-bold tracking-tight">{t('settings.title')}</h1>

      <Section title={t('settings.profile')}>
        <Row>
          <label className="text-sm font-medium" htmlFor="user-name">
            {t('settings.userName')}
          </label>
          <div className="mt-2 flex items-center gap-3">
            <Avatar onClick={() => document.getElementById('user-name')?.focus()} />
            <input
              id="user-name"
              className="input w-full max-w-xs"
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name !== settings.userName && void save(() => updateSettings({ userName: name }))}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted">{t('settings.userNameHint')}</p>
        </Row>
      </Section>

      <Section title={t('settings.appearance')}>
        <Row>
          <div className="mb-2 text-sm font-medium">{t('settings.theme')}</div>
          <div className="inline-flex rounded-lg border border-line p-1">
            {themes.map((th) => (
              <button
                key={th.id}
                type="button"
                onClick={() => void save(() => updateSettings({ theme: th.id }))}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${settings.theme === th.id ? 'bg-accent text-white' : 'text-muted hover:text-fg'}`}
              >
                {th.icon}
                {th.label}
              </button>
            ))}
          </div>
        </Row>
        <Row>
          <label className="mb-2 block text-sm font-medium" htmlFor="language">
            {t('settings.language')}
          </label>
          <select
            id="language"
            className="input"
            value={settings.language}
            onChange={(e) => void save(() => updateSettings({ language: e.target.value as 'pt-BR' | 'en' }))}
          >
            <option value="pt-BR">Português (Brasil)</option>
            <option value="en">English</option>
          </select>
        </Row>
      </Section>

      <Section title={t('settings.updates')}>
        <Row>
          <Toggle checked={settings.checkGameUpdates} onChange={(v) => void save(() => updateSettings({ checkGameUpdates: v }))} label={t('settings.checkGames')} />
        </Row>
        <Row>
          <Toggle checked={settings.notifications} onChange={(v) => void save(() => updateSettings({ notifications: v }))} label={t('settings.notifications')} />
        </Row>
        <Row>
          <div className="mb-3 text-sm font-medium">{t('settings.autoPerGame')}</div>
          {items.length === 0 && <p className="text-xs text-muted">{t('settings.noGames')}</p>}
          <div className="space-y-3">
            {items.map((item) => (
              <Toggle
                key={item.entry.id}
                checked={item.entry.autoUpdate}
                disabled={item.manifest?.updates.source !== 'github-releases'}
                onChange={(v) => void save(() => window.api.library.update(item.entry.id, { autoUpdate: v }))}
                label={item.name}
                hint={item.manifest?.updates.source !== 'github-releases' ? t('upd.noBinaries.title') : undefined}
              />
            ))}
          </div>
        </Row>
        <Row>
          <div className="flex items-center gap-2 text-sm font-medium">
            <KeyRound size={15} className="text-muted" /> {t('settings.token')}
            {settings.hasGithubToken && (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">{t('settings.tokenSet')}</span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted">{t('settings.tokenHint')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              type="password"
              className="input w-full max-w-sm font-mono"
              placeholder="ghp_… / github_pat_…"
              value={token}
              autoComplete="off"
              onChange={(e) => setToken(e.target.value)}
            />
            <Button
              variant="primary"
              disabled={!token.trim()}
              onClick={() =>
                void save(async () => {
                  await updateSettings({ githubToken: token.trim() })
                  setToken('')
                }, t('settings.tokenSaved'))
              }
            >
              {t('settings.tokenSave')}
            </Button>
            {settings.hasGithubToken && (
              <Button variant="ghost" onClick={() => void save(() => updateSettings({ githubToken: '' }), t('settings.tokenRemoved'))}>
                {t('settings.tokenRemove')}
              </Button>
            )}
          </div>
          {rateLimit && (
            <p className="mt-2 text-[11px] text-muted">
              {t('upd.rateLimit', {
                remaining: rateLimit.remaining,
                limit: rateLimit.limit,
                time: new Date(rateLimit.resetAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
              })}
            </p>
          )}
        </Row>
      </Section>

      <Section title={t('settings.library')}>
        <Row>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">{t('settings.rescan')}</div>
              <p className="text-xs text-muted">{t('settings.rescanHint')}</p>
            </div>
            <Button icon={<RefreshCw size={15} className={rescanning ? 'animate-spin' : ''} />} disabled={rescanning} onClick={rescan}>
              {t('settings.rescan')}
            </Button>
          </div>
        </Row>
        <Row>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">{t('settings.openManifests')}</div>
              <p className="text-xs text-muted">{t('settings.manifestsHint')}</p>
              {info && <p className="selectable mt-1 truncate font-mono text-[11px] text-muted">{info.manifestsUserPath}</p>}
            </div>
            <Button icon={<FolderOpen size={15} />} onClick={() => info && void save(() => window.api.app.openPath(info.manifestsUserPath))}>
              {t('settings.openManifests')}
            </Button>
          </div>
          {manifests.errors.length > 0 && (
            <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/8 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-red-500">
                <TriangleAlert size={14} /> {t('settings.manifestErrors')}
              </div>
              <ul className="selectable space-y-1 text-[11px] text-muted">
                {manifests.errors.map((e) => (
                  <li key={e.file}>
                    <span className="font-mono">{e.file}</span>: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Row>
        <Row>
          <Button variant="ghost" icon={<FolderOpen size={15} />} onClick={() => info && void save(() => window.api.app.openPath(info.userDataPath))}>
            {t('settings.openData')}
          </Button>
        </Row>
      </Section>

      <Section title={t('settings.about')}>
        <Row>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">RecompHub</div>
              <div className="text-xs text-muted">{t('settings.version', { version: info?.version ?? '' })}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button icon={<Sparkles size={15} />} onClick={() => void save(async () => openDevlog(await window.api.devlog.current()))}>
                {t('settings.whatsNew')}
              </Button>
              <Button
                icon={<RefreshCw size={15} className={appUpdate.status === 'checking' ? 'animate-spin' : ''} />}
                disabled={!info?.isPackaged || appUpdate.status === 'checking'}
                onClick={() => void save(() => window.api.appUpdate.check())}
              >
                {t('settings.checkApp')}
              </Button>
              <Button variant="ghost" icon={<ExternalLink size={15} />} onClick={() => void window.api.app.openExternal(LAUNCHER_REPO)}>
                GitHub
              </Button>
            </div>
          </div>
          {appUpdateText && <p className="mt-2 text-xs text-muted">{appUpdateText}</p>}
        </Row>
        <Row>
          <p className="flex items-start gap-2 text-xs text-muted">
            <ShieldCheck size={15} className="mt-px shrink-0 text-emerald-500" />
            {t('legal.note')}
          </p>
          <button type="button" className="mt-2 text-xs text-accent hover:underline" onClick={() => navigate({ page: 'add' })}>
            {t('add.supported')} →
          </button>
        </Row>
      </Section>
    </div>
  )
}
