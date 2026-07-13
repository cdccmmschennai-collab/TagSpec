import { useCallback, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './primitives'
import { XIcon } from './icons'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

function useOverlay(open: boolean, onClose: () => void, containerRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!open) return
    const prevActive = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Focus first focusable element inside the surface.
    const timer = window.setTimeout(() => {
      const el = containerRef.current?.querySelector<HTMLElement>(FOCUSABLE)
      el?.focus()
    }, 0)

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === 'Tab') {
        const nodes = containerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
        if (!nodes || nodes.length === 0) return
        const list = Array.from(nodes)
        const first = list[0]
        const last = list[list.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey, true)
      window.clearTimeout(timer)
      prevActive?.focus?.()
    }
  }, [open, onClose, containerRef])
}

interface SurfaceProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  labelId?: string
}

export function Dialog({ open, onClose, title, subtitle, children, footer }: SurfaceProps) {
  const ref = useRef<HTMLDivElement>(null)
  useOverlay(open, onClose, ref)
  if (!open) return null
  return createPortal(
    <div className="overlay center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} ref={ref}>
        <div className="dialog-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <div className="sub">{subtitle}</div>}
          </div>
          <button className="icon-close" onClick={onClose} aria-label="Close dialog"><XIcon size={18} /></button>
        </div>
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function Drawer({ open, onClose, title, subtitle, children, footer, wide }: SurfaceProps & { wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useOverlay(open, onClose, ref)
  if (!open) return null
  return createPortal(
    <div className="overlay right" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`drawer ${wide ? 'wide' : ''}`.trim()} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} ref={ref}>
        <div className="drawer-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <div className="sub">{subtitle}</div>}
          </div>
          <button className="icon-close" onClick={onClose} aria-label="Close panel"><XIcon size={18} /></button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  destructive = false,
  loading = false,
}: {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
  title: string
  message: ReactNode
  confirmLabel?: string
  destructive?: boolean
  loading?: boolean
}) {
  const confirm = useCallback(() => onConfirm(), [onConfirm])
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button variant={destructive ? 'danger' : 'primary'} onClick={confirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="soft" style={{ margin: 0 }}>{message}</p>
    </Dialog>
  )
}
