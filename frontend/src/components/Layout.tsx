import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { HealthStatus } from './HealthStatus'

export function Layout() {
  const { user, logout } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">Equipment Additional Info</div>
        <nav className="nav">
          <NavLink to="/jobs">Jobs</NavLink>
          {isAdmin && <NavLink to="/equipment-master">Equipment Master</NavLink>}
        </nav>
        <div className="topbar-right">
          <HealthStatus />
          {user && (
            <span className="user">
              {user.full_name} · {user.role}
            </span>
          )}
          <button className="btn btn-ghost" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
