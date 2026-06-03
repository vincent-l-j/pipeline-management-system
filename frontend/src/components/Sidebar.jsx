import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const navItems = [
  { to: '/', label: 'Dashboard', icon: '◻' },
  { to: '/pipeline', label: 'Pipeline', icon: '▦' },
  { to: '/pitches', label: 'Pitches', icon: '◈' },
  { to: '/organisations', label: 'Organisations', icon: '◎' },
  { to: '/contacts', label: 'Contacts', icon: '◉' },
  { to: '/meetings', label: 'Meetings', icon: '◆' },
  { to: '/assessments', label: 'Assessments', icon: '◇' },
  { to: '/search', label: 'Search', icon: '?' },
  { to: '/reports', label: 'Reports', icon: '=' },
]

const adminItems = [
  { to: '/admin/users', label: 'Users', icon: '◐' },
]

export default function Sidebar() {
  const { user, logout } = useAuth()

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-navy-800 text-white'
        : 'text-navy-200 hover:bg-navy-800/50 hover:text-white'
    }`

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-navy-900 text-white flex flex-col">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-navy-700">
        <h1 className="text-xl font-bold tracking-tight">Rozetta</h1>
        <p className="text-xs text-navy-400 mt-0.5">Pipeline Management</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={linkClass}>
            <span className="text-base">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}

        {user?.role === 'admin' && (
          <>
            <div className="pt-4 pb-2 px-4">
              <p className="text-xs font-semibold text-navy-500 uppercase tracking-wider">Admin</p>
            </div>
            {adminItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={linkClass}>
                <span className="text-base">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User info */}
      <div className="px-4 py-4 border-t border-navy-700">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{user?.display_name}</p>
            <p className="text-xs text-navy-400 truncate">{user?.role}</p>
          </div>
          <button
            onClick={logout}
            className="text-xs text-navy-400 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  )
}
