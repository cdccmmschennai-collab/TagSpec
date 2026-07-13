import { useCallback, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ToastContext } from './toast-context'
import type { ToastItem, ToastKind } from './toast-context'
import { AlertIcon, CheckCircleIcon, InfoIcon, XIcon } from './icons'

const ICONS: Record<ToastKind, ReactNode> = {
  success: <CheckCircleIcon size={18} />,
  error: <AlertIcon size={18} />,
  info: <InfoIcon size={18} />,
  warning: <AlertIcon size={18} />,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const seq = useRef(0)

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (kind: ToastKind, title: string, message?: string) => {
      const id = ++seq.current
      setItems((list) => [...list, { id, kind, title, message }])
      window.setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4500)
    },
    [dismiss],
  )

  const api = useMemo(
    () => ({
      push,
      success: (t: string, m?: string) => push('success', t, m),
      error: (t: string, m?: string) => push('error', t, m),
      info: (t: string, m?: string) => push('info', t, m),
      warning: (t: string, m?: string) => push('warning', t, m),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="toast-region" role="region" aria-label="Notifications" aria-live="polite">
          {items.map((t) => (
            <div key={t.id} className={`toast ${t.kind}`} role="status">
              <span className={`toast-icon ${t.kind}`}>{ICONS[t.kind]}</span>
              <div className="toast-body">
                <div className="toast-title">{t.title}</div>
                {t.message && <div className="toast-msg">{t.message}</div>}
              </div>
              <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
                <XIcon size={15} />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}
