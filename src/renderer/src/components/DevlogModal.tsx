import { Bug, Sparkles, TrendingUp, X } from 'lucide-react'
import type { NoteSectionKind } from '../../../shared/devlog'
import { useI18n } from '../i18n'
import { formatDate } from '../lib/format'
import { useAppState } from '../state/AppState'
import { LogoMark } from './icons'
import { Markdown } from './Markdown'
import { Button, Modal, ModalFooter } from './ui'

const sectionIcon: Record<NoteSectionKind, typeof Sparkles | null> = {
  novidades: Sparkles,
  melhorias: TrendingUp,
  correcoes: Bug,
  outros: null
}

const sectionTone: Record<NoteSectionKind, string> = {
  novidades: 'text-accent-fg',
  melhorias: 'text-warn',
  correcoes: 'text-ok',
  outros: 'text-subtle'
}

/** Popup "Novidades da vX.Y.Z" exibido na primeira abertura após atualizar o launcher. */
export function DevlogModal() {
  const { devlog, closeDevlog } = useAppState()
  const { t, locale } = useI18n()
  if (!devlog) return null
  const { view } = devlog
  return (
    <Modal onClose={closeDevlog} labelledBy="devlog-title" className="max-w-[560px]">
      <header className="flex items-start gap-3.5 px-6 pt-6 pb-5">
        <LogoMark size={36} />
        <div className="min-w-0 flex-1">
          <h2 id="devlog-title" className="text-[20px] leading-tight font-semibold tracking-[-0.02em]">
            {t('devlog.title', { version: view.version })}
          </h2>
          {view.date && <p className="mt-1 font-mono text-[11.5px] text-faint">{formatDate(`${view.date}T12:00:00`, locale)}</p>}
        </div>
        <button
          type="button"
          onClick={closeDevlog}
          aria-label={t('devlog.close')}
          className="-mt-1 -mr-1 rounded-lg p-1.5 text-subtle transition-colors hover:bg-hover hover:text-fg"
        >
          <X size={18} />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto border-t border-line px-6 py-5">
        {view.sections.length === 0 && <p className="text-[13px] text-subtle">{t('devlog.empty')}</p>}
        {view.sections.map((section, i) => {
          const Icon = sectionIcon[section.kind]
          const title = section.kind === 'outros' ? section.title : t(`devlog.section.${section.kind}`)
          return (
            <section key={i}>
              {title && (
                <h3 className="mb-2 flex items-center gap-2 text-[11.5px] tracking-[0.04em] text-faint uppercase">
                  {Icon && <Icon size={13} className={sectionTone[section.kind]} />}
                  {title}
                </h3>
              )}
              <Markdown>{section.body}</Markdown>
            </section>
          )
        })}
      </div>

      <ModalFooter>
        <Button variant="primary" onClick={closeDevlog} autoFocus>
          {t('devlog.ok')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
