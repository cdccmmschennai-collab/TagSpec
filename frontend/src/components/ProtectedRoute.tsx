import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import type { Role } from '../lib/types'

export function ProtectedRoute({
  children,
  roles,
}: {
  children: ReactNode
  roles?: Role[]
}) {
  const { user, loading } = useAuth()
  if (loading) {
    return <div className="center-page">Loading…</div>
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (roles && !roles.includes(user.role)) {
    return <div className="center-page">You do not have access to this page.</div>
  }
  return <>{children}</>
}
