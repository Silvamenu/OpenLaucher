import { CircleCheck, ExternalLink, FolderOpen, LoaderCircle, Plus, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import type { Manifest } from '../../../shared/manifest'
import type { DetectionCandidate } from '../../../shared/types'
import { artBackground, monogram } from '../components/GameArt'
import { Button, Card } from '../components/ui'
import { useI18n } from '../i18n'
import { errorMessage } from '../lib/format'
import { useAppState } from '../state/AppState'

function ManifestTile({ manifest, selected, onSelect, hint }: { manifest: Manifest; selected: boolean; onSelect: () => void; hint?: string }) {
  const { t } = useI18n()
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
        selected ? 'border-accent bg-accent/8 ring-2 ring-accent/30' : 'border-line bg-card hover:border-accent/50'
      }`}
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-black text-white"
        style={{ background: artBackground(manifest.accentColor ?? '#3b82f6') }}
      >
        {monogram(manifest.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{manifest.name}</span>
        <span className="block truncate text-xs text-muted">
          {manifest.originalGame}
          {manifest.updates.source === 'none' ? ` · ${t('add.noBinaries')}` : ''}
        </span>
        {hint && <span className="mt-0.5 block truncate text-[11px] text-muted">{hint}</span>}
      </span>
      {selected && <CircleCheck size={20} className="shrink-0 text-accent" />}
    </button>
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
    <div className="mx-auto max-w-4xl px-6 py-8 lg:px-8">
      <h1 className="text-2xl font-bold tracking-tight">{t('add.title')}</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">{t('add.subtitle')}</p>

      <Card className="mt-6 p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/12 text-accent">
            <FolderOpen size={24} />
          </div>
          <div className="min-w-0 flex-1">
            {folder ? (
              <>
                <div className="text-xs text-muted">{t('add.folder')}</div>
                <div className="selectable truncate font-mono text-sm" title={folder}>
                  {folder}
                </div>
              </>
            ) : (
              <div className="text-sm text-muted">{t('add.noFolder')}</div>
            )}
          </div>
          <Button variant={folder ? 'secondary' : 'primary'} icon={<FolderOpen size={16} />} onClick={pick}>
            {folder ? t('add.changeFolder') : t('add.pickFolder')}
          </Button>
        </div>

        {detecting && (
          <div className="mt-5 flex items-center gap-2 text-sm text-muted">
            <LoaderCircle size={16} className="animate-spin" /> {t('add.detecting')}
          </div>
        )}

        {candidates && candidates.length > 0 && !manual && (
          <div className="mt-5">
            <p className="mb-2 text-sm font-medium">{candidates.length === 1 ? t('add.detected') : t('add.detectedMany')}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {candidates.map((c) => {
                const m = byId(c.manifestId)
                if (!m) return null
                const hint = c.path !== folder ? t('add.subfolder', { path: c.path }) : t('add.matched', { files: c.matched.join(', ') })
                return (
                  <ManifestTile
                    key={`${c.manifestId}|${c.path}`}
                    manifest={m}
                    hint={hint}
                    selected={selected?.manifestId === c.manifestId && selected.path === c.path}
                    onSelect={() => setSelected({ manifestId: c.manifestId, path: c.path })}
                  />
                )
              })}
            </div>
            <button type="button" className="mt-3 text-xs text-accent hover:underline" onClick={() => setManual(true)}>
              {t('add.chooseManual')}
            </button>
          </div>
        )}

        {showManualList && (
          <div className="mt-5">
            <p className="mb-2 text-sm font-medium">{t('add.notDetected')}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {manifests.manifests.map((m) => (
                <ManifestTile
                  key={m.id}
                  manifest={m}
                  selected={selected?.manifestId === m.id && selected.path === folder}
                  onSelect={() => setSelected({ manifestId: m.id, path: folder! })}
                />
              ))}
            </div>
          </div>
        )}

        {selected && (
          <div className="mt-6 flex justify-end">
            <Button variant="primary" size="lg" icon={<Plus size={18} />} loading={adding} onClick={add}>
              {t('add.confirm')}
            </Button>
          </div>
        )}
      </Card>

      <h2 className="mt-10 mb-3 text-sm font-semibold tracking-wide text-muted uppercase">{t('add.supported')}</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {manifests.manifests.map((m) => (
          <div key={m.id} className="flex items-center gap-3 rounded-xl border border-line bg-card p-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white"
              style={{ background: artBackground(m.accentColor ?? '#3b82f6') }}
            >
              {monogram(m.name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{m.name}</div>
              <div className="truncate text-xs text-muted">
                {m.originalGame}
                {m.updates.source === 'none' ? ` · ${t('add.noBinaries')}` : ''}
              </div>
            </div>
            <Button variant="ghost" size="sm" icon={<ExternalLink size={14} />} onClick={() => void window.api.app.openExternal(m.repoUrl)}>
              GitHub
            </Button>
          </div>
        ))}
      </div>

      <p className="mt-8 flex items-start gap-2 text-xs text-muted">
        <ShieldCheck size={16} className="mt-px shrink-0 text-emerald-500" />
        {t('legal.note')}
      </p>
    </div>
  )
}
