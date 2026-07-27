import { useEffect } from 'react'

import { useThemeStore } from '@/store/theme'

/**
 * Reflects the theme store onto <html data-theme data-accent>, which drives the
 * CSS-variable palettes declared in index.css. Renders nothing.
 */
export const ThemeProvider = () => {
  const theme = useThemeStore((s) => s.theme)
  const accent = useThemeStore((s) => s.accent)

  // The store is created with skipHydration so the first render matches the
  // prerendered HTML; the saved theme is applied here, right after mount.
  useEffect(() => {
    void useThemeStore.persist.rehydrate()
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
    root.setAttribute('data-accent', accent)
  }, [theme, accent])

  return null
}
