import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import App from './App.tsx'

const container = document.getElementById('root')!

const tree = (
  <StrictMode>
    <App />
  </StrictMode>
)

/**
 * Public routes ship with prerendered markup inside #root (scripts/prerender.mjs);
 * /admin and /invoice fall through to an empty shell.
 *
 * Hydrating rather than client-rendering is what makes the prerender pay off for
 * real users, not just crawlers: client-rendering throws the prerendered DOM away
 * and rebuilds it, so the largest element repaints only once the JS bundle has
 * parsed. Measured on the homepage, that was 89% of a 5.9 s LCP.
 *
 * Three things had to line up for the first client render to match the server:
 * scroll-reveal starts revealed (use-reveal.ts), the theme store skips automatic
 * persistence hydration (store/theme.ts), and CMS hooks render their static
 * fallback first (use-site-content.ts). If a mismatch ever slips through, React
 * logs an error and falls back to client rendering — i.e. the previous behaviour.
 */
if (container.firstElementChild) {
  hydrateRoot(container, tree)
} else {
  createRoot(container).render(tree)
}
