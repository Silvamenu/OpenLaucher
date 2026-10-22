import { FileCog, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { applyIniEdits, flattenJson, parseIniFields, setJsonPath, stringifyJsonLike, type JsonPrimitive } from '../../../../shared/configForm'
import type { ConfigBackup, ConfigFileView, LibraryItem } from '../../../../shared/types'
import { Button, Card, Chip, ConfirmModal, Dot } from '../../components/ui'
import { useI18n } from '../../i18n'
import { errorMessage, formatDate } from '../../lib/format'
import { useAppState } from '../../state/AppState'

const FORM_LIMIT = 250

function FilterInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useI18n()
  return (
    <label className="mb-3 flex h-9 max-w-sm items-center gap-2 rounded-[10px] border border-field-line bg-field px-2.5">
      <Search size={14} className="shrink-0 text-subtle" />
      <input
        className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
        placeholder={t('cfg.search')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

const fieldInput =
  'h-8 w-full rounded-lg border border-field-line bg-field px-2.5 font-mono text-[12px] text-fg outline-none focus:border-chip-line disabled:opacity-60'

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
  if (!parsed.ok) {
    return (
      <p className="flex items-center gap-2 text-[13px] text-fg-3">
        <Dot tone="warn" /> {t('cfg.invalidJson')}
      </p>
    )
  }
  const fields = flattenJson(parsed.data)
  const q = filter.trim().toLowerCase()
  const matching = q ? fields.filter((f) => f.label.toLowerCase().includes(q) || String(f.value).toLowerCase().includes(q)) : fields
  const shown = matching.slice(0, FORM_LIMIT)
  const update = (path: (string | number)[], value: JsonPrimitive) => onChange(stringifyJsonLike(text, setJsonPath(parsed.data, path, value)))

  return (
    <div>
      <FilterInput value={filter} onChange={setFilter} />
      {fields.length === 0 && <p className="text-[13px] text-subtle">{t('cfg.noFields')}</p>}
      <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
        {shown.map((field) => (
          <div key={field.label} className="flex items-center gap-4 px-3.5 py-2">
            <label className="selectable min-w-0 flex-1 truncate font-mono text-[12px] text-muted" title={field.label}>
              {field.label}
            </label>
            <div className="w-[45%] max-w-sm shrink-0">
              {typeof field.value === 'boolean' ? (
                <input
                  type="checkbox"
                  disabled={readOnly}
                  checked={field.value}
                  onChange={(e) => update(field.path, e.target.checked)}
                  className="h-4 w-4 accent-[var(--primary)]"
                />
              ) : typeof field.value === 'number' ? (
                <input
                  type="number"
                  disabled={readOnly}
                  className={fieldInput}
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
                  className={fieldInput}
                  value={field.value === null ? '' : String(field.value)}
                  placeholder={field.value === null ? 'null' : ''}
                  onChange={(e) => update(field.path, e.target.value)}
                />
              )}
            </div>
          </div>
        ))}
      </div>
      {matching.length > FORM_LIMIT && <p className="mt-2 text-[12px] text-subtle">{t('cfg.tooMany', { shown: FORM_LIMIT, total: matching.length })}</p>}
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
  if (fields.length === 0) return <p className="text-[13px] text-subtle">{t('cfg.noFields')}</p>
  return (
    <div>
      <FilterInput value={filter} onChange={setFilter} />
      <div className="space-y-3">
        {sections.map((section) => (
          <div key={section} className="overflow-hidden rounded-xl border border-line">
            {section && <div className="border-b border-line px-3.5 py-2 font-mono text-[11.5px] text-subtle">[{section}]</div>}
            <div className="divide-y divide-line">
              {visible
                .filter((f) => f.section === section)
                .map((f) => (
                  <div key={f.line} className="flex items-center gap-4 px-3.5 py-2">
                    <label className="min-w-0 flex-1 truncate font-mono text-[12px] text-muted">{f.key}</label>
                    <input
                      disabled={readOnly}
                      className={`${fieldInput} w-[45%] max-w-sm`}
                      value={f.value}
                      onChange={(e) => onChange(applyIniEdits(text, [{ line: f.line, value: e.target.value }]))}
                    />
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
      {fields.length > FORM_LIMIT && <p className="mt-2 text-[12px] text-subtle">{t('cfg.tooMany', { shown: visible.length, total: fields.length })}</p>}
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
        setIndex(list[0]?.index ?? 0)
        setDraft(list[0]?.content ?? '')
      })
      .catch((err) => toast('error', errorMessage(err, t)))
    return () => {
      alive = false
    }
  }, [id, toast, t])

  const current = files?.find((f) => f.index === index) ?? files?.[0]
  const dirty = !!current && draft !== current.content

  if (!files) return <p className="text-[13px] text-subtle">{t('common.loading')}</p>
  if (files.length === 0 || !current) return <p className="text-[13px] text-subtle">{t('cfg.empty')}</p>

  const select = (to: number) => {
    const next = files.find((f) => f.index === to)
    if (!next) return
    setIndex(to)
    setDraft(next.content)
    setBackups(null)
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

  const toggleBackups = async () => {
    if (backups) return setBackups(null)
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
    <div className="grid gap-4 lg:grid-cols-[230px_1fr]">
      <div className="flex flex-col gap-0.5">
        {files.map((f) => (
          <button
            key={f.index}
            type="button"
            onClick={() => (f.index === index ? undefined : dirty ? setConfirm({ kind: 'switch', to: f.index }) : select(f.index))}
            className={`flex items-start gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-colors ${f.index === index ? 'bg-hover text-fg' : 'text-muted hover:bg-hover/60 hover:text-fg'}`}
          >
            <FileCog size={16} strokeWidth={1.7} className="mt-0.5 shrink-0" />
            <span className="min-w-0">
              <span className="block truncate text-[13px]">{f.label}</span>
              <span className="block truncate font-mono text-[10.5px] text-faint">{f.exists ? f.format.toUpperCase() : t('cfg.missingShort')}</span>
            </span>
          </button>
        ))}
      </div>

      <Card className="min-w-0 p-4">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-medium">{current.label}</div>
            <div className="selectable truncate font-mono text-[11px] text-faint" title={current.path}>
              {current.path}
            </div>
          </div>
          {current.format !== 'text' && (
            <div className="flex gap-1.5">
              <Chip active={effectiveMode === 'form'} onClick={() => setMode('form')}>
                {t('cfg.form')}
              </Chip>
              <Chip active={effectiveMode === 'text'} onClick={() => setMode('text')}>
                {t('cfg.text')}
              </Chip>
            </div>
          )}
        </div>

        {!current.exists && (
          <p className="mb-3 flex items-center gap-2 rounded-[10px] border border-line px-3 py-2 text-[12.5px] text-fg-3">
            <Dot tone="warn" /> {t('cfg.notExists')}
          </p>
        )}
        {readOnly && <p className="mb-3 text-[12px] text-subtle">{t('cfg.readOnly')}</p>}

        {effectiveMode === 'text' ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            readOnly={readOnly}
            spellCheck={false}
            className="h-[420px] w-full resize-y rounded-xl border border-field-line bg-field p-3 font-mono text-[12px] leading-relaxed text-fg outline-none focus:border-chip-line"
          />
        ) : current.format === 'json' ? (
          <JsonForm text={draft} onChange={setDraft} readOnly={readOnly} />
        ) : (
          <IniForm text={draft} onChange={setDraft} readOnly={readOnly} />
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <Button variant="primary" disabled={!dirty || readOnly} loading={saving} onClick={save}>
            {t('cfg.save')}
          </Button>
          <Button variant="ghost" disabled={!dirty} onClick={() => setDraft(current.content)}>
            {t('cfg.discard')}
          </Button>
          <Button variant="ghost" onClick={toggleBackups}>
            {t('cfg.backups')}
          </Button>
          {dirty && (
            <span className="flex items-center gap-1.5 text-[12px] text-fg-3">
              <Dot tone="warn" /> {t('cfg.unsaved')}
            </span>
          )}
          <span className="ml-auto text-[11.5px] text-faint">{t('cfg.backupHint')}</span>
        </div>

        {backups && (
          <div className="animate-fade-in mt-3 overflow-hidden rounded-xl border border-line">
            {backups.length === 0 && <p className="px-3.5 py-2.5 text-[12px] text-subtle">{t('cfg.noBackups')}</p>}
            {backups.map((b) => (
              <div key={b.name} className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-2 last:border-b-0">
                <span className="font-mono text-[12px] text-fg-3">{formatDate(b.createdAt, locale, true)}</span>
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
