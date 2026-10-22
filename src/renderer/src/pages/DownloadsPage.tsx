import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import type { LibraryItem } from '../../../shared/types'
import { GameTile } from '../components/GameArt'
import { Button, Dot, Page, PageHeader, ProgressBar, SectionLabel } from '../components/ui'
import { useI18n } from '../i18n'
import { errorMessage, formatProgressDetail, formatRelative, isApiError } from '../lib/format'
import { useAppState } from '../state/AppState'

function Row({ item, children, onOpen }: { item: LibraryItem; children: React.ReactNode; onOpen: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <button type="button" onClick={onOpen} className="flex min-w-[200px] flex-1 items-center gap-3 text-left">
        <GameTile item={item} size={32} />
        <span className="min-w-0">
          <span className="block truncate text-[13.5px]">{item.name}</span>
          {item.manifest?.originalGame && <span className="block truncate text-[12px] text-subtle">{item.manifest.originalGame}</span>}
        </span>
      </button>
      {children}
    </div>
  )
}

export function DownloadsPage() {
  const { items, progress, history, navigate, toast } = useAppState()
  const { t, locale } = useI18n()
  const [checking, setChecking] = useState(false)
  const active = items.filter((i) => i.busy)
  const available = items.filter((i) => i.update.available && !i.busy)
  const byId = (id: string) => items.find((i) => i.entry.id === id)

  const check = async () => {
    setChecking(true)
    try {
      // A lista nova chega pelo evento library:changed; aqui só interessa o erro.
      const list = await window.api.updates.check()
      const error = list.map((i) => i.update.error).find(Boolean)
      if (error) toast('error', errorMessage(error, t))
    } catch (err) {
      toast('error', errorMessage(err, t))
    } finally {
      setChecking(false)
    }
  }

  const start = async (item: LibraryItem) => {
    try {
      await window.api.updates.start(item.entry.id)
      toast('success', t('upd.updated', { name: item.name, version: item.update.latest?.tag ?? '' }))
    } catch (err) {
      if (isApiError(err, 'GAME_RUNNING')) toast('error', t('upd.closeGame.body'))
      else if (!isApiError(err, 'CANCELLED')) toast('error', errorMessage(err, t))
    }
  }

  const nothing = active.length === 0 && available.length === 0 && history.length === 0

  return (
    <Page narrow>
      <PageHeader
        title={t('downloads.title')}
        subtitle={t('downloads.subtitle')}
        actions={
          <Button icon={<RefreshCw size={14} className={checking ? 'animate-spin' : ''} />} disabled={checking} onClick={check}>
            {checking ? t('library.checking') : t('library.checkUpdates')}
          </Button>
        }
      />

      {nothing && <p className="mt-16 text-center text-[13px] text-subtle">{t('downloads.empty')}</p>}

      {active.length > 0 && (
        <section className="mb-8">
          <SectionLabel>{t('downloads.active')}</SectionLabel>
          <div className="divide-y divide-line overflow-hidden rounded-[14px] border border-line">
            {active.map((item) => {
              const p = progress[item.entry.id]
              return (
                <div key={item.entry.id}>
                  <Row item={item} onOpen={() => navigate({ page: 'game', id: item.entry.id, tab: 'updates' })}>
                    <span className="font-mono text-[12px] text-subtle">{p?.version}</span>
                    {p?.kind === 'update' && (
                      <Button size="sm" variant="danger" onClick={() => void window.api.updates.cancel(item.entry.id)}>
                        {t('upd.cancel')}
                      </Button>
                    )}
                  </Row>
                  {p && (
                    <div className="px-4 pb-4">
                      <div className="mb-2 flex justify-between text-[12px] text-subtle">
                        <span>{t(`stage.${p.stage}`)}</span>
                        <span className="font-mono">{formatProgressDetail(p, locale)}</span>
                      </div>
                      <ProgressBar value={p.progress} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {available.length > 0 && (
        <section className="mb-8">
          <SectionLabel>{t('downloads.available')}</SectionLabel>
          <div className="divide-y divide-line overflow-hidden rounded-[14px] border border-line">
            {available.map((item) => (
              <Row key={item.entry.id} item={item} onOpen={() => navigate({ page: 'game', id: item.entry.id, tab: 'updates' })}>
                <span className="font-mono text-[12px] text-subtle">
                  {item.entry.installedVersion ?? '?'} → {item.update.latest?.tag}
                </span>
                <Button size="sm" variant="accent" disabled={item.running || item.update.assetName === null} onClick={() => start(item)}>
                  {t('downloads.update')}
                </Button>
              </Row>
            ))}
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section>
          <SectionLabel>{t('downloads.recent')}</SectionLabel>
          <div className="divide-y divide-line overflow-hidden rounded-[14px] border border-line">
            {history.map((h) => {
              const item = byId(h.entryId)
              if (!item) return null
              const tone = h.stage === 'done' ? 'ok' : h.stage === 'error' ? 'bad' : 'idle'
              return (
                <Row key={`${h.entryId}-${h.at}`} item={item} onOpen={() => navigate({ page: 'game', id: item.entry.id, tab: 'updates' })}>
                  <span className="flex max-w-[320px] min-w-0 items-center gap-2 text-[12.5px] text-fg-3">
                    <Dot tone={tone} />
                    <span className="truncate">
                      {h.kind === 'rollback'
                        ? t('downloads.rolledBackTo', { version: h.version ?? '' })
                        : t('downloads.updatedTo', { version: h.version ?? '' })}
                      {' · '}
                      {h.stage === 'error' && h.error ? errorMessage(h.error, t) : t(`stage.${h.stage}`)}
                    </span>
                  </span>
                  <span className="text-[12px] text-faint">{formatRelative(new Date(h.at).toISOString(), t, locale)}</span>
                </Row>
              )
            })}
          </div>
        </section>
      )}
    </Page>
  )
}
