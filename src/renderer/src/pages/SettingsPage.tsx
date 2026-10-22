import { RefreshCw, ShieldCheck } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import type { RateLimitInfo, ThemeSetting } from '../../../shared/types'
import { Button, Chip, Dot, Page, PageHeader, SectionLabel, Toggle } from '../components/ui'
import { useI18n } from '../i18n'
import { errorMessage, initials } from '../lib/format'
import { useAppState } from '../state/AppState'

const LAUNCHER_REPO = 'https://github.com/Silvamenu/OpenLaucher'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-9">
      <SectionLabel>{title}</SectionLabel>
      <div className="divide-y divide-line overflow-hidden rounded-[14px] border border-line">{children}</div>
    </section>
  )
}

function Row({ title, hint, children }: { title: ReactNode; hint?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-[18px] py-4">
      <div className="min-w-[220px] flex-1">
        <div className="text-[13.5px] text-fg-2">{title}</div>
        {hint && <div className="mt-0.5 text-[12px] leading-relaxed text-subtle">{hint}</div>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

export function SettingsPage() {
  const { settings, updateSettings, items, setItems, manifests, setManifests, info, appUpdate, toast, openDevlog } = useAppState()
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

  const themes: { id: ThemeSetting; label: string }[] = [
    { id: 'dark', label: t('settings.theme.dark') },
    { id: 'light', label: t('settings.theme.light') },
    { id: 'system', label: t('settings.theme.system') }
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
        return undefined
    }
  })()

  return (
    <Page narrow>
      <PageHeader title={t('settings.title')} />

      <Section title={t('settings.profile')}>
        <Row title={t('settings.userName')} hint={t('settings.userNameHint')}>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-chip text-[12px] font-semibold">{initials(name) || '–'}</span>
          <input
            id="user-name"
            className="input w-56"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name !== settings.userName && void save(() => updateSettings({ userName: name }))}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        </Row>
      </Section>

      <Section title={t('settings.appearance')}>
        <Row title={t('settings.theme')}>
          {themes.map((th) => (
            <Chip key={th.id} active={settings.theme === th.id} onClick={() => void save(() => updateSettings({ theme: th.id }))}>
              {th.label}
            </Chip>
          ))}
        </Row>
        <Row title={t('settings.language')}>
          <Chip active={settings.language === 'pt-BR'} onClick={() => void save(() => updateSettings({ language: 'pt-BR' }))}>
            Português (Brasil)
          </Chip>
          <Chip active={settings.language === 'en'} onClick={() => void save(() => updateSettings({ language: 'en' }))}>
            English
          </Chip>
        </Row>
      </Section>

      <Section title={t('settings.updates')}>
        <div className="px-[18px] py-4">
          <Toggle checked={settings.checkGameUpdates} onChange={(v) => void save(() => updateSettings({ checkGameUpdates: v }))} label={t('settings.checkGames')} />
        </div>
        <div className="px-[18px] py-4">
          <Toggle checked={settings.notifications} onChange={(v) => void save(() => updateSettings({ notifications: v }))} label={t('settings.notifications')} />
        </div>
        <div className="px-[18px] py-4">
          <div className="mb-3 text-[13.5px] text-fg-2">{t('settings.autoPerGame')}</div>
          {items.length === 0 && <p className="text-[12px] text-subtle">{t('settings.noGames')}</p>}
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
        </div>
        <div className="px-[18px] py-4">
          <div className="flex flex-wrap items-center gap-2 text-[13.5px] text-fg-2">
            {t('settings.token')}
            {settings.hasGithubToken && (
              <span className="flex items-center gap-1.5 rounded-md border border-line px-1.5 py-0.5 text-[11.5px] text-fg-3">
                <Dot tone="ok" /> {t('settings.tokenSet')}
              </span>
            )}
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-subtle">{t('settings.tokenHint')}</p>
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
            <p className="mt-2 font-mono text-[11px] text-faint">
              {t('upd.rateLimit', {
                remaining: rateLimit.remaining,
                limit: rateLimit.limit,
                time: new Date(rateLimit.resetAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
              })}
            </p>
          )}
        </div>
      </Section>

      <Section title={t('settings.library')}>
        <Row title={t('settings.rescan')} hint={t('settings.rescanHint')}>
          <Button icon={<RefreshCw size={14} className={rescanning ? 'animate-spin' : ''} />} disabled={rescanning} onClick={rescan}>
            {t('settings.rescan')}
          </Button>
        </Row>
        <Row
          title={t('settings.openManifests')}
          hint={
            <>
              {t('settings.manifestsHint')}
              {info && <span className="selectable mt-1 block truncate font-mono text-[11px] text-faint">{info.manifestsUserPath}</span>}
            </>
          }
        >
          <Button onClick={() => info && void save(() => window.api.app.openPath(info.manifestsUserPath))}>{t('settings.openManifests')}</Button>
        </Row>
        {manifests.errors.length > 0 && (
          <div className="px-[18px] py-4">
            <div className="mb-2 flex items-center gap-2 text-[12.5px] text-fg-2">
              <Dot tone="bad" /> {t('settings.manifestErrors')}
            </div>
            <ul className="selectable space-y-1 text-[11.5px] text-subtle">
              {manifests.errors.map((e) => (
                <li key={e.file}>
                  <span className="font-mono">{e.file}</span>: {e.message}
                </li>
              ))}
            </ul>
          </div>
        )}
        <Row title={t('settings.openData')}>
          <Button variant="ghost" onClick={() => info && void save(() => window.api.app.openPath(info.userDataPath))}>
            {t('settings.open')}
          </Button>
        </Row>
      </Section>

      <Section title={t('settings.about')}>
        <Row title="RecompHub" hint={<span className="font-mono">{t('settings.version', { version: info?.version ?? '' })}</span>}>
          <Button onClick={() => void save(async () => openDevlog(await window.api.devlog.current()))}>{t('settings.whatsNew')}</Button>
          <Button variant="ghost" onClick={() => void window.api.app.openExternal(LAUNCHER_REPO)}>
            GitHub
          </Button>
        </Row>
        <Row title={t('settings.checkApp')} hint={appUpdateText}>
          <Button
            icon={<RefreshCw size={14} className={appUpdate.status === 'checking' ? 'animate-spin' : ''} />}
            disabled={!info?.isPackaged || appUpdate.status === 'checking'}
            onClick={() => void save(() => window.api.appUpdate.check())}
          >
            {t('settings.checkNow')}
          </Button>
        </Row>
      </Section>

      <p className="flex items-start gap-2 text-[12px] text-faint">
        <ShieldCheck size={14} className="mt-px shrink-0" />
        {t('legal.note')}
      </p>
    </Page>
  )
}
