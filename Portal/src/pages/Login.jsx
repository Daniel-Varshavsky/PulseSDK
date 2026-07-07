import { useState } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useGoogleLogin } from '@react-oauth/google'
import { setToken, setActiveApp } from '../lib/api'
import api from '../lib/api'

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [apps, setApps] = useState(null)
  const [token, setTokenState] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()
  const registered = location.state?.registered

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handlePostLogin(jwt) {
    setTokenState(jwt)
    setToken(jwt)

    const appsRes = await api.get('/apps/my', {
      headers: { Authorization: `Bearer ${jwt}` },
    })

    if (appsRes.data.length === 0) {
      setApps([])
    } else if (appsRes.data.length === 1) {
      setActiveApp(appsRes.data[0])
      navigate('/dashboard')
    } else {
      setApps(appsRes.data)
    }
  }

  async function handleLogin(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await api.post('/auth/login', form)
      await handlePostLogin(res.data.token)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to log in')
      setToken(null)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true)
      setError(null)
      try {
        // Exchange Google access token for user info, then send to our server
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        })
        const userInfo = await userInfoRes.json()

        const res = await api.post('/auth/google', { idToken: tokenResponse.access_token, userInfo })
        await handlePostLogin(res.data.token)
      } catch (err) {
        setError(err.response?.data?.error ?? 'Failed to sign in with Google')
        setToken(null)
      } finally {
        setGoogleLoading(false)
      }
    },
    onError: () => {
      setError('Google sign-in was cancelled or failed')
    },
  })

  async function handleCreateApp(name) {
    try {
      const res = await api.post('/apps', { name }, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setActiveApp(res.data)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to create app')
    }
  }

  function handleSelectApp(app) {
    setActiveApp(app)
    navigate('/dashboard')
  }

  if (apps !== null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-md">
          {apps.length === 0
            ? <CreateAppForm onSubmit={handleCreateApp} />
            : <AppPicker apps={apps} onSelect={handleSelectApp} onCreateNew={() => setApps([])} />
          }
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
        <p className="text-teal-600 text-sm mt-0.5 mb-6">PulseSDK Developer Portal</p>

        {registered && (
          <div className="mb-4 bg-teal-50 border border-teal-200 text-teal-700 text-sm rounded-lg px-3 py-2">
            Account created successfully — please log in.
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input name="email" type="email" value={form.email} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input name="password" type="password" value={form.password} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              required />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full bg-teal-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50">
            {loading ? 'Logging in...' : 'Log in'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-sm text-gray-400">or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <button
          onClick={() => handleGoogleLogin()}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {/* Google logo SVG */}
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            <path fill="none" d="M0 0h48v48H0z"/>
          </svg>
          {googleLoading ? 'Signing in...' : 'Sign in with Google'}
        </button>

        <p className="text-center text-sm text-gray-500 mt-4">
          Don't have an account?{' '}
          <Link to="/register" className="text-teal-600 hover:text-teal-700 font-medium">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}

function AppPicker({ apps, onSelect, onCreateNew }) {
  return (
    <>
      <h2 className="text-lg font-bold text-gray-900 mb-1">Select an app</h2>
      <p className="text-sm text-gray-500 mb-4">Choose which app to manage</p>
      <div className="space-y-2">
        {apps.map(app => (
          <button key={app.id} onClick={() => onSelect(app)}
            className="w-full text-left border border-gray-200 rounded-lg px-4 py-3 hover:border-teal-400 hover:bg-teal-50 transition-colors">
            <p className="text-sm font-medium text-gray-900">{app.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{app.role}</p>
          </button>
        ))}
      </div>
      <button onClick={onCreateNew}
        className="mt-4 w-full text-sm text-teal-600 hover:text-teal-700 font-medium">
        + Create a new app
      </button>
    </>
  )
}

function CreateAppForm({ onSubmit }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    await onSubmit(name)
    setLoading(false)
  }

  return (
    <>
      <h2 className="text-lg font-bold text-gray-900 mb-1">Create your first app</h2>
      <p className="text-sm text-gray-500 mb-4">You don't have any apps yet. Create one to get started.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">App name</label>
          <input value={name} onChange={e => setName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            placeholder="e.g. My Android App" required />
        </div>
        <button type="submit" disabled={loading}
          className="w-full bg-teal-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
          {loading ? 'Creating...' : 'Create app'}
        </button>
      </form>
    </>
  )
}