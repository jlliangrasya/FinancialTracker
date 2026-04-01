import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const ThemeContext = createContext()

export function useTheme() {
  return useContext(ThemeContext)
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem('pesowise_theme')
    if (stored === 'dark' || stored === 'light') return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('pesowise_theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    document.body.classList.add('theme-transitioning')
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
    setTimeout(() => document.body.classList.remove('theme-transitioning'), 400)
  }, [])

  const isDark = theme === 'dark'

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
