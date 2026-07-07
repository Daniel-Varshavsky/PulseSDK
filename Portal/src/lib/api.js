import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:3000',
})

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