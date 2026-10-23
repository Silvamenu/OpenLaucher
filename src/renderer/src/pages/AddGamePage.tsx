import { Check, ChevronDown, Download, FolderGit2, FolderOpen, LoaderCircle, Plus, Search, ShieldCheck } from 'lucide-react'
import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { groupCatalog, type Category, type Compatibility } from '../../../shared/catalog'
import type { Manifest } from '../../../shared/manifest'
import { installableOn } from '../../../shared/manifestUtils'
import type { DetectionCandidate, LibraryItem, RepoInspection } from '../../../shared/types'
import { hueOf, monogram, tileColor } from '../components/GameArt'
import { GlossaryText } from '../components/Glossary'
import { Button, Card, ConfirmModal, Page, PageHeader, SectionLabel } from '../components/ui'
import { useI18n } from '../i18n'
import { errorMessage, formatBytes } from '../lib/format'
import { useAppState } from '../state/AppState'

const COMPAT_TONE: Record<Compatibility, string> = {
  playable: 'border-ok/40 text-ok',
  ingame: 'border-warn/40 text-warn',
  experimental: 'border-line text-subtle'
}

/** Nome do emulador de um jogo via runner (o manifesto dele, se carregado). */
function useRunnerName(manifest: Manifest): string | null {
  const { manifests } = useAppState()
  if (!manifest.runner) return null
  return manifests.manifests.find((m) => m.id === manifest.runner?.manifest)?.name ?? manifest.runner.manifest
}

function ManifestRow({
  manifest,
  selected,
  onSelect,
  hint,
  action
}: {
  manifest: Manifest
  selected?: boolean
  onSelect?: () => void
  hint?: string
  action?: ReactNode
}) {
  const { t } = useI18n()
  const runnerName = useRunnerName(manifest)
  const Tag = onSelect ? 'button' : 'div'
  const details = [
    manifest.originalGame,
    runnerName ? t('add.via', { name: runnerName }) : null,
    manifest.updates.source === 'none' && !manifest.runner ? t('add.noBinaries') : null
  ].filter(Boolean)
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
        <span className="flex min-w-0 items-center gap-2 text-[13.5px]">
          <span className="truncate">{manifest.name}</span>
          {manifest.compatibility && (
            <span className={`shrink-0 rounded-md border px-1.5 text-[10.5px] ${COMPAT_TONE[manifest.compatibility]}`}>
              {t(`compat.${manifest.compatibility}`)}
            </span>
          )}
        </span>
        <span className="block truncate text-[12px] text-subtle">{details.join(' · ')}</span>
        {hint && <span className="mt-0.5 block truncate font-mono text-[11px] text-faint">{hint}</span>}
      </span>
      {selected && <Check size={16} className="shrink-0 text-fg" />}
      {action}
    </Tag>
  )
}

/**
 * Ações ao lado de cada projeto: Abrir (já na biblioteca), Baixar (instala do repositório oficial) ou,
 * nos jogos via emulador, Instalar o emulador / Adicionar o jogo (o arquivo do usuário). E o GitHub.
 */
function ProjectActions({ manifest }: { manifest: Manifest }) {
  const { items, info, manifests, navigate, toast } = useAppState()
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const runnerName = useRunnerName(manifest)
  const inLibrary = items.find((i) => i.entry.manifestId === manifest.id)

  const run = async (action: () => Promise<LibraryItem | null | void>, open = true) => {
    setBusy(true)
    try {
      const item = await action()
      if (item && open) navigate({ page: 'game', id: item.entry.id })
    } catch (err) {
      toast('error', errorMessage(err, t))
    } finally {
      setBusy(false)
    }
  }

  let main: ReactNode
  if (inLibrary) {
    main = (
      <Button size="sm" onClick={() => navigate({ page: 'game', id: inLibrary.entry.id })}>
        {t('add.open')}
      </Button>
    )
  } else if (manifest.runner) {
    const emulatorId = manifest.runner.manifest
    const emulator = manifests.manifests.find((m) => m.id === emulatorId)
    const name = runnerName ?? emulatorId
    const emulatorInstallable = !!emulator && !!info && installableOn(emulator, info.platform)
    main = items.some((i) => i.entry.manifestId === emulatorId) ? (
      <Button
        size="sm"
        icon={<Plus size={13} />}
        loading={busy}
        title={t('add.addGameHint', { name })}
        onClick={() => void run(() => window.api.library.addRunnerGame(manifest.id))}
      >
        {t('add.addGame')}
      </Button>
    ) : (
      <Button
        size="sm"
        icon={<Download size={13} />}
        loading={busy}
        disabled={!emulatorInstallable}
        title={emulatorInstallable ? t('add.installRunnerHint', { name }) : t('add.noDownload')}
        // Fica no catálogo: com o emulador na biblioteca, o botão vira "Adicionar".
        onClick={() => void run(() => window.api.library.install(emulatorId), false)}
      >
        {t('add.installRunner', { name })}
      </Button>
    )
  } else {
    const installable = !!info && installableOn(manifest, info.platform)
    main = (
      <Button
        size="sm"
        icon={<Download size={13} />}
        loading={busy}
        disabled={!installable}
        title={installable ? t('add.downloadHint') : t('add.noDownload')}
        onClick={() => void run(() => window.api.library.install(manifest.id))}
      >
        {t('add.download')}
      </Button>
    )
  }

  return (
    <span className="flex shrink-0 items-center gap-3">
      {manifest.generated && !inLibrary && (
        <button type="button" className="text-[12.5px] text-subtle hover:text-fg" onClick={() => setConfirmRemove(true)}>
          {t('add.removeCustom')}
        </button>
      )}
      {confirmRemove && (
        <ConfirmModal
          title={t('add.removeCustomTitle', { name: manifest.name })}
          body={t('add.removeCustomBody')}
          confirmLabel={t('add.removeCustom')}
          cancelLabel={t('common.cancel')}
          danger
          onCancel={() => setConfirmRemove(false)}
          onConfirm={() => {
            setConfirmRemove(false)
            void run(() => window.api.library.removeCustomManifest(manifest.id))
          }}
        />
      )}
      {main}
      <button type="button" className="text-[12.5px] text-link hover:underline" onClick={() => void window.api.app.openExternal(manifest.repoUrl)}>
        GitHub
      </button>
    </span>
  )
}

/** Colar o link de um repositório do GitHub e instalar o último release dele. */
function RepoInstall() {
  const { manifests, navigate, toast } = useAppState()
  const { t, locale } = useI18n()
  const [url, setUrl] = useState('')
  const [checking, setChecking] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [found, setFound] = useState<RepoInspection | null>(null)
  const [asset, setAsset] = useState('')
  // Cada verificação (e cada edição do link) ganha um número: resposta de um link antigo é descartada.
  const request = useRef(0)
  const known = found?.manifestId ? manifests.manifests.find((m) => m.id === found.manifestId) : undefined

  const check = async (e: FormEvent) => {
    e.preventDefault()
    const ticket = ++request.current
    setChecking(true)
    setFound(null)
    try {
      const result = await window.api.library.inspectRepo(url)
      if (ticket !== request.current) return
      setFound(result)
      // No empate (sem sugestão), o usuário escolhe o arquivo.
      setAsset(result.suggested ?? (result.assets.length === 1 ? result.assets[0].name : ''))
    } catch (err) {
      if (ticket === request.current) toast('error', errorMessage(err, t))
    } finally {
      if (ticket === request.current) setChecking(false)
    }
  }

  const install = async () => {
    if (!found) return
    setInstalling(true)
    try {
      // Instala exatamente o repositório que foi verificado e mostrado.
      const item = await window.api.library.installFromRepo(`https://github.com/${found.repo}`, asset)
      if (item) navigate({ page: 'game', id: item.entry.id })
    } catch (err) {
      toast('error', errorMessage(err, t))
    } finally {
      setInstalling(false)
    }
  }

  return (
    <Card className="mt-4 p-4">
      <div className="flex items-start gap-3">
        <FolderGit2 size={18} strokeWidth={1.7} className="mt-0.5 shrink-0 text-subtle" />
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px]">{t('repo.title')}</div>
          <div className="mt-0.5 text-[12px] text-subtle">{t('repo.subtitle')}</div>
          <form onSubmit={(e) => void check(e)} className="mt-3 flex flex-wrap gap-2">
            <input
              className="input min-w-[240px] flex-1 font-mono text-[12.5px]"
              value={url}
              spellCheck={false}
              aria-label={t('repo.title')}
              placeholder={t('repo.placeholder')}
              onChange={(e) => {
                request.current++
                setUrl(e.target.value)
                setFound(null)
                setChecking(false)
              }}
            />
            <Button type="submit" loading={checking} disabled={!url.trim()}>
              {t('repo.check')}
            </Button>
          </form>
          {found && (
            <div className="animate-fade-in mt-3 space-y-3 rounded-[10px] border border-line bg-field px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
                <span className="font-mono text-fg-2">{found.repo}</span>
                <span className="text-subtle">{t('repo.release', { tag: found.tag })}</span>
              </div>
              {known ? (
                <p className="text-[12.5px] text-fg-3">{t('repo.known', { name: known.name })}</p>
              ) : found.assets.length === 0 ? (
                <p className="text-[12.5px] text-bad">{t('repo.noAssets')}</p>
              ) : (
                <label className="flex flex-col gap-1 text-[12px] text-subtle">
                  {t('repo.asset')}
                  <select className="input font-mono text-[12px]" value={asset} onChange={(e) => setAsset(e.target.value)}>
                    {!asset && (
                      <option value="" disabled>
                        {t('repo.chooseAsset')}
                      </option>
                    )}
                    {found.assets.map((a) => (
                      <option key={a.name} value={a.name}>
                        {a.name} ({formatBytes(a.size, locale)})
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <p className="flex items-start gap-2 text-[11.5px] leading-relaxed text-faint">
                <ShieldCheck size={13} className="mt-px shrink-0" />
                {t('repo.warning')}
              </p>
              <div className="flex justify-end">
                <Button variant="primary" icon={<Download size={14} />} loading={installing} disabled={!known && !asset} onClick={() => void install()}>
                  {t('repo.install')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

/** Lista de projetos com busca, agrupada por plataforma; cada grupo abre e fecha. */
function Catalog() {
  const { manifests } = useAppState()
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<ReadonlySet<Category>>(() => new Set())
  const groups = groupCatalog(manifests.manifests, query)
  const searching = query.trim().length > 0
  const toggle = (category: Category) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (!next.delete(category)) next.add(category)
      return next
    })

  return (
    <div className="mt-10">
      <label className="mb-5 flex h-10 items-center gap-2.5 rounded-[11px] border border-field-line bg-field px-3 focus-within:border-chip-line">
        <Search size={15} className="shrink-0 text-subtle" />
        <input
          type="search"
          value={query}
          placeholder={t('add.search')}
          aria-label={t('add.search')}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none"
        />
      </label>
      <SectionLabel>{t('add.supported')}</SectionLabel>
      {groups.length === 0 ? (
        <p className="rounded-[14px] border border-line px-4 py-6 text-center text-[13px] text-subtle">{t('add.noMatches', { query: query.trim() })}</p>
      ) : (
        <div className="space-y-2.5">
          {groups.map((group) => {
            const expanded = searching || open.has(group.category)
            return (
              <section key={group.category} className="overflow-hidden rounded-[14px] border border-line">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => toggle(group.category)}
                  disabled={searching}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors enabled:hover:bg-hover/60"
                >
                  <ChevronDown size={16} className={`shrink-0 text-subtle transition-transform ${expanded ? '' : '-rotate-90'}`} />
                  <span className="flex-1 text-[13.5px] font-medium">{t(`catalog.${group.category}`)}</span>
                  <span className="rounded-md bg-chip px-1.5 font-mono text-[11px] text-subtle">{group.entries.length}</span>
                </button>
                {expanded && (
                  <div className="divide-y divide-line border-t border-line">
                    {group.entries.map((m) => (
                      <ManifestRow key={m.id} manifest={m} action={<ProjectActions manifest={m} />} />
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
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
      <PageHeader title={t('add.title')} subtitle={<GlossaryText>{t('add.subtitle')}</GlossaryText>} />

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
              <ManifestRow
                key={m.id}
                manifest={m}
                selected={selected?.manifestId === m.id && selected.path === folder}
                onSelect={() => setSelected({ manifestId: m.id, path: folder! })}
              />
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

      <RepoInstall />

      <Catalog />

      <p className="mt-8 flex items-start gap-2 text-[12px] text-faint">
        <ShieldCheck size={14} className="mt-px shrink-0" />
        <GlossaryText>{t('legal.note')}</GlossaryText>
      </p>
    </Page>
  )
}
