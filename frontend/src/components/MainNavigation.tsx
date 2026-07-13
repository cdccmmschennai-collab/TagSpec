import { NavLink } from 'react-router-dom'

export function MainNavigation({ isAdmin }: { isAdmin: boolean }) {
  return (
    <nav className="main-nav" aria-label="Primary">
      <NavLink to="/jobs">Jobs</NavLink>
      {isAdmin && <NavLink to="/attribute-master">Attribute Master</NavLink>}
    </nav>
  )
}
