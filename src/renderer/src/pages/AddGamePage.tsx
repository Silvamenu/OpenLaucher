import { Check, FolderOpen, LoaderCircle, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import type { Manifest } from '../../../shared/manifest'
import type { DetectionCandidate } from '../../../shared/types'
import { hueOf, monogram, tileColor } from '../components/GameArt'
import { Button, Card, Page, PageHeader, SectionLabel } from '../components/ui'
import { useI18n } from '../i18n'
import { errorMessage } from '../lib/format'
import { useAppState } from '../state/AppState'

function ManifestRow({ manifest, selected, onSelect, hint, action }: { manifest: Manifest; selected?: boolean; onSelect?: () => void; hint?: string; action?: React.ReactNode }) {
  const { t } = useI18n()
  const Tag = onSelect ? 'button' : 'div'
  return (
    <Tag
      type={onSelect ? 'button' : undefined}
      onClick={onSelect}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${onSelect ? 'hover:bg-hover/60' : ''} ${selected ? 'bg-hover' : ''}`}
    >
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[11px] font-bold tracking-[-0.02em] text-white"
        style={{ background: tileColor(hueOf(manifest.accentColor)) }}
      >
        {monogram(manifest.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px]">{manifest.name}</span>
        <span className="block truncate text-[12px] text-subtle">
          {manifest.originalGame}
          {manifest.updates.source === 'none' ? ` · ${t('add.noBinaries')}` : ''}
        </span>
        {hint && <span className="mt-0.5 block truncate font-mono text-[11px] text-faint">{hint}</span>}
      </span>
      {selected && <Check size={16} className="shrink-0 text-fg" />}
      {action}
    </Tag>
  )
}

export function AddGamePage() {
  const { manifests, navigate, toast } = useAppState()
  const { t } = useI18n()
  const [folder, setFolder] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<DetectionCandidate[] | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [selected, setSelected] = useState<{ manifestId: string; path: string } | null>(null)
  const [manual, setManual] = useState(false)
  const [adding, setAdding] = useState(false)

  const pick = async () => {
    const chosen = await window.api.library.pickFolder()
    if (!chosen) return
    setFolder(chosen)
    setDetecting(true)
    setCandidates(null)
    setSelected(null)
    setManual(false)
    try {
      const found = await window.api.library.detect(chosen)
      setCandidates(found)
      if (found.length > 0) setSelected({ manifestId: found[0].manifestId, path: found[0].path })
    } catch (err) {
      toast('error', errorMessage(err, t))
    } finally {
      setDetecting(false)
    }
  }

  const add = async () => {
    if (!selected) return
    setAdding(true)
    try {
      const item = await window.api.library.add(selected.path, selected.manifestId)
      navigate({ page: 'game', id: item.entry.id, tab: 'setup' })
    } catch (err) {
      toast('error', errorMessage(err, t))
    } finally {
      setAdding(false)
    }
  }

  const byId = (id: string) => manifests.manifests.find((m) => m.id === id)
  const showManualList = !!folder && !detecting && (manual || (candidates !== null && candidates.length === 0))

  return (
    <Page narrow>
      <PageHeader title={t('add.title')} subtitle={t('add.subtitle')} />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <FolderOpen size={18} strokeWidth={1.7} className="shrink-0 text-subtle" />
          <div className="min-w-0 flex-1">
            {folder ? (
              <div className="selectable truncate font-mono text-[12.5px] text-fg-2" title={folder}>
                {folder}
              </div>
            ) : (
              <div className="text-[13px] text-subtle">{t('add.noFolder')}</div>
            )}
          </div>
          <Button variant={folder ? 'secondary' : 'primary'} onClick={pick}>
            {folder ? t('add.changeFolder') : t('add.pickFolder')}
          </Button>
        </div>

        {detecting && (
          <div className="flex items-center gap-2 border-t border-line px-4 py-3 text-[13px] text-subtle">
            <LoaderCircle size={15} className="animate-spin" /> {t('add.detecting')}
          </div>
        )}

        {candidates && candidates.length > 0 && !manual && (
          <div className="border-t border-line">
            <div className="flex items-center justify-between px-4 pt-3 pb-1 text-[12px] text-faint">
              <span>{candidates.length === 1 ? t('add.detected') : t('add.detectedMany')}</span>
              <button type="button" className="text-link hover:underline" onClick={() => setManual(true)}>
                {t('add.chooseManual')}
              </button>
            </div>
            {candidates.map((c) => {
              const m = byId(c.manifestId)
              if (!m) return null
              return (
                <ManifestRow
                  key={`${c.manifestId}|${c.path}`}
                  manifest={m}
                  hint={c.path !== folder ? t('add.subfolder', { path: c.path }) : t('add.matched', { files: c.matched.join(', ') })}
                  selected={selected?.manifestId === c.manifestId && selected.path === c.path}
                  onSelect={() => setSelected({ manifestId: c.manifestId, path: c.path })}
                />
              )
            })}
          </div>
        )}

        {showManualList && (
          <div className="border-t border-line">
            <div className="px-4 pt-3 pb-1 text-[12px] text-faint">{t('add.notDetected')}</div>
            {manifests.manifests.map((m) => (
              <ManifestRow key={m.id} manifest={m} selected={selected?.manifestId === m.id && selected.path === folder} onSelect={() => setSelected({ manifestId: m.id, path: folder! })} />
            ))}
          </div>
        )}

        {selected && (
          <div className="flex justify-end border-t border-line p-4">
            <Button variant="primary" loading={adding} onClick={add}>
              {t('add.confirm')}
            </Button>
          </div>
        )}
      </Card>

      <div className="mt-10">
        <SectionLabel>{t('add.supported')}</SectionLabel>
        <div className="divide-y divide-line overflow-hidden rounded-[14px] border border-line">
          {manifests.manifests.map((m) => (
            <ManifestRow
              key={m.id}
              manifest={m}
              action={
                <button type="button" className="shrink-0 text-[12.5px] text-link hover:underline" onClick={() => void window.api.app.openExternal(m.repoUrl)}>
                  GitHub
                </button>
              }
            />
          ))}
        </div>
      </div>

      <p className="mt-8 flex items-start gap-2 text-[12px] text-faint">
        <ShieldCheck size={14} className="mt-px shrink-0" />
        {t('legal.note')}
      </p>
    </Page>
  )
}
