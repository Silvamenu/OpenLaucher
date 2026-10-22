import { LoaderCircle } from 'lucide-react'
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-primary-fg font-medium hover:opacity-90',
  secondary: 'bg-control border border-control-line text-fg-2 hover:border-chip-line hover:text-fg',
  accent: 'bg-accent-bg border border-accent-line text-accent-fg hover:brightness-110',
  ghost: 'text-muted hover:text-fg hover:bg-hover',
  danger: 'border border-bad/40 bg-bad/10 text-bad hover:bg-bad/15'
}

const sizes = {
  sm: 'h-8 text-[12.5px] gap-1.5 rounded-[9px]',
  md: 'h-9 text-[13px] gap-2 rounded-[10px]',
  lg: 'h-11 text-[14px] gap-2.5 rounded-xl'
}
const padding = { sm: 'px-3', md: 'px-3.5', lg: 'px-5' }
const square = { sm: 'w-8', md: 'w-9', lg: 'w-11' }

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof sizes; loading?: boolean; icon?: ReactNode }) {
  const iconOnly = !children
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-[color,background,border-color,opacity,filter] disabled:cursor-not-allowed disabled:opacity-45 ${sizes[size]} ${
        iconOnly ? square[size] : padding[size]
      } ${variants[variant]} ${className}`}
      {...rest}
    >
      {loading ? <LoaderCircle className="animate-spin" size={size === 'lg' ? 17 : 14} /> : icon}
      {children}
    </button>
  )
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-[14px] border border-surface-line bg-surface ${className}`}>{children}</div>
}

/** Bolinha de status (verde/amarelo/vermelho). */
export function Dot({ tone, className = '' }: { tone: 'ok' | 'warn' | 'bad' | 'info' | 'idle'; className?: string }) {
  const bg = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', info: 'bg-accent-fg', idle: 'bg-faint' }[tone]
  return <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${bg} ${className}`} />
}

/** Etiqueta compacta com borda (status, versão). */
export function Pill({ children, mono = false, className = '' }: { children: ReactNode; mono?: boolean; className?: string }) {
  return (
    <span
      className={`inline-flex h-[22px] items-center gap-1.5 rounded-md border border-control-line px-2 whitespace-nowrap ${
        mono ? 'font-mono text-[11px] text-subtle' : 'text-[11.5px] text-fg-3'
      } ${className}`}
    >
      {children}
    </span>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <span className="rounded-[5px] border border-control-line px-[5px] py-px font-mono text-[10px] text-subtle">{children}</span>
}

/** Chip de filtro/abas com contador opcional. */
export function Chip({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: ReactNode; count?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-8 shrink-0 items-center gap-2 rounded-[9px] border px-3 text-[13px] whitespace-nowrap transition-colors ${
        active ? 'border-chip-line bg-chip text-fg' : 'border-line text-subtle hover:text-fg-2'
      }`}
    >
      <span>{children}</span>
      {count !== undefined && <span className="font-mono text-[11px] text-faint">{count}</span>}
    </button>
  )
}

export function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode; disabled?: boolean }) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? 'opacity-45' : 'cursor-pointer'}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors ${checked ? 'border-primary bg-primary' : 'border-control-line bg-control'}`}
      >
        <span
          className={`absolute top-[2px] left-[2px] h-3.5 w-3.5 rounded-full transition-transform ${checked ? 'translate-x-4 bg-primary-fg' : 'bg-faint'}`}
        />
      </button>
      <span className="min-w-0">
        <span className="block text-[13.5px] text-fg-2">{label}</span>
        {hint && <span className="mt-0.5 block text-[12px] text-subtle">{hint}</span>}
      </span>
    </label>
  )
}

export function ProgressBar({ value, className = '' }: { value?: number; className?: string }) {
  const indeterminate = value === undefined
  return (
    <div className={`h-1 w-full overflow-hidden rounded-full bg-track ${className}`}>
      <div
        className={`h-full rounded-full bg-fg transition-[width] duration-300 ${indeterminate ? 'w-1/3 animate-pulse' : ''}`}
        style={indeterminate ? undefined : { width: `${Math.max(2, Math.min(100, value * 100))}%` }}
      />
    </div>
  )
}

/** Anel de progresso circular (em volta do botão de atualização do launcher). */
export function ProgressRing({ size, stroke, percent, className = '' }: { size: number; stroke: number; percent: number; className?: string }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className={`-rotate-90 ${className}`} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.2} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.max(0, Math.min(100, percent)) / 100)}
        className="transition-[stroke-dashoffset] duration-500"
      />
    </svg>
  )
}

export function Modal({ onClose, children, labelledBy, className = '' }: { onClose: () => void; children: ReactNode; labelledBy?: string; className?: string }) {
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    panel.current?.focus({ preventScroll: true })
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[3px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`animate-pop-in flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-panel-line bg-panel shadow-[0_30px_80px_var(--shadow)] outline-none ${className}`}
      >
        {children}
      </div>
    </div>
  )
}

export function ModalFooter({ children }: { children: ReactNode }) {
  return <div className="flex justify-end gap-2 border-t border-line px-6 py-4">{children}</div>
}

export function ConfirmModal({
  title,
  body,
  confirmLabel,
  cancelLabel,
  danger,
  onConfirm,
  onCancel
}: {
  title: string
  body: ReactNode
  confirmLabel: string
  cancelLabel: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal onClose={onCancel} labelledBy="confirm-title" className="max-w-md">
      <div className="px-6 pt-6 pb-5">
        <h2 id="confirm-title" className="text-[16px] font-semibold tracking-tight">
          {title}
        </h2>
        <div className="mt-2 text-[13.5px] leading-relaxed text-muted">{body}</div>
      </div>
      <ModalFooter>
        <Button variant="ghost" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export function PromptModal({
  title,
  initial,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel
}: {
  title: string
  initial: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: (value: string) => void
  onCancel: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    setTimeout(() => input.current?.select(), 30)
  }, [])
  return (
    <Modal onClose={onCancel} labelledBy="prompt-title" className="max-w-md">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onConfirm(input.current?.value ?? '')
        }}
      >
        <div className="px-6 pt-6 pb-5">
          <label id="prompt-title" className="text-[13px] font-medium text-fg-2" htmlFor="prompt-input">
            {title}
          </label>
          <input id="prompt-input" ref={input} defaultValue={initial} className="input mt-2 w-full" />
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="primary" type="submit">
            {confirmLabel}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}

export function Tooltip({ text, side = 'right', children }: { text: ReactNode; side?: 'right' | 'top' | 'bottom'; children: ReactNode }) {
  const pos = {
    right: 'left-full top-1/2 ml-3 -translate-y-1/2',
    top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
    bottom: 'top-full left-1/2 mt-2 -translate-x-1/2'
  }[side]
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 rounded-lg border border-control-line bg-control px-2.5 py-1.5 text-[12px] whitespace-nowrap text-fg opacity-0 shadow-[0_8px_24px_var(--shadow)] transition-opacity delay-150 group-focus-within/tip:opacity-100 group-hover/tip:opacity-100 ${pos}`}
      >
        {text}
      </span>
    </span>
  )
}

/** Título de seção discreto (maiúsculas pequenas), como "JOGOS" na barra lateral. */
export function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[11.5px] tracking-[0.04em] text-faint uppercase">{children}</h2>
      {action}
    </div>
  )
}

/** Cabeçalho padrão das páginas: título grande + subtítulo + ações à direita. */
export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-[26px] flex flex-wrap items-end gap-4">
      <div className="min-w-0">
        <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.025em]">{title}</h1>
        {subtitle && <div className="mt-1 text-[13px] text-subtle">{subtitle}</div>}
      </div>
      {actions && <div className="ml-auto flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

/** Conteúdo padrão de página dentro do painel principal. */
export function Page({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return <div className={`px-10 pt-9 pb-12 max-md:px-6 ${narrow ? 'max-w-[860px]' : ''}`}>{children}</div>
}
