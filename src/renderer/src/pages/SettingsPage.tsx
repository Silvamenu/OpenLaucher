import { Lock, RefreshCw, ShieldCheck } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { PIN_PATTERN, PROFILE_COLORS, PROFILE_NAME_MAX } from '../../../shared/profile'
import type { ProfilePatch, ProfileView, RateLimitInfo, ThemeSetting } from '../../../shared/types'
import { ProfileAvatar } from '../components/ProfileAvatar'
import { Button, Chip, ConfirmModal, Dot, Page, PageHeader, Pill, SectionLabel, Toggle } from '../components/ui'
import { useI18n } from '../i18n'
import { errorMessage, formatRateLimit } from '../lib/format'
import { useAppState } from '../state/AppState'

const LAUNCHER_REPO = 'https://github.com/Silvamenu/Relaunch'

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

type Save = (fn: () => Promise<unknown>, success?: string) => Promise<void>

/** Perfil em uso (nome, cor, PIN, exportar) e a lista de perfis deste computador. */
function ProfileSettings({ save }: { save: Save }) {
  const { profiles, setProfiles, toast } = useAppState()
  const { t } = useI18n()
  const current = profiles?.current
  const [name, setName] = useState(current?.name ?? '')
  const [newPin, setNewPin] = useState<string | null>(null)
  const [removing, setRemoving] = useState<ProfileView | null>(null)

  // Mantém o campo em sincronia se o nome mudar por fora.
  const [savedName, setSavedName] = useState(current?.name ?? '')
  if ((current?.name ?? '') !== savedName) {
    setSavedName(current?.name ?? '')
    setName(current?.name ?? '')
  }
  if (!profiles || !current) return null

  const update = (patch: ProfilePatch, success?: string) => save(async () => setProfiles(await window.api.profiles.update(current.id, patch)), success)
  const rename = () => {
    if (!name.trim()) setName(current.name)
    else if (name !== current.name) void update({ name })
  }
  const savePin = async () => {
    if (newPin === null || !PIN_PATTERN.test(newPin)) return
    await update({ pin: newPin }, t('settings.profilePinSaved'))
    setNewPin(null)
  }

  return (
    <>
      <Section title={t('settings.profile')}>
        <Row title={t('settings.profileName')} hint={t('settings.profileNameHint')}>
          <ProfileAvatar profile={{ name, color: current.color }} size={32} fontSize={12} />
          <input
            id="profile-name"
            className="input w-56"
            value={name}
            maxLength={PROFILE_NAME_MAX}
            onChange={(e) => setName(e.target.value)}
            onBlur={rename}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        </Row>
        <Row title={t('settings.profileColor')}>
          {PROFILE_COLORS.slice(0, 4).map((bg, i) => (
            <button
              key={bg}
              type="button"
              aria-label={`${t('settings.profileColor')} ${i + 1}`}
              aria-pressed={i === current.color}
              onClick={() => void update({ color: i })}
              className="h-7 w-7 rounded-full"
              style={{ background: bg, boxShadow: `0 0 0 2px var(--panel), 0 0 0 ${i === current.color ? 4 : 0}px var(--fg)` }}
            />
          ))}
        </Row>
        <Row title={t('settings.profilePin')} hint={t('settings.profilePinHint')}>
          {newPin !== null ? (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void savePin()
              }}
            >
              <input
                autoFocus
                aria-label="PIN"
                className="input w-24 font-mono tracking-[.3em]"
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                placeholder="0000"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
              <Button size="sm" variant="primary" type="submit" disabled={!PIN_PATTERN.test(newPin)}>
                {t('common.save')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setNewPin(null)}>
                {t('common.cancel')}
              </Button>
            </form>
          ) : (
            <>
              {current.locked && (
                <Button size="sm" onClick={() => setNewPin('')}>
                  {t('settings.profilePinChange')}
                </Button>
              )}
              <Toggle
                checked={current.locked}
                onChange={(on) => (on ? setNewPin('') : void update({ pin: null }, t('settings.profilePinRemoved')))}
                label={current.locked ? t('settings.on') : t('settings.off')}
              />
            </>
          )}
        </Row>
        <Row title={t('settings.profileExport')} hint={t('settings.profileExportHint')}>
          <Button onClick={() => void save(async () => (await window.api.profiles.export()) && toast('success', t('settings.profileExported')))}>
            {t('settings.profileExportButton')}
          </Button>
        </Row>
      </Section>

      <Section title={t('settings.profiles')}>
        {profiles.profiles.map((p) => (
          <Row
            key={p.id}
            title={
              <span className="flex items-center gap-2.5">
                <ProfileAvatar profile={p} size={26} fontSize={10} />
                <span className="truncate">{p.name}</span>
                {p.locked && <Lock size={12} className="shrink-0 text-faint" aria-label={t('settings.profilePin')} />}
                {p.id === current.id && <Pill>{t('settings.profileCurrent')}</Pill>}
              </span>
            }
          >
            <Button size="sm" variant="ghost" onClick={() => setRemoving(p)}>
              {t('settings.profileRemove')}
            </Button>
          </Row>
        ))}
      </Section>

      {removing && (
        <ConfirmModal
          title={t('settings.profileRemoveTitle', { name: removing.name })}
          body={t('settings.profileRemoveBody')}
          confirmLabel={t('settings.profileRemove')}
          cancelLabel={t('common.cancel')}
          danger
          onConfirm={() => {
            const id = removing.id
            setRemoving(null)
            void save(async () => setProfiles(await window.api.profiles.remove(id)))
          }}
          onCancel={() => setRemoving(null)}
        />
      )}
    </>
  )
}

export function SettingsPage() {
  const { settings, updateSettings, items, manifests, setManifests, info, appUpdate, toast, openDevlog } = useAppState()
  const { t, locale } = useI18n()
  const [token, setToken] = useState('')
  const [rescanning, setRescanning] = useState(false)
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null)

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
      await window.api.library.rescan()
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

      <ProfileSettings save={save} />

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
          <Toggle
            checked={settings.checkGameUpdates}
            onChange={(v) => void save(() => updateSettings({ checkGameUpdates: v }))}
            label={t('settings.checkGames')}
          />
        </div>
        <div className="px-[18px] py-4">
          <Toggle
            checked={settings.notifications}
            onChange={(v) => void save(() => updateSettings({ notifications: v }))}
            label={t('settings.notifications')}
          />
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
          {rateLimit && <p className="mt-2 font-mono text-[11px] text-faint">{formatRateLimit(rateLimit, t, locale)}</p>}
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
        <Row title="Relaunch" hint={<span className="font-mono">{t('settings.version', { version: info?.version ?? '' })}</span>}>
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
