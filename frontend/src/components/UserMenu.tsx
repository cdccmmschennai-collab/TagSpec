import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import type { User } from '../lib/types'
import { LogOutIcon } from './ui/icons'

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrator',
  SUPERVISOR: 'Supervisor',
  EDITOR: 'Editor',
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U'
}

export function UserMenu({ user }: { user: User }) {
  const { logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const role = ROLE_LABEL[user.role] ?? user.role

  return (
    <div className="user-menu" ref={ref}>
      <button
        className="user-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.full_name}`}
      >
        <span className="avatar" aria-hidden="true">{initials(user.full_name)}</span>
      </button>
      {open && (
        <div className="user-menu-pop" role="menu">
          <div className="user-menu-head">
            <div className="strong small">{user.full_name}</div>
            <div className="tiny muted">{user.employee_code} · {role}</div>
          </div>
          <button className="menu-item danger" role="menuitem" onClick={logout}>
            <LogOutIcon size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}
