import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'dark' | 'light'

interface SettingsState {
  theme: Theme
  notificationsEnabled: boolean
  soundEnabled: boolean
  desktopNotifications: boolean
  callRingtone: boolean
  fontSize: 'small' | 'medium' | 'large'
  setTheme: (v: Theme) => void
  setNotifications: (v: boolean) => void
  setSound: (v: boolean) => void
  setDesktop: (v: boolean) => void
  setRingtone: (v: boolean) => void
  setFontSize: (v: 'small' | 'medium' | 'large') => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'dark',
      notificationsEnabled: true,
      soundEnabled: true,
      desktopNotifications: false,
      callRingtone: true,
      fontSize: 'medium',
      setTheme: (theme) => {
        set({ theme })
        applyTheme(theme)
      },
      setNotifications: (notificationsEnabled) => set({ notificationsEnabled }),
      setSound: (soundEnabled) => set({ soundEnabled }),
      setDesktop: (desktopNotifications) => set({ desktopNotifications }),
      setRingtone: (callRingtone) => set({ callRingtone }),
      setFontSize: (fontSize) => set({ fontSize }),
    }),
    {
      name: 'teamvault-settings',
      onRehydrateStorage: () => (state) => {
        if (state?.theme) applyTheme(state.theme)
      },
    }
  )
)

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'light') root.classList.add('light')
  else root.classList.remove('light')
}
