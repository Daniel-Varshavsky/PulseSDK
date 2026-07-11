import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:3000',
})

// Restore auth headers synchronously at module load, before any component
// mounts — a React effect runs too late (child effects fire before parent
// effects), so the first requests on a hard page reload would otherwise go
// out unauthenticated and 401.
const storedToken = localStorage.getItem('pulsesdk_token')
if (storedToken) api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`

const storedApp = localStorage.getItem('pulsesdk_active_app')
if (storedApp) {
  try {
    const app = JSON.parse(storedApp)
    if (app?.apiKey) api.defaults.headers.common['x-api-key'] = app.apiKey
  } catch {
    localStorage.removeItem('pulsesdk_active_app')
  }
}

export function setToken(token) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    localStorage.setItem('pulsesdk_token', token)
  } else {
    delete api.defaults.headers.common['Authorization']
    localStorage.removeItem('pulsesdk_token')
  }
}

export function setApiKey(key) {
  if (key) {
    api.defaults.headers.common['x-api-key'] = key
    localStorage.setItem('pulsesdk_api_key', key)
  } else {
    delete api.defaults.headers.common['x-api-key']
    localStorage.removeItem('pulsesdk_api_key')
  }
}

export function setActiveApp(app) {
  if (app) {
    localStorage.setItem('pulsesdk_active_app', JSON.stringify(app))
    setApiKey(app.apiKey)
  } else {
    localStorage.removeItem('pulsesdk_active_app')
    setApiKey(null)
  }
}

export function getActiveApp() {
  const stored = localStorage.getItem('pulsesdk_active_app')
  return stored ? JSON.parse(stored) : null
}

export function getToken() {
  return localStorage.getItem('pulsesdk_token')
}

export function isLoggedIn() {
  return !!getToken()
}

export default api