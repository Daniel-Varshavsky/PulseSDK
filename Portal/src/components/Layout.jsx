import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FlaskConical, MessageSquare, Bell, Settings, LogOut, Users, ChevronDown } from 'lucide-react'
import { setToken, setActiveApp, getActiveApp } from '../lib/api'
import api from '../lib/api'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/experiments', icon: FlaskConical, label: 'Experiments' },
  { to: '/feedback', icon: MessageSquare, label: 'Feedback' },
  { to: '/notifications', icon: Bell, label: 'Notifications' },
  { to: '/team', icon: Users, label: 'Team' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Layout() {
  const [activeApp, setActiveAppState] = useState(getActiveApp())
  const [apps, setApps] = useState([])
  const [showSwitcher, setShowSwitcher] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    async function loadApps() {
      try {
        const res = await api.get('/apps/my')
        setApps(res.data)
      } catch (err) {
        console.error(err)
      }
    }
    loadApps()
  }, [])

  function handleSwitchApp(app) {
    setActiveApp(app)
    setActiveAppState(app)
    setShowSwitcher(false)
    navigate('/dashboard')
    window.location.reload()
  }

  function handleLogout() {
    setToken(null)
    setActiveApp(null)
    navigate('/login')
  }

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-base)' }}>
      {/* Sidebar */}
      <aside className="w-56 flex flex-col" style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }}>
        {/* Logo */}
        <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>PulseSDK</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--accent)' }}>Developer Portal</p>
        </div>

        {/* App switcher */}
        <div className="px-3 py-3 relative" style={{ borderBottom: '1px solid var(--border)' }}>
          <button
            onClick={() => setShowSwitcher(prev => !prev)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span className="truncate">{activeApp?.name ?? 'Select app'}</span>
            <ChevronDown size={14} className="shrink-0 ml-1" style={{ color: 'var(--text-tertiary)' }} />
          </button>

          {showSwitcher && (
            <div className="absolute left-3 right-3 top-full mt-1 rounded-lg shadow-lg z-50 overflow-hidden"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              {apps.map(app => (
                <button
                  key={app.id}
                  onClick={() => handleSwitchApp(app)}
                  className="w-full text-left px-3 py-2.5 text-sm transition-colors"
                  style={{
                    color: app.id === activeApp?.id ? 'var(--accent)' : 'var(--text-secondary)',
                    fontWeight: app.id === activeApp?.id ? '500' : '400',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {app.name}
                </button>
              ))}
              <div style={{ borderTop: '1px solid var(--border)' }}>
                <button
                  onClick={() => { setShowSwitcher(false); navigate('/settings') }}
                  className="w-full text-left px-3 py-2.5 text-sm font-medium transition-colors"
                  style={{ color: 'var(--accent)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  + Create new app
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                textDecoration: 'none',
                transition: 'all 0.15s',
                background: isActive ? 'var(--accent-subtle)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              })}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium w-full transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {!activeApp && (
          <div className="px-6 py-3 flex items-center justify-between text-sm"
            style={{ background: 'var(--accent-subtle)', borderBottom: '1px solid var(--accent-border)', color: 'var(--accent-text)' }}>
            <span>You don't have an app selected yet. Ask an app owner to invite you, or create your own.</span>
            <button onClick={() => navigate('/settings')}
              className="font-medium" style={{ color: 'var(--accent-text)', background: 'none', border: 'none', cursor: 'pointer' }}>
              Create app
            </button>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  )
}