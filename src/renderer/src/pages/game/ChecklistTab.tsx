import { ChevronDown, CircleCheck, CircleDashed, CircleX, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import type { LibraryItem, RequirementStatus, RequirementsReport } from '../../../../shared/types'
import { GlossaryText } from '../../components/Glossary'
import { Markdown } from '../../components/Markdown'
import { Button, Card, Dot } from '../../components/ui'
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

export function ChecklistTab({
  item,
  report,
  onReport,
  onLaunch
}: {
  item: LibraryItem
  report: RequirementsReport | null
  onReport: (report: RequirementsReport) => void
  onLaunch: () => Promise<void>
}) {
  const { toast } = useAppState()
  const { t } = useI18n()
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const id = item.entry.id

  const run = async (key: string, action: () => Promise<RequirementsReport | void>, success?: string) => {
    setBusy(key)
    try {
      const result = await action()
      if (result) onReport(result)
      if (success) toast('success', success)
    } catch (err) {
      toast('error', errorMessage(err, t))
    } finally {
      setBusy(null)
    }
  }

  if (!report) return <p className="text-[13px] text-subtle">{t('common.loading')}</p>

  const pending = report.items.filter((i) => !i.ok && !i.optional).length

  return (
    <div className="max-w-[860px] space-y-4">
      <div className="flex items-center gap-2.5 text-[13px] text-fg-3">
        <Dot tone={pending === 0 ? 'ok' : 'warn'} />
        {pending === 0 ? t('req.allGood') : t('req.pending', { n: pending })}
      </div>

      <Card className="divide-y divide-line overflow-hidden">
        {report.items.map((req) => {
          const Icon = req.ok ? CircleCheck : req.optional ? CircleDashed : CircleX
          const color = req.ok ? 'text-ok' : req.optional ? 'text-faint' : 'text-bad'
          const label = req.type === 'executable' ? `${t('req.executable')} · ${req.label}` : req.label
          return (
            <div key={req.id} className="px-[18px] py-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Icon size={18} strokeWidth={1.8} className={`shrink-0 ${color}`} aria-label={req.ok ? '✓' : '✗'} />
                <div className="min-w-[220px] flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[13.5px]">
                    <GlossaryText>{label}</GlossaryText>
                    {req.optional && <span className="rounded-md border border-line px-1.5 font-mono text-[10.5px] text-faint">{t('req.optional')}</span>}
                  </div>
                  <div className={`selectable mt-0.5 truncate text-[12px] ${req.ok || req.optional ? 'text-subtle' : 'text-bad'}`} title={req.found}>
                    <GlossaryText>{detailText(req, t)}</GlossaryText>
                    {req.type === 'userFile' && req.found && req.detail !== 'missingFile' ? ` — ${req.found}` : ''}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(req.type === 'executable' || req.type === 'file') && !req.ok && (
                    <Button size="sm" onClick={() => run('folder', () => window.api.library.openFolder(id))}>
                      {t('game.openFolder')}
                    </Button>
                  )}
                  {req.type === 'userFile' && (
                    <>
                      <Button
                        size="sm"
                        variant={req.ok || req.optional ? 'secondary' : 'primary'}
                        loading={busy === `pick-${req.id}`}
                        onClick={() => run(`pick-${req.id}`, () => window.api.library.pickUserFile(id, req.id))}
                      >
                        {req.found ? t('req.changeFile') : t('req.selectFile')}
                      </Button>
                      {req.canCopyToGameDir && (
                        <Button
                          size="sm"
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
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={item.running || item.busy || !report.executable}
                        onClick={() => run(`launch-${req.id}`, onLaunch)}
                      >
                        {t('req.openFirstTime')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => run(`mark-${req.id}`, () => window.api.library.setFirstRunDone(id, req.id, true))}>
                        {t('req.markDone')}
                      </Button>
                    </>
                  )}
                  {req.type === 'firstRun' && req.detail === 'markedDone' && item.entry.firstRunDone[req.id] && (
                    <Button size="sm" variant="ghost" onClick={() => run(`mark-${req.id}`, () => window.api.library.setFirstRunDone(id, req.id, false))}>
                      {t('req.unmark')}
                    </Button>
                  )}
                  {req.helpText && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setOpen((o) => ({ ...o, [req.id]: !o[req.id] }))}
                      icon={<ChevronDown size={14} className={`transition-transform ${open[req.id] ? 'rotate-180' : ''}`} />}
                    >
                      {open[req.id] ? t('req.hideInstructions') : t('req.instructions')}
                    </Button>
                  )}
                </div>
              </div>
              {req.helpText && open[req.id] && (
                <div className="animate-fade-in mt-3 ml-[30px] rounded-[10px] border border-line bg-field px-4 py-3">
                  <Markdown glossary>{req.helpText}</Markdown>
                </div>
              )}
            </div>
          )
        })}
      </Card>

      <p className="flex items-start gap-2 text-[12px] text-faint">
        <ShieldCheck size={14} className="mt-px shrink-0" />
        <GlossaryText>{t('legal.note')}</GlossaryText>
      </p>
    </div>
  )
}
