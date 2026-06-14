import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from './api'
import type { Settings, User } from './types'

interface AppState {
  user: User | null
  providers: string[]
  settings: Settings
  loading: boolean
  logout: () => Promise<void>
  refreshSettings: () => Promise<void>
}

const defaultSettings: Settings = {
  app_name: 'Khảo sát',
  primary_color: '#2563eb',
  font_family: 'Inter',
  logo_url: '',
}

const AppContext = createContext<AppState>({
  user: null,
  providers: [],
  settings: defaultSettings,
  loading: true,
  logout: async () => {},
  refreshSettings: async () => {},
})

function applyTheme(settings: Settings) {
  const root = document.documentElement
  root.style.setProperty('--primary', settings.primary_color || '#2563eb')
  const font = settings.font_family || 'Inter'
  root.style.setProperty('--font', `"${font}", system-ui, sans-serif`)
  document.title = settings.app_name || 'Khảo sát'

  // Load the configured font from Google Fonts.
  const id = 'theme-font-link'
  let link = document.getElementById(id) as HTMLLinkElement | null
  if (!link) {
    link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    document.head.appendChild(link)
  }
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400;500;600;700&display=swap`
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [providers, setProviders] = useState<string[]>([])
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [loading, setLoading] = useState(true)

  const refreshSettings = async () => {
    const s = await api<Settings>('/settings')
    setSettings(s)
    applyTheme(s)
  }

  useEffect(() => {
    Promise.allSettled([
      refreshSettings(),
      api<{ user: User | null; providers: string[] }>('/auth/me').then((me) => {
        setUser(me.user)
        setProviders(me.providers)
      }),
    ]).finally(() => setLoading(false))
  }, [])

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' })
    setUser(null)
  }

  return (
    <AppContext.Provider value={{ user, providers, settings, loading, logout, refreshSettings }}>
      {children}
    </AppContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  return useContext(AppContext)
}
