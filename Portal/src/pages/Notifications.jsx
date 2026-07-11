import { useEffect, useState } from 'react'
import { Bell, Send } from 'lucide-react'
import api, { getActiveApp } from '../lib/api'

export default function Notifications() {
  const [experiments, setExperiments] = useState([])
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [firebaseConfigured, setFirebaseConfigured] = useState(null)
  const [form, setForm] = useState({ title: '', body: '', audienceType: 'ALL', experimentId: '' })

  const inputStyle = {
    border: '1px solid var(--border)',
    background: 'var(--bg-subtle)',
    color: 'var(--text-primary)',
    width: '100%',
    borderRadius: '0.5rem',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    outline: 'none',
  }

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get('/experiments')
        setExperiments(res.data.filter(e => e.status === 'ACTIVE'))
      } catch (err) { console.error(err) }
    }
    load()
  }, [])

  useEffect(() => {
    async function loadStatus() {
      try {
        const res = await api.get('/notifications/status')
        setFirebaseConfigured(res.data.firebaseConfigured)
      } catch (err) { console.error(err) }
    }
    loadStatus()
  }, [])

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSend(e) {
    e.preventDefault()
    setError(null)
    setResult(null)
    if (!getActiveApp()) { setError('Select or create an app before sending a notification'); return }
    setSending(true)
    try {
      const res = await api.post('/notifications/send', {
        title: form.title,
        body: form.body,
        audience: {
          type: form.audienceType,
          ...(form.audienceType === 'EXPERIMENT' && { experimentId: form.experimentId }),
        },
      })
      setResult(res.data)
      setForm(prev => ({ ...prev, title: '', body: '' }))
    } catch (err) {
      // A non-2xx response (e.g. Firebase not configured) rejects here —
      // it never reaches setResult, so any detail like tokenCount has to
      // be folded into the error message itself.
      const data = err.response?.data
      const message = data?.error ?? 'Failed to send notification'
      setError(data?.tokenCount != null ? `${message} (${data.tokenCount} devices targeted)` : message)
    } finally {
      setSending(false)
    }
  }

  const labelStyle = { display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.25rem', color: 'var(--text-secondary)' }

  return (
    <div className="p-8 space-y-6" style={{ background: 'var(--bg-base)' }}>
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Notifications</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>Send push notifications to your app users</p>
      </div>

      {/* Compose form */}
      <div className="rounded-xl p-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Compose Notification</h3>
        <form onSubmit={handleSend} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>Title</label>
              <input name="title" value={form.title} onChange={handleChange}
                style={inputStyle} placeholder="Notification title" required
                onFocus={e => e.target.style.boxShadow = '0 0 0 2px var(--accent)'}
                onBlur={e => e.target.style.boxShadow = 'none'} />
            </div>
            <div>
              <label style={labelStyle}>Audience</label>
              <select name="audienceType" value={form.audienceType} onChange={handleChange} style={inputStyle}
                onFocus={e => e.target.style.boxShadow = '0 0 0 2px var(--accent)'}
                onBlur={e => e.target.style.boxShadow = 'none'}>
                <option value="ALL">All users</option>
                <option value="EXPERIMENT">Experiment participants</option>
              </select>
            </div>
          </div>

          {form.audienceType === 'EXPERIMENT' && (
            <div>
              <label style={labelStyle}>Experiment</label>
              <select name="experimentId" value={form.experimentId} onChange={handleChange} style={inputStyle} required
                onFocus={e => e.target.style.boxShadow = '0 0 0 2px var(--accent)'}
                onBlur={e => e.target.style.boxShadow = 'none'}>
                <option value="">Select an experiment...</option>
                {experiments.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label style={labelStyle}>Message</label>
            <textarea name="body" value={form.body} onChange={handleChange} rows={3}
              style={{ ...inputStyle, resize: 'none' }}
              placeholder="Notification message..." required
              onFocus={e => e.target.style.boxShadow = '0 0 0 2px var(--accent)'}
              onBlur={e => e.target.style.boxShadow = 'none'} />
          </div>

          {error && <p className="text-sm" style={{ color: '#EF4444' }}>{error}</p>}

          {result && (
            <div className="rounded-lg px-4 py-3" style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)' }}>
              {result.sent === 0 && result.message ? (
                <p className="text-sm" style={{ color: 'var(--accent-text)' }}>{result.message}</p>
              ) : (
                <p className="text-sm" style={{ color: 'var(--accent-text)' }}>
                  Sent to {result.sent} device{result.sent !== 1 ? 's' : ''}
                  {result.failed > 0 && ` · ${result.failed} failed`}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <button type="submit" disabled={sending}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{ background: 'var(--accent)', color: 'var(--accent-text-on)', border: 'none', cursor: 'pointer' }}>
              <Send size={15} />
              {sending ? 'Sending...' : 'Send Notification'}
            </button>
          </div>
        </form>
      </div>

      {/* Firebase status — reflects the server's actual configuration,
          checked via GET /notifications/status, instead of always warning
          regardless of whether it's really set up. */}
      {firebaseConfigured === false && (
        <div className="rounded-xl px-5 py-4" style={{ background: 'var(--status-paused-bg)', border: '1px solid var(--border)' }}>
          <div className="flex items-start gap-3">
            <Bell size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--status-paused-text)' }} />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--status-paused-text)' }}>Firebase not configured</p>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                Push notifications require Firebase credentials to be set in the server environment.
                Add FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY to your .env file.
              </p>
            </div>
          </div>
        </div>
      )}

      {firebaseConfigured === true && (
        <div className="rounded-xl px-5 py-4" style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)' }}>
          <div className="flex items-start gap-3">
            <Bell size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--accent-text)' }} />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--accent-text)' }}>Firebase is configured</p>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                Push notifications are enabled for this server.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}