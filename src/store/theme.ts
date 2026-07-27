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
    {
      name: 'irr-theme',
      /**
       * Without this, the store reads localStorage during module init, so a
       * returning dark-mode visitor's first client render disagrees with the
       * prerendered HTML and hydration bails out to a full client render.
       * ThemeProvider calls rehydrate() in an effect instead.
       */
      skipHydration: true,
    },
  ),
)

/** Logo asset swaps with the theme (dark uses the cream cutout). */
export const logoFor = (theme: Theme) =>
  theme === 'light' ? '/assets/logo-cutout-dark.png' : '/assets/logo-cutout.png'
