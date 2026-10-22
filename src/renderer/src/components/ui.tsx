import { LoaderCircle } from 'lucide-react'
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:brightness-110 shadow-sm shadow-blue-900/20',
  secondary: 'bg-subtle text-fg hover:bg-card-hover border border-line',
  ghost: 'text-muted hover:text-fg hover:bg-subtle',
  danger: 'bg-red-600 text-white hover:bg-red-500',
  success: 'bg-emerald-600 text-white hover:bg-emerald-500'
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; loading?: boolean; icon?: ReactNode }) {
  const sizes = { sm: 'h-8 px-3 text-xs gap-1.5', md: 'h-9 px-3.5 text-sm gap-2', lg: 'h-11 px-6 text-base gap-2.5' }
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex shrink-0 items-center justify-center rounded-lg font-medium whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-50 ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    >
      {loading ? <LoaderCircle className="animate-spin" size={size === 'lg' ? 18 : 15} /> : icon}
      {children}
    </button>
  )
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-xl border border-line bg-card ${className}`}>{children}</div>
}

export function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode; disabled?: boolean }) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition ${checked ? 'bg-accent' : 'bg-line'}`}
      >
        <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </button>
      <span className="min-w-0">
        <span className="block text-sm">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  )
}

export function ProgressBar({ value, className = '' }: { value?: number; className?: string }) {
  const indeterminate = value === undefined
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-line ${className}`}>
      <div
        className={`h-full rounded-full bg-accent transition-[width] duration-300 ${indeterminate ? 'w-1/3 animate-pulse' : ''}`}
        style={indeterminate ? undefined : { width: `${Math.max(2, Math.min(100, value * 100))}%` }}
      />
    </div>
  )
}

/** Anel de progresso circular (usado em volta do botão de atualização). */
export function ProgressRing({ size, stroke, percent, className = '' }: { size: number; stroke: number; percent: number; className?: string }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className={`-rotate-90 ${className}`} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.18} strokeWidth={stroke} />
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
    panel.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
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
        className={`animate-pop-in flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-elevated shadow-2xl outline-none ${className}`}
      >
        {children}
      </div>
    </div>
  )
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
      <div className="p-6">
        <h2 id="confirm-title" className="text-lg font-semibold">
          {title}
        </h2>
        <div className="mt-2 text-sm text-muted">{body}</div>
      </div>
      <div className="flex justify-end gap-2 border-t border-line bg-card px-6 py-3">
        <Button variant="ghost" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
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
        <div className="p-6">
          <label id="prompt-title" className="text-sm font-medium" htmlFor="prompt-input">
            {title}
          </label>
          <input id="prompt-input" ref={input} defaultValue={initial} className="input mt-2 w-full" />
        </div>
        <div className="flex justify-end gap-2 border-t border-line bg-card px-6 py-3">
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="primary" type="submit">
            {confirmLabel}
          </Button>
        </div>
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
        className={`pointer-events-none absolute z-50 rounded-md border border-line bg-elevated px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-fg opacity-0 shadow-lg transition-opacity delay-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 ${pos}`}
      >
        {text}
      </span>
    </span>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">{children}</h2>
      {action}
    </div>
  )
}
