import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { setToken, setApiKey, getToken, getActiveApp } from './lib/api'
import { ThemeProvider } from './lib/ThemeContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Experiments from './pages/Experiments'
import ExperimentDetail from './pages/ExperimentDetail'
import Feedback from './pages/Feedback'
import Notifications from './pages/Notifications'
import Settings from './pages/Settings'
import Team from './pages/Team'

function ProtectedRoute({ children }) {
  const loggedIn = !!getToken()
  const hasApp = !!getActiveApp()
  if (!loggedIn || !hasApp) return <Navigate to="/login" replace />
  return children
}

function PublicRoute({ children }) {
  const loggedIn = !!getToken()
  const hasApp = !!getActiveApp()
  if (loggedIn && hasApp) return <Navigate to="/dashboard" replace />
  return children
}

function App() {
  useEffect(() => {
    const token = getToken()
    if (token) setToken(token)
    const app = getActiveApp()
    if (app) setApiKey(app.apiKey)
  }, [])

  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route
            path="/"
            element={<ProtectedRoute><Layout /></ProtectedRoute>}
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="experiments" element={<Experiments />} />
            <Route path="experiments/:id" element={<ExperimentDetail />} />
            <Route path="feedback" element={<Feedback />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings" element={<Settings />} />
            <Route path="team" element={<Team />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App