import { useEffect, useState } from 'react'
import { UserPlus, Crown, User, X } from 'lucide-react'
import api from '../lib/api'
import { getActiveApp } from '../lib/api'

export default function Team() {
  const [app, setApp] = useState(null)
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState(null)
  const [inviteSuccess, setInviteSuccess] = useState(null)
  const [inviting, setInviting] = useState(false)
  const [removingId, setRemovingId] = useState(null)

  const activeApp = getActiveApp()

  async function load() {
    try {
      const res = await api.get(`/apps/${activeApp.id}`)
      setApp(res.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleInvite(e) {
    e.preventDefault()
    setInviteError(null)
    setInviteSuccess(null)
    setInviting(true)
    try {
      await api.post(`/apps/${activeApp.id}/members`, { email: inviteEmail })
      setInviteSuccess(`${inviteEmail} has been added as a collaborator.`)
      setInviteEmail('')
      load()
    } catch (err) {
      setInviteError(err.response?.data?.error ?? 'Failed to invite collaborator')
    } finally { setInviting(false) }
  }

  async function handleRemove(memberId) {
    setRemovingId(memberId)
    try {
      await api.delete(`/apps/${activeApp.id}/members/${memberId}`)
      load()
    } catch (err) { console.error(err) }
    finally { setRemovingId(null) }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-tertiary)' }}>Loading...</div>
  )

  const activeMembers = app?.members?.filter(m => m.status === 'ACTIVE') ?? []
  const pastMembers = app?.members?.filter(m => m.status === 'REMOVED') ?? []

  let currentAccountId = null
  try {
    const token = localStorage.getItem('pulsesdk_token')
    currentAccountId = JSON.parse(atob(token.split('.')[1])).accountId
  } catch {}
  const currentMember = activeMembers.find(m => m.accountId === currentAccountId)
  const isOwner = currentMember?.role === 'OWNER'

  const cardStyle = { background: 'var(--bg-surface)', border: '1px solid var(--border)' }
  const inputStyle = { border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text-primary)' }

  return (
    <div className="p-8 space-y-6" style={{ background: 'var(--bg-base)' }}>
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Team</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>Manage who has access to {app?.name}</p>
      </div>

      {/* Active members */}
      <div className="rounded-xl" style={cardStyle}>
        <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Members
            <span className="font-normal ml-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>({activeMembers.length})</span>
          </h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border)' }}>
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">Email</th>
              <th className="px-6 py-3">Role</th>
              <th className="px-6 py-3">Joined</th>
              {isOwner && <th className="px-6 py-3 w-12" />}
            </tr>
          </thead>
          <tbody>
            {activeMembers.map(m => (
              <tr key={m.id} style={{ borderTop: '1px solid var(--border)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: 'var(--accent-subtle)' }}>
                      <span className="text-sm font-medium" style={{ color: 'var(--accent-text)' }}>
                        {m.account.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {m.account.name}
                      {m.accountId === currentAccountId && (
                        <span className="font-normal ml-1" style={{ color: 'var(--text-tertiary)' }}>(you)</span>
                      )}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{m.account.email}</td>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-1.5">
                    {m.role === 'OWNER'
                      ? <Crown size={14} style={{ color: '#D97706' }} />
                      : <User size={14} style={{ color: 'var(--text-tertiary)' }} />}
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {m.role === 'OWNER' ? 'Owner' : 'Collaborator'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-3 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  {new Date(m.joinedAt).toLocaleDateString()}
                </td>
                {isOwner && (
                  <td className="px-6 py-3">
                    {m.role !== 'OWNER' && (
                      <button onClick={() => handleRemove(m.id)} disabled={removingId === m.id}
                        className="disabled:opacity-50 transition-colors"
                        style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}>
                        <X size={16} />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite form */}
      {isOwner && (
        <div className="rounded-xl p-6" style={cardStyle}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Invite Collaborator</h3>
          <form onSubmit={handleInvite} className="flex gap-3">
            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
              placeholder="colleague@example.com"
              className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none" style={inputStyle}
              onFocus={e => e.target.style.boxShadow = '0 0 0 2px var(--accent)'}
              onBlur={e => e.target.style.boxShadow = 'none'} required />
            <button type="submit" disabled={inviting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{ background: 'var(--accent)', color: 'var(--accent-text-on)', border: 'none', cursor: 'pointer' }}>
              <UserPlus size={15} />
              {inviting ? 'Inviting...' : 'Invite'}
            </button>
          </form>
          {inviteError && <p className="text-sm mt-2" style={{ color: '#EF4444' }}>{inviteError}</p>}
          {inviteSuccess && <p className="text-sm mt-2" style={{ color: 'var(--accent)' }}>{inviteSuccess}</p>}
          <p className="text-sm mt-2" style={{ color: 'var(--text-tertiary)' }}>
            The person must already have a PulseSDK account to be invited.
          </p>
        </div>
      )}

      {/* Past members */}
      {pastMembers.length > 0 && (
        <div className="rounded-xl" style={cardStyle}>
          <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Past Members
              <span className="font-normal ml-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>({pastMembers.length})</span>
            </h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide" style={{ color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border)' }}>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Left</th>
              </tr>
            </thead>
            <tbody>
              {pastMembers.map(m => (
                <tr key={m.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: 'var(--bg-subtle)' }}>
                        <span className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
                          {m.account.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{m.account.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-sm" style={{ color: 'var(--text-tertiary)' }}>{m.account.email}</td>
                  <td className="px-6 py-3 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                    {m.role === 'OWNER' ? 'Owner' : 'Collaborator'}
                  </td>
                  <td className="px-6 py-3 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                    {m.leftAt ? new Date(m.leftAt).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}