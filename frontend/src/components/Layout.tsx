import { Outlet } from 'react-router-dom'
import { AppHeader } from './AppHeader'

export function Layout() {
  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main">
        <div className="container">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
