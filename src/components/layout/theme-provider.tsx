import { useEffect } from 'react'

import { useThemeStore } from '@/store/theme'

/**
 * Reflects the theme store onto <html data-theme data-accent>, which drives the
 * CSS-variable palettes declared in index.css. Renders nothing.
 */
export const ThemeProvider = () => {
  const theme = useThemeStore((s) => s.theme)
  const accent = useThemeStore((s) => s.accent)

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
    root.setAttribute('data-accent', accent)
  }, [theme, accent])

  return null
}
