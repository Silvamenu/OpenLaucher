import { X } from 'lucide-react'
import { useAppState } from '../state/AppState'
import { Dot } from './ui'

export function Toasts() {
  const { toasts, dismissToast } = useAppState()
  return (
    <div className="pointer-events-none fixed right-5 bottom-5 z-[60] flex w-[min(380px,calc(100vw-2.5rem))] flex-col gap-2" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="animate-pop-in pointer-events-auto flex items-start gap-3 rounded-xl border border-control-line bg-control px-3.5 py-3 text-[13px] text-fg-2 shadow-[0_16px_40px_var(--shadow)]"
        >
          <Dot tone={toast.kind === 'success' ? 'ok' : toast.kind === 'error' ? 'bad' : 'info'} className="mt-1.5" />
          <p className="min-w-0 flex-1 break-words">{toast.message}</p>
          <button type="button" onClick={() => dismissToast(toast.id)} className="text-subtle hover:text-fg" aria-label="OK">
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  )
}
