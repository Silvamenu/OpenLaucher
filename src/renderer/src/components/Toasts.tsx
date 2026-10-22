import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { useAppState } from '../state/AppState'

export function Toasts() {
  const { toasts, dismissToast } = useAppState()
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = toast.kind === 'success' ? CircleCheck : toast.kind === 'error' ? CircleAlert : Info
        const color = toast.kind === 'success' ? 'text-emerald-500' : toast.kind === 'error' ? 'text-red-500' : 'text-accent'
        return (
          <div key={toast.id} className="animate-pop-in pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-elevated p-3 text-sm shadow-xl">
            <Icon size={18} className={`mt-0.5 shrink-0 ${color}`} />
            <p className="min-w-0 flex-1 break-words">{toast.message}</p>
            <button type="button" onClick={() => dismissToast(toast.id)} className="text-muted hover:text-fg" aria-label="OK">
              <X size={16} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
