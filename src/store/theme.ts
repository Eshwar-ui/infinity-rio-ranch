import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'dark' | 'light'
export type Accent = 'brass' | 'champagne' | 'copper' | 'sage'

type ThemeState = {
  theme: Theme
  accent: Accent
  toggleTheme: () => void
  setAccent: (accent: Accent) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'light',
      accent: 'brass',
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setAccent: (accent) => set({ accent }),
    }),
    { name: 'irr-theme' },
  ),
)

/** Logo asset swaps with the theme (dark uses the cream cutout). */
export const logoFor = (theme: Theme) =>
  theme === 'light' ? '/assets/logo-cutout-dark.png' : '/assets/logo-cutout.png'
