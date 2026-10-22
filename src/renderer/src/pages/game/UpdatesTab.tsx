import { ChevronDown, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { assetPatternsFor } from '../../../../shared/manifest'
import type { LibraryItem, RateLimitInfo, ReleaseInfo } from '../../../../shared/types'
import { Markdown } from '../../components/Markdown'
import { Button, Card, ConfirmModal, Dot, ProgressBar, SectionLabel, Toggle } from '../../components/ui'
import { useI18n } from '../../i18n'
import { errorMessage, formatBytes, formatDate, formatRelative, isApiError } from '../../lib/format'
import { useAppState } from '../../state/AppState'

export function UpdatesTab({ item }: { item: LibraryItem }) {
  const { progress, toast, info, setItems } = useAppState()
  const { t, locale } = useI18n()
  const id = item.entry.id
  const manifest = item.manifest
  const updates = manifest?.updates
  const state = item.update
  const latest = state.latest
  const p = progress[id]
  const [checking, setChecking] = useState(false)
  const [releases, setReleases] = useState<ReleaseInfo[] | null>(null)
  const [notesOpen, setNotesOpen] = useState(false)
  const [confirmRollback, setConfirmRollback] = useState(false)
  const [closeGamePrompt, setCloseGamePrompt] = useState(false)
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null)

  useEffect(() => {
    void window.api.updates.rateLimit().then(setRateLimit)
  }, [state.checkedAt])

  if (!manifest || !updates || updates.source !== 'github-releases') {
    return (
      <Card className="max-w-[760px] p-5">
        <div className="text-[14px] font-medium">{t('upd.noBinaries.title')}</div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-subtle">{t('upd.noBinaries.body')}</p>
        {manifest && (
          <Button className="mt-4" onClick={() => void window.api.app.openExternal(manifest.repoUrl)}>
            {t('upd.openRepo')}
          </Button>
        )}
      </Card>
    )
  }

  const check = async () => {
    setChecking(true)
    try {
      const list = await window.api.updates.check(id)
      setItems(list)
      const error = list.find((i) => i.entry.id === id)?.update.error
      if (error) toast('error', errorMessage(error, t))
    } catch (err) {
      toast('error', errorMessage(err, t))
    } finally {
      setChecking(false)
    }
  }

  const startUpdate = async () => {
    setCloseGamePrompt(false)
    try {
      await window.api.updates.start(id)
      toast('success', t('upd.updated', { name: item.name, version: latest?.tag ?? '' }))
    } catch (err) {
      if (isApiError(err, 'GAME_RUNNING')) setCloseGamePrompt(true)
      else if (!isApiError(err, 'CANCELLED')) toast('error', errorMessage(err, t))
    }
  }

  const rollback = async () => {
    setConfirmRollback(false)
    try {
      await window.api.updates.rollback(id)
      toast('success', t('upd.rolledBack'))
    } catch (err) {
      toast('error', errorMessage(err, t))
    }
  }

  const setInstalled = async (tag: string | null, publishedAt: string | null) => {
    try {
      await window.api.library.update(id, { installedVersion: tag, installedPublishedAt: publishedAt })
      setItems(await window.api.updates.check(id))
    } catch (err) {
      toast('error', errorMessage(err, t))
    }
  }

  const loadReleases = async () => {
    try {
      setReleases(await window.api.updates.releases(id))
    } catch (err) {
      toast('error', errorMessage(err, t))
    }
  }

  const patterns = assetPatternsFor(updates, info?.platform ?? 'win32')
  const installed = item.entry.installedVersion
  const busy = item.busy
  const backup = item.backups[0]
  const showProgress = p && (busy || p.stage === 'error' || p.stage === 'done' || p.stage === 'cancelled')

  const cells: [string, string, boolean][] = [
    [t('upd.installed'), installed ?? t('upd.unknown'), !!installed],
    [t('upd.latest'), latest ? latest.tag : '—', true],
    [t('upd.published'), latest ? formatDate(latest.publishedAt, locale) : '—', false],
    [t('upd.checked'), state.checkedAt ? formatRelative(state.checkedAt, t, locale) : t('upd.neverChecked'), false]
  ]

  return (
    <div className="max-w-[860px] space-y-5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] overflow-hidden rounded-[14px] border border-line">
        {cells.map(([label, value, mono]) => (
          <div key={label} className="border-r border-line px-[18px] py-4 last:border-r-0">
            <div className="mb-1.5 text-[12px] text-faint">{label}</div>
            <div className={`truncate ${mono ? 'font-mono text-[13px]' : 'text-[14px]'}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Estado + ações */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto flex min-w-[200px] items-center gap-2.5 text-[13px] text-fg-3">
          {state.error ? (
            <>
              <Dot tone="bad" /> {errorMessage(state.error, t)}
            </>
          ) : state.available && latest ? (
            <>
              <Dot tone="info" /> {t('upd.available', { version: latest.tag })}
            </>
          ) : installed && latest ? (
            <>
              <Dot tone="ok" /> {t('upd.upToDate')}
            </>
          ) : !installed ? (
            <>
              <Dot tone="warn" /> {t('upd.setVersionHint')}
            </>
          ) : null}
        </div>
        <Button variant="ghost" icon={<RefreshCw size={14} className={checking ? 'animate-spin' : ''} />} disabled={checking} onClick={check}>
          {t('upd.checkNow')}
        </Button>
        {backup && (
          <Button disabled={busy || item.running} onClick={() => setConfirmRollback(true)}>
            {t('upd.rollback', { version: backup.version })}
          </Button>
        )}
        {busy && p?.kind === 'update' ? (
          <Button variant="danger" onClick={() => void window.api.updates.cancel(id)}>
            {t('upd.cancel')}
          </Button>
        ) : (
          latest &&
          state.assetName && (
            <Button variant={state.available || !installed ? 'accent' : 'secondary'} disabled={busy || item.status === 'missingFolder'} onClick={startUpdate}>
              {state.available || !installed ? t('upd.update', { version: latest.tag }) : t('upd.reinstall', { version: latest.tag })}
            </Button>
          )
        )}
      </div>

      {!installed && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-4 py-3">
          <span className="mr-auto text-[13px] text-fg-3">{t('upd.setVersion')}</span>
          {latest && (
            <Button size="sm" onClick={() => setInstalled(latest.tag, latest.publishedAt)}>
              {t('upd.markLatest')}
            </Button>
          )}
          {releases ? (
            <select
              className="input h-8 text-[12.5px]"
              defaultValue=""
              onChange={(e) => {
                const r = releases.find((x) => x.tag === e.target.value)
                if (r) void setInstalled(r.tag, r.publishedAt)
              }}
            >
              <option value="" disabled>
                {t('upd.pickVersion')}
              </option>
              {releases.map((r) => (
                <option key={r.tag} value={r.tag}>
                  {r.tag} — {formatDate(r.publishedAt, locale)}
                </option>
              ))}
            </select>
          ) : (
            <Button size="sm" variant="ghost" onClick={loadReleases}>
              {t('upd.pickVersion')}
            </Button>
          )}
        </div>
      )}

      {latest && state.assetName === null && (
        <p className="flex items-start gap-2.5 rounded-xl border border-line px-4 py-3 text-[13px] text-fg-3">
          <Dot tone="warn" className="mt-1.5" />
          {t('upd.noAsset', { patterns: patterns.join(', ') || '—' })}
        </p>
      )}

      {showProgress && (
        <div className="rounded-xl border border-line px-4 pt-3 pb-4">
          <div className="mb-2.5 flex items-center justify-between gap-2 text-[13px]">
            <span className={p.stage === 'error' ? 'text-bad' : 'text-fg-2'}>{t(`stage.${p.stage}`)}</span>
            <span className="font-mono text-[11.5px] text-subtle">
              {p.stage === 'downloading' && p.totalBytes
                ? `${formatBytes(p.receivedBytes, locale)} / ${formatBytes(p.totalBytes, locale)}`
                : p.progress !== undefined
                  ? `${Math.round(p.progress * 100)}%`
                  : ''}
            </span>
          </div>
          {p.stage !== 'error' && p.stage !== 'cancelled' && <ProgressBar value={p.stage === 'done' ? 1 : p.progress} />}
          {p.error && p.stage === 'error' && <p className="text-[12.5px] text-bad">{errorMessage(p.error, t)}</p>}
        </div>
      )}

      {latest && state.assetName && <div className="font-mono text-[11.5px] text-faint">{t('upd.asset', { name: state.assetName })}</div>}

      <Toggle
        checked={item.entry.autoUpdate}
        onChange={(v) => void window.api.library.update(id, { autoUpdate: v })}
        label={t('upd.auto')}
        hint={t('upd.autoHint')}
      />

      {latest?.body && (
        <Card className="overflow-hidden">
          <button type="button" onClick={() => setNotesOpen((o) => !o)} className="flex w-full items-center justify-between px-[18px] py-3.5 text-left">
            <span className="text-[13.5px]">
              {t('upd.notes')} <span className="font-mono text-[12px] text-subtle">{latest.tag}</span>
            </span>
            <ChevronDown size={16} className={`text-subtle transition-transform ${notesOpen ? 'rotate-180' : ''}`} />
          </button>
          {notesOpen && (
            <div className="max-h-[420px] overflow-y-auto border-t border-line px-[18px] py-4">
              <Markdown>{latest.body}</Markdown>
              <button type="button" className="mt-4 text-[12.5px] text-link hover:underline" onClick={() => void window.api.app.openExternal(latest.htmlUrl)}>
                {t('upd.viewOnGithub')}
              </button>
            </div>
          )}
        </Card>
      )}

      <div className="grid gap-5 pt-2 md:grid-cols-2">
        <div>
          <SectionLabel>{t('upd.backups')}</SectionLabel>
          {item.backups.length === 0 ? (
            <p className="text-[12.5px] leading-relaxed text-subtle">{t('upd.noBackupsYet')}</p>
          ) : (
            <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
              {item.backups.map((b) => (
                <div key={b.file} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[12.5px]">
                  <span className="font-mono">{b.version}</span>
                  <span className="text-subtle">
                    {formatDate(b.createdAt, locale, true)} · {formatBytes(b.size, locale)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <SectionLabel>{t('upd.preserveTitle')}</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {updates.preserve.map((pattern) => (
              <span key={pattern} className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[11px] text-subtle">
                {pattern}
              </span>
            ))}
          </div>
          <p className="mt-3 text-[11.5px] text-faint">{t('upd.source', { repo: updates.repo })}</p>
          {rateLimit && (
            <p className="mt-1 text-[11.5px] text-faint">
              {t('upd.rateLimit', {
                remaining: rateLimit.remaining,
                limit: rateLimit.limit,
                time: new Date(rateLimit.resetAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
              })}
            </p>
          )}
        </div>
      </div>

      {confirmRollback && backup && (
        <ConfirmModal
          title={t('upd.rollback', { version: backup.version })}
          body={t('upd.rollbackConfirm', { version: backup.version })}
          confirmLabel={t('common.confirm')}
          cancelLabel={t('common.cancel')}
          onConfirm={rollback}
          onCancel={() => setConfirmRollback(false)}
        />
      )}
      {closeGamePrompt && (
        <ConfirmModal
          title={t('upd.closeGame.title')}
          body={t('upd.closeGame.body')}
          confirmLabel={t('upd.retry')}
          cancelLabel={t('common.cancel')}
          onConfirm={startUpdate}
          onCancel={() => setCloseGamePrompt(false)}
        />
      )}
    </div>
  )
}
