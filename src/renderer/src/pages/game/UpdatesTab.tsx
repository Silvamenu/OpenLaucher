import { ArrowDownToLine, ChevronDown, CircleCheck, ExternalLink, History, Info, PackageCheck, RefreshCw, ShieldCheck, TriangleAlert, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { assetPatternsFor } from '../../../../shared/manifest'
import type { LibraryItem, RateLimitInfo, ReleaseInfo } from '../../../../shared/types'
import { Markdown } from '../../components/Markdown'
import { Button, Card, ConfirmModal, ProgressBar, Toggle } from '../../components/ui'
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
  const [notesOpen, setNotesOpen] = useState(true)
  const [confirmRollback, setConfirmRollback] = useState(false)
  const [closeGamePrompt, setCloseGamePrompt] = useState(false)
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null)

  useEffect(() => {
    void window.api.updates.rateLimit().then(setRateLimit)
  }, [state.checkedAt])

  if (!manifest || !updates || updates.source !== 'github-releases') {
    return (
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-subtle text-muted">
            <Info size={22} />
          </div>
          <div>
            <h3 className="font-semibold">{t('upd.noBinaries.title')}</h3>
            <p className="mt-1 max-w-xl text-sm text-muted">{t('upd.noBinaries.body')}</p>
            {manifest && (
              <Button className="mt-4" icon={<ExternalLink size={15} />} onClick={() => void window.api.app.openExternal(manifest.repoUrl)}>
                {t('upd.openRepo')}
              </Button>
            )}
          </div>
        </div>
      </Card>
    )
  }

  const check = async () => {
    setChecking(true)
    try {
      setItems(await window.api.updates.check(id))
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

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="text-xs font-semibold tracking-wide text-muted uppercase">{t('upd.installed')}</div>
          <div className="mt-1 text-2xl font-bold tracking-tight">{installed ?? t('upd.unknown')}</div>
          {!installed && (
            <div className="mt-3 rounded-lg bg-subtle p-3">
              <p className="text-xs text-muted">{t('upd.setVersionHint')}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {latest && (
                  <Button size="sm" variant="primary" onClick={() => setInstalled(latest.tag, latest.publishedAt)}>
                    {t('upd.markLatest')}
                  </Button>
                )}
                {releases ? (
                  <select
                    className="input h-8 text-xs"
                    defaultValue=""
                    onChange={(e) => {
                      const r = releases.find((x) => x.tag === e.target.value)
                      if (r) void setInstalled(r.tag, r.publishedAt)
                    }}
                  >
                    <option value="" disabled>
                      {t('upd.setVersion')}
                    </option>
                    {releases.map((r) => (
                      <option key={r.tag} value={r.tag}>
                        {r.tag} — {formatDate(r.publishedAt, locale)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Button size="sm" onClick={loadReleases}>
                    {t('upd.pickVersion')}
                  </Button>
                )}
              </div>
            </div>
          )}
          {installed && (
            <button type="button" className="mt-2 text-xs text-muted hover:text-accent hover:underline" onClick={() => setInstalled(null, null)}>
              {t('upd.pickVersion')}
            </button>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-semibold tracking-wide text-muted uppercase">{t('upd.latest')}</div>
              <div className="mt-1 text-2xl font-bold tracking-tight">{latest?.tag ?? '—'}</div>
              {latest && (
                <div className="text-xs text-muted">
                  {latest.name !== latest.tag ? `${latest.name} · ` : ''}
                  {formatDate(latest.publishedAt, locale)}
                </div>
              )}
            </div>
            <Button size="sm" variant="ghost" icon={<RefreshCw size={14} className={checking ? 'animate-spin' : ''} />} disabled={checking} onClick={check}>
              {t('upd.checkNow')}
            </Button>
          </div>
          <div className="mt-3 text-xs text-muted">
            {state.checkedAt ? t('upd.lastCheck', { when: formatRelative(state.checkedAt, t, locale) }) : t('upd.neverChecked')}
          </div>
          {state.error && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-red-500">
              <TriangleAlert size={14} className="mt-px shrink-0" /> {errorMessage(state.error, t)}
            </p>
          )}
        </Card>
      </div>

      <Card className="p-5">
        {latest && state.assetName === null && (
          <p className="mb-4 flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            {t('upd.noAsset', { patterns: patterns.join(', ') || '—' })}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {state.available ? (
            <span className="flex items-center gap-2 text-sm font-medium text-accent">
              <ArrowDownToLine size={18} /> {t('upd.available', { version: latest?.tag ?? '' })}
            </span>
          ) : installed && latest && !state.error ? (
            <span className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <CircleCheck size={18} /> {t('upd.upToDate')}
            </span>
          ) : null}
          <div className="ml-auto flex flex-wrap gap-2">
            {backup && (
              <Button icon={<History size={15} />} disabled={busy || item.running} onClick={() => setConfirmRollback(true)}>
                {t('upd.rollback', { version: backup.version })}
              </Button>
            )}
            {busy && p?.kind === 'update' ? (
              <Button variant="danger" icon={<X size={15} />} onClick={() => void window.api.updates.cancel(id)}>
                {t('upd.cancel')}
              </Button>
            ) : (
              latest &&
              state.assetName && (
                <Button
                  variant={state.available || !installed ? 'primary' : 'secondary'}
                  icon={<ArrowDownToLine size={15} />}
                  disabled={busy || item.status === 'missingFolder'}
                  onClick={startUpdate}
                >
                  {state.available || !installed ? t('upd.update', { version: latest.tag }) : t('upd.reinstall', { version: latest.tag })}
                </Button>
              )
            )}
          </div>
        </div>

        {latest && state.assetName && <div className="mt-2 text-xs text-muted">{t('upd.asset', { name: state.assetName })}</div>}

        {showProgress && (
          <div className="mt-4 rounded-lg border border-line bg-subtle p-3">
            <div className="mb-2 flex items-center justify-between gap-2 text-sm">
              <span className={`font-medium ${p.stage === 'error' ? 'text-red-500' : ''}`}>{t(`stage.${p.stage}`)}</span>
              {p.stage === 'downloading' && (
                <span className="text-xs text-muted">
                  {formatBytes(p.receivedBytes, locale)} / {formatBytes(p.totalBytes, locale)}
                </span>
              )}
            </div>
            {p.stage !== 'error' && p.stage !== 'cancelled' && <ProgressBar value={p.stage === 'done' ? 1 : p.progress} />}
            {p.error && p.stage === 'error' && <p className="text-xs text-red-500">{errorMessage(p.error, t)}</p>}
          </div>
        )}

        <div className="mt-5 border-t border-line pt-4">
          <Toggle
            checked={item.entry.autoUpdate}
            onChange={(v) => void window.api.library.update(id, { autoUpdate: v })}
            label={t('upd.auto')}
            hint={t('upd.autoHint')}
          />
        </div>
      </Card>

      {latest?.body && (
        <Card>
          <button type="button" onClick={() => setNotesOpen((o) => !o)} className="flex w-full items-center justify-between px-5 py-3 text-left">
            <span className="text-sm font-semibold">
              {t('upd.notes')} — {latest.tag}
            </span>
            <ChevronDown size={16} className={`text-muted transition ${notesOpen ? 'rotate-180' : ''}`} />
          </button>
          {notesOpen && (
            <div className="max-h-[420px] overflow-y-auto border-t border-line px-5 py-4">
              <Markdown>{latest.body}</Markdown>
              <Button className="mt-4" size="sm" variant="ghost" icon={<ExternalLink size={14} />} onClick={() => void window.api.app.openExternal(latest.htmlUrl)}>
                GitHub
              </Button>
            </div>
          )}
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <PackageCheck size={16} className="text-muted" /> {t('upd.backups')}
          </div>
          {item.backups.length === 0 ? (
            <p className="text-xs text-muted">{t('upd.noBackupsYet')}</p>
          ) : (
            <ul className="space-y-1.5">
              {item.backups.map((b) => (
                <li key={b.file} className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium">{b.version}</span>
                  <span className="text-muted">
                    {formatDate(b.createdAt, locale, true)} · {formatBytes(b.size, locale)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck size={16} className="text-emerald-500" /> {t('upd.preserveTitle')}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {updates.preserve.map((pattern) => (
              <code key={pattern} className="rounded bg-subtle px-1.5 py-0.5 font-mono text-[11px]">
                {pattern}
              </code>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted">{t('upd.source', { repo: updates.repo })}</p>
          {rateLimit && (
            <p className="mt-1 text-[11px] text-muted">
              {t('upd.rateLimit', {
                remaining: rateLimit.remaining,
                limit: rateLimit.limit,
                time: new Date(rateLimit.resetAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
              })}
            </p>
          )}
        </Card>
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
