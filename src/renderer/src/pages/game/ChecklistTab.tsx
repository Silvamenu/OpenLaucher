import { ChevronDown, CircleCheck, CircleDashed, CircleX, Copy, FileSearch, FolderOpen, Play, ShieldCheck, SquareCheck, Undo2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { LibraryItem, RequirementStatus, RequirementsReport } from '../../../../shared/types'
import { Markdown } from '../../components/Markdown'
import { Button, Card } from '../../components/ui'
import { useI18n, type TFunction } from '../../i18n'
import { errorMessage } from '../../lib/format'
import { useAppState } from '../../state/AppState'

function detailText(item: RequirementStatus, t: TFunction): string {
  switch (item.detail) {
    case 'ok':
      if (item.type === 'userFile') return item.matchedLabel ? t('req.recognized', { label: item.matchedLabel }) : t('req.valid')
      return item.found ? t('req.found', { file: item.found }) : t('req.markedDone')
    case 'notFound':
      return t('req.notFound')
    case 'notSelected':
      return t('req.notSelected')
    case 'missingFile':
      return t('req.missingFile')
    case 'sizeMismatch':
      return t('req.sizeMismatch')
    case 'hashMismatch':
      return t('req.hashMismatch')
    case 'notDone':
      return t('req.notDone')
    case 'markedDone':
      return t('req.markedDone')
  }
}

export function ChecklistTab({ item, onLaunch }: { item: LibraryItem; onLaunch: () => Promise<void> }) {
  const { toast } = useAppState()
  const { t } = useI18n()
  const [report, setReport] = useState<RequirementsReport | null>(null)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const id = item.entry.id

  useEffect(() => {
    let alive = true
    void window.api.library.requirements(id).then((r) => alive && setReport(r))
    return () => {
      alive = false
    }
    // Recarrega quando a biblioteca muda (ex.: arquivos gerados após abrir o jogo).
  }, [id, item])

  const run = async (key: string, action: () => Promise<RequirementsReport | void>, success?: string) => {
    setBusy(key)
    try {
      const result = await action()
      if (result) setReport(result)
      if (success) toast('success', success)
    } catch (err) {
      toast('error', errorMessage(err, t))
    } finally {
      setBusy(null)
    }
  }

  if (!report) return <p className="text-sm text-muted">{t('common.loading')}</p>

  const pending = report.items.filter((i) => !i.ok && !i.optional).length

  return (
    <div className="space-y-4">
      <div
        className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
          pending === 0 ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300'
        }`}
      >
        {pending === 0 ? <CircleCheck size={18} /> : <CircleDashed size={18} />}
        <span className="font-medium">{pending === 0 ? t('req.allGood') : t('req.pending', { n: pending })}</span>
      </div>

      <Card className="divide-y divide-line">
        {report.items.map((req) => {
          const Icon = req.ok ? CircleCheck : req.optional ? CircleDashed : CircleX
          const color = req.ok ? 'text-emerald-500' : req.optional ? 'text-muted' : 'text-red-500'
          const label = req.type === 'executable' ? `${t('req.executable')} (${req.label})` : req.label
          return (
            <div key={req.id} className="p-4">
              <div className="flex flex-wrap items-start gap-3">
                <Icon size={22} className={`mt-0.5 shrink-0 ${color}`} aria-label={req.ok ? '✓' : '✗'} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{label}</span>
                    {req.optional && <span className="rounded-full bg-subtle px-2 py-0.5 text-[10px] font-semibold text-muted uppercase">{t('req.optional')}</span>}
                  </div>
                  <div className={`selectable mt-0.5 truncate text-xs ${req.ok ? 'text-muted' : req.optional ? 'text-muted' : 'text-red-500 dark:text-red-400'}`} title={req.found}>
                    {detailText(req, t)}
                    {req.type === 'userFile' && req.found && req.detail !== 'missingFile' ? ` — ${req.found}` : ''}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {req.type === 'executable' && !req.ok && (
                    <Button size="sm" icon={<FolderOpen size={14} />} onClick={() => run('folder', () => window.api.library.openFolder(id))}>
                      {t('game.openFolder')}
                    </Button>
                  )}
                  {req.type === 'file' && !req.ok && (
                    <Button size="sm" icon={<FolderOpen size={14} />} onClick={() => run('folder', () => window.api.library.openFolder(id))}>
                      {t('game.openFolder')}
                    </Button>
                  )}
                  {req.type === 'userFile' && (
                    <>
                      <Button
                        size="sm"
                        variant={req.ok ? 'secondary' : 'primary'}
                        icon={<FileSearch size={14} />}
                        loading={busy === `pick-${req.id}`}
                        onClick={() => run(`pick-${req.id}`, () => window.api.library.pickUserFile(id, req.id))}
                      >
                        {req.found ? t('req.changeFile') : t('req.selectFile')}
                      </Button>
                      {req.canCopyToGameDir && (
                        <Button
                          size="sm"
                          icon={<Copy size={14} />}
                          loading={busy === `copy-${req.id}`}
                          onClick={() => run(`copy-${req.id}`, () => window.api.library.copyUserFile(id, req.id), t('req.copied'))}
                        >
                          {t('req.copyToGame')}
                        </Button>
                      )}
                    </>
                  )}
                  {req.type === 'firstRun' && !req.ok && (
                    <>
                      <Button size="sm" variant="primary" icon={<Play size={14} />} disabled={item.running || item.busy || !report.executable} onClick={() => run(`launch-${req.id}`, onLaunch)}>
                        {t('req.openFirstTime')}
                      </Button>
                      <Button size="sm" variant="ghost" icon={<SquareCheck size={14} />} onClick={() => run(`mark-${req.id}`, () => window.api.library.setFirstRunDone(id, req.id, true))}>
                        {t('req.markDone')}
                      </Button>
                    </>
                  )}
                  {req.type === 'firstRun' && req.detail === 'markedDone' && item.entry.firstRunDone[req.id] && (
                    <Button size="sm" variant="ghost" icon={<Undo2 size={14} />} onClick={() => run(`mark-${req.id}`, () => window.api.library.setFirstRunDone(id, req.id, false))}>
                      {t('req.unmark')}
                    </Button>
                  )}
                  {req.helpText && (
                    <Button size="sm" variant="ghost" onClick={() => setOpen((o) => ({ ...o, [req.id]: !o[req.id] }))} icon={<ChevronDown size={14} className={`transition ${open[req.id] ? 'rotate-180' : ''}`} />}>
                      {open[req.id] ? t('req.hideInstructions') : t('req.instructions')}
                    </Button>
                  )}
                </div>
              </div>
              {req.helpText && open[req.id] && (
                <div className="animate-fade-in mt-3 ml-9 rounded-lg bg-subtle px-4 py-3">
                  <Markdown>{req.helpText}</Markdown>
                </div>
              )}
            </div>
          )
        })}
      </Card>

      <p className="flex items-start gap-2 text-xs text-muted">
        <ShieldCheck size={15} className="mt-px shrink-0 text-emerald-500" />
        {t('legal.note')}
      </p>
    </div>
  )
}
