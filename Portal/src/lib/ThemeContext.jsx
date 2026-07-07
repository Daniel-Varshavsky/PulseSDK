// src/lib/ThemeContext.jsx
import { createContext, useContext, useState, useEffect } from 'react'
import { applyTheme, getStoredTheme, themes } from './themes'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [themeKey, setThemeKey] = useState(getStoredTheme)

  useEffect(() => {
    applyTheme(themeKey)
  }, [themeKey])

  function changeTheme(key) {
    setThemeKey(key)
    applyTheme(key)
  }

  return (
    <ThemeContext.Provider value={{ themeKey, changeTheme, theme: themes[themeKey] }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}