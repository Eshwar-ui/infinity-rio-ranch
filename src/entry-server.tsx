/**
 * Build-time render entry. Never shipped to the browser.
 *
 * `scripts/prerender.mjs` imports this, renders each public route to a string
 * and bakes it into dist/<route>/index.html. That is the difference between a
 * crawler seeing an empty `<div id="root">` and seeing the actual copy — most
 * AI crawlers (GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot) do not execute
 * JavaScript, so without this step the site is invisible to them.
 */

import { renderToString } from 'react-dom/server'
import { Route, Routes, StaticRouter } from 'react-router-dom'

import { AppShell } from '@/components/layout/app-shell'
import { RootLayout } from '@/components/layout/root-layout'
import { HomePage } from '@/pages/home'
import { AboutPage } from '@/pages/about'
import { GalleryPage } from '@/pages/gallery'
import { ContactPage } from '@/pages/contact'
import { NotFoundPage } from '@/pages/not-found'
import {
  buildHead,
  factsJson,
  llmsFullTxt,
  llmsTxt,
  renderHeadTags,
  robotsTxt,
  sitemapEntries,
  NOT_FOUND_ROUTE,
  PUBLIC_ROUTES,
  SITE_URL,
} from '@/lib/seo'

export {
  PUBLIC_ROUTES,
  NOT_FOUND_ROUTE,
  SITE_URL,
  robotsTxt,
  sitemapEntries,
  llmsTxt,
  llmsFullTxt,
  factsJson,
}

/** Mirrors the public branch of the router in src/App.tsx. */
const PublicRoutes = () => (
  <Routes>
    <Route element={<RootLayout />}>
      <Route path="/" element={<HomePage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/gallery" element={<GalleryPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  </Routes>
)

export const render = (url: string) => ({
  // AppShell must wrap this exactly as it does in App.tsx — see its comment.
  html: renderToString(
    <AppShell>
      <StaticRouter location={url}>
        <PublicRoutes />
      </StaticRouter>
    </AppShell>,
  ),
  head: renderHeadTags(buildHead(url)),
})
