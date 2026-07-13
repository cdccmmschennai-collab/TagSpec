import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { MainNavigation } from './MainNavigation'
import { UserMenu } from './UserMenu'

export function Brand() {
  // Uses the real company logo when present; falls back to a text-only mark.
  const [logoOk, setLogoOk] = useState(true)
  return (
    <Link to="/jobs" className="brand" aria-label="TagSpec home">
      {logoOk ? (
        <img
          className="brand-logo"
          src="/company-logo.png"
          alt="CDC"
          onError={() => setLogoOk(false)}
        />
      ) : (
        <span className="brand-mark" aria-hidden="true">TS</span>
      )}
      <span className="brand-text">
        <span className="brand-name">TagSpec</span>
        <span className="brand-sub">Equipment Attribute Workspace</span>
      </span>
    </Link>
  )
}

export function AppHeader() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  return (
    <header className="app-header">
      <Brand />
      <MainNavigation isAdmin={isAdmin} />
      <div className="header-right">
        {user && <UserMenu user={user} />}
      </div>
    </header>
  )
}
