import { FileCog, History, RotateCcw, Save, Search, TriangleAlert } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { applyIniEdits, flattenJson, parseIniFields, setJsonPath, stringifyJsonLike, type JsonPrimitive } from '../../../../shared/configForm'
import type { ConfigBackup, ConfigFileView, LibraryItem } from '../../../../shared/types'
import { Button, Card, ConfirmModal } from '../../components/ui'
import { useI18n } from '../../i18n'
import { errorMessage, formatDate } from '../../lib/format'
import { useAppState } from '../../state/AppState'

const FORM_LIMIT = 250

function JsonForm({ text, onChange, readOnly }: { text: string; onChange: (text: string) => void; readOnly: boolean }) {
  const { t } = useI18n()
  const [filter, setFilter] = useState('')
  const parsed = useMemo(() => {
    try {
      return { ok: true as const, data: JSON.parse(text || '{}') as unknown }
    } catch {
      return { ok: false as const }
    }
  }, [text])
  if (!parsed.ok) return <p className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400"><TriangleAlert size={16} /> {t('cfg.invalidJson')}</p>
  const fields = flattenJson(parsed.data)
  const q = filter.trim().toLowerCase()
  const matching = q ? fields.filter((f) => f.label.toLowerCase().includes(q) || String(f.value).toLowerCase().includes(q)) : fields
  const shown = matching.slice(0, FORM_LIMIT)
  const update = (path: (string | number)[], value: JsonPrimitive) => onChange(stringifyJsonLike(text, setJsonPath(parsed.data, path, value)))

  return (
    <div>
      <div className="relative mb-3 max-w-sm">
        <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
        <input className="input w-full pl-9" placeholder={t('cfg.search')} value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>
      {fields.length === 0 && <p className="text-sm text-muted">{t('cfg.noFields')}</p>}
      <div className="divide-y divide-line rounded-lg border border-line">
        {shown.map((field) => (
          <div key={field.label} className="flex items-center gap-4 px-3 py-2">
            <label className="selectable min-w-0 flex-1 truncate font-mono text-xs text-muted" title={field.label}>
              {field.label}
            </label>
            <div className="w-[45%] max-w-sm shrink-0">
              {typeof field.value === 'boolean' ? (
                <input type="checkbox" disabled={readOnly} checked={field.value} onChange={(e) => update(field.path, e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
              ) : typeof field.value === 'number' ? (
                <input
                  type="number"
                  disabled={readOnly}
                  className="input h-8 w-full font-mono text-xs"
                  value={field.value}
                  step="any"
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    if (e.target.value !== '' && Number.isFinite(n)) update(field.path, n)
                  }}
                />
              ) : (
                <input
                  disabled={readOnly}
                  className="input h-8 w-full font-mono text-xs"
                  value={field.value === null ? '' : String(field.value)}
                  placeholder={field.value === null ? 'null' : ''}
                  onChange={(e) => update(field.path, e.target.value)}
                />
              )}
            </div>
          </div>
        ))}
      </div>
      {matching.length > FORM_LIMIT && <p className="mt-2 text-xs text-muted">{t('cfg.tooMany', { shown: FORM_LIMIT, total: matching.length })}</p>}
    </div>
  )
}

function IniForm({ text, onChange, readOnly }: { text: string; onChange: (text: string) => void; readOnly: boolean }) {
  const { t } = useI18n()
  const [filter, setFilter] = useState('')
  const fields = useMemo(() => parseIniFields(text), [text])
  const q = filter.trim().toLowerCase()
  const visible = (q ? fields.filter((f) => `${f.section} ${f.key} ${f.value}`.toLowerCase().includes(q)) : fields).slice(0, FORM_LIMIT)
  const sections = [...new Set(visible.map((f) => f.section))]
  if (fields.length === 0) return <p className="text-sm text-muted">{t('cfg.noFields')}</p>
  return (
    <div>
      <div className="relative mb-3 max-w-sm">
        <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
        <input className="input w-full pl-9" placeholder={t('cfg.search')} value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>
      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section} className="rounded-lg border border-line">
            {section && <div className="border-b border-line bg-subtle px-3 py-1.5 font-mono text-xs font-semibold">[{section}]</div>}
            <div className="divide-y divide-line">
              {visible
                .filter((f) => f.section === section)
                .map((f) => (
                  <div key={f.line} className="flex items-center gap-4 px-3 py-2">
                    <label className="min-w-0 flex-1 truncate font-mono text-xs text-muted">{f.key}</label>
                    <input
                      disabled={readOnly}
                      className="input h-8 w-[45%] max-w-sm font-mono text-xs"
                      value={f.value}
                      onChange={(e) => onChange(applyIniEdits(text, [{ line: f.line, value: e.target.value }]))}
                    />
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
      {fields.length > FORM_LIMIT && <p className="mt-2 text-xs text-muted">{t('cfg.tooMany', { shown: visible.length, total: fields.length })}</p>}
    </div>
  )
}

export function ConfigsTab({ item }: { item: LibraryItem }) {
  const { toast } = useAppState()
  const { t, locale } = useI18n()
  const id = item.entry.id
  const [files, setFiles] = useState<ConfigFileView[] | null>(null)
  const [index, setIndex] = useState(0)
  const [draft, setDraft] = useState('')
  const [mode, setMode] = useState<'form' | 'text'>('form')
  const [saving, setSaving] = useState(false)
  const [backups, setBackups] = useState<ConfigBackup[] | null>(null)
  const [confirm, setConfirm] = useState<null | { kind: 'switch'; to: number } | { kind: 'restore'; name: string }>(null)

  useEffect(() => {
    let alive = true
    void window.api.configs
      .list(id)
      .then((list) => {
        if (!alive) return
        setFiles(list)
        setIndex(0)
        setDraft(list[0]?.content ?? '')
      })
      .catch((err) => toast('error', errorMessage(err, t)))
    return () => {
      alive = false
    }
  }, [id, toast, t])

  const current = files?.find((f) => f.index === index) ?? files?.[0]
  const dirty = !!current && draft !== current.content

  useEffect(() => {
    setBackups(null)
  }, [index])

  if (!files) return <p className="text-sm text-muted">{t('common.loading')}</p>
  if (files.length === 0 || !current) return <p className="text-sm text-muted">{t('cfg.empty')}</p>

  const select = (to: number) => {
    const next = files.find((f) => f.index === to)
    if (!next) return
    setIndex(to)
    setDraft(next.content)
    setMode(next.format === 'text' ? 'text' : 'form')
  }

  const replaceFile = (view: ConfigFileView) => {
    setFiles((list) => list?.map((f) => (f.index === view.index ? view : f)) ?? null)
    setDraft(view.content)
  }

  const save = async () => {
    setSaving(true)
    try {
      replaceFile(await window.api.configs.save(id, current.index, draft))
      setBackups(null)
      toast('success', t('cfg.saved'))
    } catch (err) {
      toast('error', errorMessage(err, t))
    } finally {
      setSaving(false)
    }
  }

  const loadBackups = async () => {
    try {
      setBackups(await window.api.configs.backups(id, current.index))
    } catch (err) {
      toast('error', errorMessage(err, t))
    }
  }

  const restore = async (name: string) => {
    try {
      replaceFile(await window.api.configs.restore(id, current.index, name))
      setBackups(await window.api.configs.backups(id, current.index))
      toast('success', t('cfg.restored'))
    } catch (err) {
      toast('error', errorMessage(err, t))
    }
  }

  const readOnly = !current.editable
  const effectiveMode = current.format === 'text' ? 'text' : mode

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <div className="flex flex-col gap-1">
        {files.map((f) => (
          <button
            key={f.index}
            type="button"
            onClick={() => (f.index === index ? undefined : dirty ? setConfirm({ kind: 'switch', to: f.index }) : select(f.index))}
            className={`flex items-start gap-2.5 rounded-lg px-3 py-2 text-left transition ${f.index === index ? 'bg-accent/12 text-fg' : 'text-muted hover:bg-subtle hover:text-fg'}`}
          >
            <FileCog size={16} className="mt-0.5 shrink-0" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{f.label}</span>
              <span className="block truncate text-[11px] opacity-70">{f.exists ? f.format.toUpperCase() : t('cfg.missingShort')}</span>
            </span>
          </button>
        ))}
      </div>

      <Card className="min-w-0 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{current.label}</div>
            <div className="selectable truncate font-mono text-[11px] text-muted" title={current.path}>
              {current.path}
            </div>
          </div>
          {current.format !== 'text' && (
            <div className="flex rounded-lg border border-line p-0.5">
              {(['form', 'text'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded-md px-3 py-1 text-xs font-medium ${effectiveMode === m ? 'bg-accent text-white' : 'text-muted hover:text-fg'}`}
                >
                  {m === 'form' ? t('cfg.form') : t('cfg.text')}
                </button>
              ))}
            </div>
          )}
        </div>

        {!current.exists && <p className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">{t('cfg.notExists')}</p>}
        {readOnly && <p className="mb-3 text-xs text-muted">{t('cfg.readOnly')}</p>}

        {effectiveMode === 'text' ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            readOnly={readOnly}
            spellCheck={false}
            className="input h-[420px] w-full resize-y py-2 font-mono text-xs leading-relaxed"
          />
        ) : current.format === 'json' ? (
          <JsonForm text={draft} onChange={setDraft} readOnly={readOnly} />
        ) : (
          <IniForm text={draft} onChange={setDraft} readOnly={readOnly} />
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <Button variant="primary" icon={<Save size={15} />} disabled={!dirty || readOnly} loading={saving} onClick={save}>
            {t('cfg.save')}
          </Button>
          <Button variant="ghost" icon={<RotateCcw size={15} />} disabled={!dirty} onClick={() => setDraft(current.content)}>
            {t('cfg.discard')}
          </Button>
          <Button variant="ghost" icon={<History size={15} />} onClick={loadBackups}>
            {t('cfg.backups')}
          </Button>
          {dirty && <span className="text-xs font-medium text-amber-600 dark:text-amber-400">● {t('cfg.unsaved')}</span>}
          <span className="ml-auto text-[11px] text-muted">{t('cfg.backupHint')}</span>
        </div>

        {backups && (
          <div className="mt-3 rounded-lg border border-line">
            {backups.length === 0 && <p className="px-3 py-2 text-xs text-muted">{t('cfg.noBackups')}</p>}
            {backups.map((b) => (
              <div key={b.name} className="flex items-center justify-between gap-3 border-b border-line px-3 py-2 last:border-b-0">
                <span className="text-xs">{formatDate(b.createdAt, locale, true)}</span>
                <Button size="sm" variant="ghost" disabled={readOnly} onClick={() => setConfirm({ kind: 'restore', name: b.name })}>
                  {t('cfg.restore')}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {confirm && (
        <ConfirmModal
          title={confirm.kind === 'switch' ? t('cfg.unsaved') : t('cfg.restore')}
          body={confirm.kind === 'switch' ? t('cfg.discardConfirm') : t('cfg.backupHint')}
          confirmLabel={t('common.confirm')}
          cancelLabel={t('common.cancel')}
          danger={confirm.kind === 'switch'}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            if (confirm.kind === 'switch') select(confirm.to)
            else void restore(confirm.name)
            setConfirm(null)
          }}
        />
      )}
    </div>
  )
}
