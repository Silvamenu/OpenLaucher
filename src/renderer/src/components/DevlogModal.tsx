import { Bug, Sparkles, TrendingUp, X } from 'lucide-react'
import type { NoteSectionKind } from '../../../shared/devlog'
import { useI18n } from '../i18n'
import { formatDate } from '../lib/format'
import { useAppState } from '../state/AppState'
import { Markdown } from './Markdown'
import { Button, Modal } from './ui'

const sectionStyle: Record<NoteSectionKind, { icon: typeof Sparkles | null; color: string }> = {
  novidades: { icon: Sparkles, color: 'text-blue-500 bg-blue-500/12' },
  melhorias: { icon: TrendingUp, color: 'text-violet-500 bg-violet-500/12' },
  correcoes: { icon: Bug, color: 'text-emerald-500 bg-emerald-500/12' },
  outros: { icon: null, color: '' }
}

/** Popup "Novidades da vX.Y.Z" exibido na primeira abertura após atualizar o launcher. */
export function DevlogModal() {
  const { devlog, closeDevlog } = useAppState()
  const { t, locale } = useI18n()
  if (!devlog) return null
  const { view } = devlog
  return (
    <Modal onClose={closeDevlog} labelledBy="devlog-title" className="max-w-xl">
      <header className="relative overflow-hidden border-b border-line px-6 pt-6 pb-5">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/15 via-indigo-500/10 to-transparent" />
        <div className="relative flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#3B82F6] text-white shadow-lg shadow-blue-900/30">
            <Sparkles size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="devlog-title" className="text-xl font-bold tracking-tight">
              {t('devlog.title', { version: view.version })}
            </h2>
            {view.date && <p className="mt-0.5 text-sm text-muted">{formatDate(`${view.date}T12:00:00`, locale)}</p>}
          </div>
          <button type="button" onClick={closeDevlog} aria-label={t('devlog.close')} className="rounded-lg p-1.5 text-muted transition hover:bg-subtle hover:text-fg">
            <X size={18} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
        {view.sections.length === 0 && <p className="text-sm text-muted">{t('devlog.empty')}</p>}
        {view.sections.map((section, i) => {
          const style = sectionStyle[section.kind]
          const Icon = style.icon
          const title = section.kind === 'outros' ? section.title : t(`devlog.section.${section.kind}`)
          return (
            <section key={i}>
              {title && (
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  {Icon && (
                    <span className={`flex h-6 w-6 items-center justify-center rounded-md ${style.color}`}>
                      <Icon size={14} />
                    </span>
                  )}
                  {title}
                </h3>
              )}
              <Markdown className="text-fg/90">{section.body}</Markdown>
            </section>
          )
        })}
      </div>

      <footer className="flex justify-end border-t border-line bg-card px-6 py-3">
        <Button variant="primary" onClick={closeDevlog} autoFocus>
          {t('devlog.ok')}
        </Button>
      </footer>
    </Modal>
  )
}
