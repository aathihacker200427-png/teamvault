import { create } from 'zustand'
import { createPortal } from 'react-dom'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'
interface Toast { id: string; message: string; type: ToastType }

interface ToastStore {
  toasts: Toast[]
  show: (message: string, type?: ToastType) => void
  dismiss: (id: string) => void
}

export const useToast = create<ToastStore>((set) => ({
  toasts: [],
  show: (message, type = 'info') => {
    const id = crypto.randomUUID()
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) })), 4000)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}))

export function toast(message: string, type: ToastType = 'info') {
  useToast.getState().show(message, type)
}

const icons = { success: CheckCircle, error: XCircle, info: Info }
const colors = { success: 'border-success bg-success/10 text-success', error: 'border-danger bg-danger/10 text-danger', info: 'border-brand bg-brand/10 text-brand' }

export function Toaster() {
  const { toasts, dismiss } = useToast()
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed bottom-4 right-4 z-[300] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => {
        const Icon = icons[t.type]
        return (
          <div key={t.id} className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border ${colors[t.type]} bg-bg-secondary shadow-xl min-w-[280px] max-w-md animate-slide-in`}>
            <Icon size={18} className="shrink-0" />
            <span className="text-sm flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="opacity-70 hover:opacity-100"><X size={16} /></button>
          </div>
        )
      })}
    </div>,
    document.body
  )
}
