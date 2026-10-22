import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { splitGlossary, type GlossaryId } from '../../../shared/glossary'
import { useI18n } from '../i18n'

// Espera para abrir (não pisca ao passar o mouse pelo texto) e para fechar (dá tempo de levar o mouse até a dica).
const OPEN_DELAY_MS = 250
const CLOSE_DELAY_MS = 150
const GAP = 6
const MARGIN = 8

/** Fecha a dica aberta: só uma fica visível por vez. */
let closeCurrent: (() => void) | null = null

/** Põe a dica abaixo do termo (ou acima, se não couber), sem sair da janela. Devolve false se o termo está fora da tela. */
function place(target: HTMLElement | null, el: HTMLElement | null): boolean {
  if (!target || !el) return false
  const a = target.getBoundingClientRect()
  if (a.bottom < 0 || a.top > window.innerHeight) return false
  const { width, height } = el.getBoundingClientRect()
  const top = a.bottom + GAP + height <= window.innerHeight - MARGIN ? a.bottom + GAP : Math.max(MARGIN, a.top - GAP - height)
  const left = Math.min(Math.max(MARGIN, a.left + a.width / 2 - width / 2), window.innerWidth - width - MARGIN)
  el.style.top = `${Math.round(top)}px`
  el.style.left = `${Math.round(left)}px`
  el.style.visibility = 'visible'
  return true
}

/**
 * Termo técnico com explicação: abre ao passar o mouse ou ao focar pelo teclado e fecha com Esc.
 * A dica vai para o <body>, então cartões com overflow escondido não a cortam.
 */
export function Term({ id, children }: { id: GlossaryId; children: ReactNode }) {
  const { t } = useI18n()
  const tipId = useId()
  const anchor = useRef<HTMLSpanElement>(null)
  const tip = useRef<HTMLDivElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const [open, setOpen] = useState(false)

  const later = (next: boolean, ms: number) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(next), ms)
  }
  const now = (next: boolean) => {
    window.clearTimeout(timer.current)
    setOpen(next)
  }

  useEffect(() => () => window.clearTimeout(timer.current), [])

  useEffect(() => {
    if (!open) return
    closeCurrent?.()
    const close = () => setOpen(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    // Acompanha a rolagem (inclusive a que o navegador faz ao focar o termo pelo Tab); fecha se o termo sair da tela.
    const follow = () => {
      if (!place(anchor.current, tip.current)) close()
    }
    closeCurrent = close
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', follow, true)
    window.addEventListener('resize', follow)
    return () => {
      if (closeCurrent === close) closeCurrent = null
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', follow, true)
      window.removeEventListener('resize', follow)
    }
  }, [open])

  useLayoutEffect(() => {
    if (open) place(anchor.current, tip.current)
  }, [open])

  const labels = { setupTab: t('game.tabs.setup'), selectFile: t('req.selectFile') }
  return (
    <>
      {/* <span> e não <button>: botão vira bloco inline e o texto quebraria a linha em volta dele, como em "(" + "oot.o2r)". */}
      <span
        ref={anchor}
        role="button"
        tabIndex={0}
        aria-describedby={open ? tipId : undefined}
        // title vazio: a dica nativa de um elemento pai (ex.: caminho do arquivo) não aparece por cima desta.
        title=""
        className="cursor-help rounded-sm whitespace-nowrap underline decoration-current/40 decoration-dotted underline-offset-[3px] hover:decoration-current"
        onMouseEnter={() => later(true, OPEN_DELAY_MS)}
        onMouseLeave={() => later(false, CLOSE_DELAY_MS)}
        onFocus={() => now(true)}
        onBlur={() => now(false)}
        onClick={() => now(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            now(true)
          }
        }}
      >
        {children}
      </span>
      {open &&
        createPortal(
          <div
            ref={tip}
            id={tipId}
            role="tooltip"
            className="animate-fade-in invisible fixed top-0 left-0 z-[70] w-max max-w-[320px] rounded-lg border border-control-line bg-control px-3 py-2.5 text-[12.5px] leading-relaxed text-fg-3 shadow-[0_8px_24px_var(--shadow)]"
            onMouseEnter={() => now(true)}
            onMouseLeave={() => later(false, CLOSE_DELAY_MS)}
            // Clicar na dica não tira o foco do termo (o que a fecharia).
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="mb-0.5 font-medium text-fg">{t(`glossary.${id}.title`)}</div>
            {t(`glossary.${id}.text`, labels)
              .split('\n')
              .map((line, i) => (
                <p key={i} className={i > 0 ? 'mt-2' : undefined}>
                  {line}
                </p>
              ))}
          </div>,
          document.body
        )}
    </>
  )
}

/** Texto com os termos do glossário marcados (cada um só na primeira vez). Fica num <span> para não quebrar layouts flex. */
export function GlossaryText({ children }: { children: string }) {
  return (
    <span>
      {splitGlossary(children).map((part, i) =>
        typeof part === 'string' ? (
          part
        ) : (
          <Term key={i} id={part.id}>
            {part.text}
          </Term>
        )
      )}
    </span>
  )
}
