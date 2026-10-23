import { ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'
import { Page, PageHeader } from '../components/ui'
import { useI18n, type TranslationKey } from '../i18n'

interface Question {
  q: TranslationKey
  a: TranslationKey
  /** Recomendação em destaque logo abaixo da pergunta. */
  note?: TranslationKey
}

/** A da ROM vem primeiro e já começa aberta. Nas respostas, cada parágrafo é uma linha. */
const QUESTIONS: Question[] = [
  { q: 'faq.rom.q', note: 'faq.rom.note', a: 'faq.rom.a' },
  { q: 'faq.useRom.q', a: 'faq.useRom.a' },
  { q: 'faq.sha1.q', a: 'faq.sha1.a' },
  { q: 'faq.port.q', a: 'faq.port.a' },
  { q: 'faq.download.q', a: 'faq.download.a' },
  { q: 'faq.art.q', a: 'faq.art.a' },
  { q: 'faq.saves.q', a: 'faq.saves.a' },
  { q: 'faq.wontStart.q', a: 'faq.wontStart.a' },
  { q: 'faq.warning.q', a: 'faq.warning.a' },
  { q: 'faq.data.q', a: 'faq.data.a' },
  { q: 'faq.pin.q', a: 'faq.pin.a' },
  { q: 'faq.official.q', a: 'faq.official.a' }
]

export function FaqPage() {
  const { t } = useI18n()
  const base = useId()
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set([0]))
  const toggle = (index: number) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (!next.delete(index)) next.add(index)
      return next
    })
  // Nomes de botões e abas citados nas respostas: sempre iguais aos da interface.
  const labels = {
    setupTab: t('game.tabs.setup'),
    aboutTab: t('game.tabs.about'),
    updatesTab: t('game.tabs.updates'),
    selectFile: t('req.selectFile'),
    copyToGame: t('req.copyToGame'),
    openFirstTime: t('req.openFirstTime'),
    locate: t('game.missingFolder.locate'),
    settings: t('nav.settings'),
    openData: t('settings.openData'),
    play: t('game.play'),
    gameOptions: t('game.more'),
    clearCover: t('game.clearCover'),
    clearBanner: t('game.clearBanner')
  }

  return (
    <Page narrow>
      <PageHeader title={t('faq.title')} subtitle={t('faq.subtitle')} />
      <div className="divide-y divide-line overflow-hidden rounded-[14px] border border-line">
        {QUESTIONS.map((item, index) => {
          const expanded = open.has(index)
          const panel = `${base}-${index}`
          return (
            <section key={item.q}>
              <h2>
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={panel}
                  onClick={() => toggle(index)}
                  className="flex w-full items-start gap-3 px-[18px] py-4 text-left transition-colors hover:bg-hover/60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium text-fg">{t(item.q)}</span>
                    {item.note && <span className="mt-1 block text-[13px] font-medium text-warn">{t(item.note)}</span>}
                  </span>
                  <ChevronDown size={16} className={`mt-0.5 shrink-0 text-subtle transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </button>
              </h2>
              <div id={panel} hidden={!expanded} className="selectable space-y-2.5 px-[18px] pb-5 text-[13.5px] leading-relaxed text-fg-3">
                {t(item.a, labels)
                  .split('\n')
                  .map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
              </div>
            </section>
          )
        })}
      </div>
    </Page>
  )
}
