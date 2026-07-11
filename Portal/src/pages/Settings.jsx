import { useEffect, useState } from 'react'
import { Copy, Check, RefreshCw } from 'lucide-react'
import api from '../lib/api'
import { getActiveApp, setActiveApp } from '../lib/api'
import { useTheme } from '../lib/ThemeContext'
import { themes } from '../lib/themes'

const lightThemes = Object.entries(themes).filter(([, t]) => t.mode === 'light')
const darkThemes = Object.entries(themes).filter(([, t]) => t.mode === 'dark')

function ThemeSwatch({ themeKey, theme, isActive, onSelect }) {
  return (
    <button
      onClick={() => onSelect(themeKey)}
      title={theme.name}
      className="flex flex-col items-center gap-1.5 group"
    >
      {/* Swatch preview */}
      <div
        className="w-16 h-12 rounded-xl overflow-hidden border-2 transition-all"
        style={{
          borderColor: isActive ? theme.vars['--accent'] : theme.vars['--border'],
          boxShadow: isActive ? `0 0 0 3px ${theme.vars['--accent']}33` : 'none',
        }}
      >
        {/* Top half: surface color with accent strip */}
        <div className="h-1.5 w-full" style={{ background: theme.vars['--accent'] }} />
        <div className="h-5 w-full flex gap-1 px-1.5 pt-1" style={{ background: theme.vars['--bg-surface'] }}>
          <div className="w-3 h-2 rounded-sm" style={{ background: theme.vars['--bg-subtle'] }} />
          <div className="flex-1 h-2 rounded-sm" style={{ background: theme.vars['--bg-subtle'] }} />
        </div>
        {/* Bottom half: base background */}
        <div className="h-full w-full" style={{ background: theme.vars['--bg-base'] }} />
      </div>
      <span
        className="text-xs font-medium transition-colors"
        style={{ color: isActive ? 'var(--accent)' : 'var(--text-secondary)' }}
      >
        {theme.name}
      </span>
    </button>
  )
}

export default function Settings() {
  const [app, setApp] = useState(null)
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' })
  const [passwordError, setPasswordError] = useState(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [newAppName, setNewAppName] = useState('')
  const [creatingApp, setCreatingApp] = useState(false)
  const [createError, setCreateError] = useState(null)
  const [apps, setApps] = useState([])
  const { themeKey, changeTheme } = useTheme()

  const activeApp = getActiveApp()

  useEffect(() => {
    async function load() {
      try {
        // /apps/:id needs an active app's API key to authenticate at all —
        // skip it entirely when there isn't one instead of letting
        // activeApp.id throw before any request even fires. /auth/me and
        // /apps/my are JWT-authenticated and work regardless.
        const [appRes, accountRes, appsRes] = await Promise.all([
          activeApp ? api.get(`/apps/${activeApp.id}`) : Promise.resolve(null),
          api.get('/auth/me'),
          api.get('/apps/my'),
        ])
        if (appRes) setApp(appRes.data)
        setAccount(accountRes.data)
        setApps(appsRes.data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleCopyApiKey() {
    await navigator.clipboard.writeText(app.apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleRegenerateKey() {
    if (!activeApp) return
    if (!window.confirm('Are you sure? Your existing API key will stop working immediately.')) return
    setRegenerating(true)
    try {
      const res = await api.post(`/apps/${activeApp.id}/regenerate-key`)
      const updatedApp = { ...app, apiKey: res.data.apiKey }
      setApp(updatedApp)
      setActiveApp({ ...activeApp, apiKey: res.data.apiKey })
    } catch (err) {
      console.error(err)
    } finally {
      setRegenerating(false)
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(false)

    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordError('New passwords do not match')
      return
    }
    if (passwordForm.next.length < 8) {
      setPasswordError('Password must be at least 8 characters')
      return
    }

    setSavingPassword(true)
    try {
      await api.post('/auth/change-password', {
        currentPassword: passwordForm.current,
        newPassword: passwordForm.next,
      })
      setPasswordSuccess(true)
      setPasswordForm({ current: '', next: '', confirm: '' })
    } catch (err) {
      setPasswordError(err.response?.data?.error ?? 'Failed to change password')
    } finally {
      setSavingPassword(false)
    }
  }

  async function handleCreateApp(e) {
    e.preventDefault()
    setCreateError(null)
    setCreatingApp(true)
    try {
      const res = await api.post('/apps', { name: newAppName })
      setApps(prev => [...prev, res.data])
      setNewAppName('')
    } catch (err) {
      setCreateError(err.response?.data?.error ?? 'Failed to create app')
    } finally {
      setCreatingApp(false)
    }
  }

  function handleSwitchApp(selectedApp) {
    setActiveApp(selectedApp)
    window.location.href = '/dashboard'
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-tertiary)' }}>
      Loading...
    </div>
  )

  const inputClass = "w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
  const inputStyle = {
    border: '1px solid var(--border)',
    background: 'var(--bg-subtle)',
    color: 'var(--text-primary)',
  }
  const inputFocusStyle = { boxShadow: '0 0 0 2px var(--accent)' }

  const cardStyle = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
  }

  const labelStyle = { color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: '500', display: 'block', marginBottom: '0.25rem' }

  const btnPrimary = {
    background: 'var(--accent)',
    color: 'var(--accent-text-on)',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: '500',
    cursor: 'pointer',
  }

  const btnSecondary = {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    padding: '0.5rem 0.75rem',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    cursor: 'pointer',
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Settings</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>Manage your app and account settings</p>
      </div>

      {/* Theme picker */}
      <div className="rounded-xl p-6 space-y-5" style={cardStyle}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Appearance</h3>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>Light themes</p>
            <div className="flex flex-wrap gap-4">
              {lightThemes.map(([key, theme]) => (
                <ThemeSwatch
                  key={key}
                  themeKey={key}
                  theme={theme}
                  isActive={themeKey === key}
                  onSelect={changeTheme}
                />
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>Dark themes</p>
            <div className="flex flex-wrap gap-4">
              {darkThemes.map(([key, theme]) => (
                <ThemeSwatch
                  key={key}
                  themeKey={key}
                  theme={theme}
                  isActive={themeKey === key}
                  onSelect={changeTheme}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* App settings — nothing to show without an active app selected */}
      {activeApp && (
        <div className="rounded-xl p-6 space-y-5" style={cardStyle}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>App Settings — {app?.name}</h3>
          <div>
            <label style={labelStyle}>API Key</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg px-3 py-2 text-sm font-mono truncate"
                style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                {app?.apiKey}
              </code>
              <button onClick={handleCopyApiKey} style={btnSecondary} className="flex items-center gap-1.5">
                {copied
                  ? <Check size={14} style={{ color: 'var(--accent)' }} />
                  : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button onClick={handleRegenerateKey} disabled={regenerating} style={btnSecondary} className="flex items-center gap-1.5">
                <RefreshCw size={14} className={regenerating ? 'animate-spin' : ''} />
                Regenerate
              </button>
            </div>
            <p className="text-sm mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
              Use this key to initialize PulseSDK in your Android app.
            </p>
          </div>
        </div>
      )}

      {/* My Apps */}
      <div className="rounded-xl p-6 space-y-4" style={cardStyle}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>My Apps</h3>
        {apps.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            You're not a member of any app yet. Create one below, or ask an app owner to invite you.
          </p>
        )}
        <div className="space-y-2">
          {apps.map(a => (
            <div key={a.id} className="flex items-center justify-between rounded-lg px-4 py-3"
              style={{ border: '1px solid var(--border)' }}>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{a.name}</p>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{a.role}</p>
              </div>
              {a.id !== activeApp?.id ? (
                <button onClick={() => handleSwitchApp(a)}
                  className="text-sm font-medium" style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Switch to this app
                </button>
              ) : (
                <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Currently active</span>
              )}
            </div>
          ))}
        </div>
        <form onSubmit={handleCreateApp} className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Create a new app</p>
          <div className="flex gap-3">
            <input
              value={newAppName}
              onChange={e => setNewAppName(e.target.value)}
              placeholder="App name"
              className={inputClass}
              style={inputStyle}
              onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
              onBlur={e => e.target.style.boxShadow = 'none'}
              required
            />
            <button type="submit" disabled={creatingApp} style={btnPrimary}>
              {creatingApp ? 'Creating...' : 'Create'}
            </button>
          </div>
          {createError && <p className="text-sm mt-2" style={{ color: '#EF4444' }}>{createError}</p>}
        </form>
      </div>

      {/* Account settings */}
      <div className="rounded-xl p-6 space-y-5" style={cardStyle}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Account Settings</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label style={labelStyle}>Name</label>
            <input value={account?.name ?? ''} readOnly className={inputClass}
              style={{ ...inputStyle, cursor: 'not-allowed', opacity: 0.7 }} />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input value={account?.email ?? ''} readOnly className={inputClass}
              style={{ ...inputStyle, cursor: 'not-allowed', opacity: 0.7 }} />
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
          <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>Change Password</h4>
          <form onSubmit={handlePasswordChange} className="space-y-3">
            <div>
              <label style={{ ...labelStyle, fontWeight: '400' }}>Current password</label>
              <input type="password" value={passwordForm.current}
                onChange={e => setPasswordForm(prev => ({ ...prev, current: e.target.value }))}
                className={inputClass} style={inputStyle}
                onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                onBlur={e => e.target.style.boxShadow = 'none'}
                required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={{ ...labelStyle, fontWeight: '400' }}>New password</label>
                <input type="password" value={passwordForm.next}
                  onChange={e => setPasswordForm(prev => ({ ...prev, next: e.target.value }))}
                  className={inputClass} style={inputStyle} minLength={8}
                  onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                  onBlur={e => e.target.style.boxShadow = 'none'}
                  required />
              </div>
              <div>
                <label style={{ ...labelStyle, fontWeight: '400' }}>Confirm new password</label>
                <input type="password" value={passwordForm.confirm}
                  onChange={e => setPasswordForm(prev => ({ ...prev, confirm: e.target.value }))}
                  className={inputClass} style={inputStyle}
                  onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                  onBlur={e => e.target.style.boxShadow = 'none'}
                  required />
              </div>
            </div>
            {passwordError && <p className="text-sm" style={{ color: '#EF4444' }}>{passwordError}</p>}
            {passwordSuccess && <p className="text-sm" style={{ color: 'var(--accent)' }}>Password changed successfully.</p>}
            <div className="flex justify-end">
              <button type="submit" disabled={savingPassword} style={btnPrimary}>
                {savingPassword ? 'Saving...' : 'Change Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}