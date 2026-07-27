/**
 * Post-build step: turn the SPA shell into real static HTML per public route,
 * then emit sitemap.xml and robots.txt for the domain this build targets.
 *
 * Runs after `vite build` (client → dist/) and `vite build --ssr` (server →
 * .prerender/entry-server.js). Fails the build on error, because a silently
 * skipped prerender means the site goes dark for every crawler that doesn't run
 * JavaScript. Set SKIP_PRERENDER=1 to opt out deliberately.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = process.cwd()
const DIST = path.join(ROOT, 'dist')
const SSR_ENTRY = path.join(ROOT, '.prerender', 'entry-server.js')

const HEAD_START = '<!--seo-head-start-->'
const HEAD_END = '<!--seo-head-end-->'
const APP_SLOT = '<!--app-html-->'

if (process.env.SKIP_PRERENDER === '1') {
  console.warn('[prerender] SKIP_PRERENDER=1 — skipping. Crawlers will see an empty shell.')
  process.exit(0)
}

const xmlEscape = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const buildSitemap = (entries, lastmod) =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...entries.map((entry) =>
      [
        '  <url>',
        `    <loc>${xmlEscape(entry.loc)}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        `    <changefreq>${entry.changefreq}</changefreq>`,
        `    <priority>${entry.priority}</priority>`,
        ...entry.images.map((img) =>
          [
            '    <image:image>',
            `      <image:loc>${xmlEscape(img.loc)}</image:loc>`,
            `      <image:title>${xmlEscape(img.title)}</image:title>`,
            '    </image:image>',
          ].join('\n'),
        ),
        '  </url>',
      ].join('\n'),
    ),
    '</urlset>',
    '',
  ].join('\n')

/**
 * vercel.json's SPA catch-all would happily serve the homepage HTML for
 * /about — same title, same canonical, duplicate content. Each prerendered
 * route therefore needs its own rewrite listed ahead of the catch-all, and this
 * check makes forgetting one a build failure rather than a silent regression.
 */
const assertRewritesCoverRoutes = async (routes) => {
  const config = JSON.parse(await readFile(path.join(ROOT, 'vercel.json'), 'utf8'))
  const sources = new Set((config.rewrites ?? []).map((r) => r.source))
  const missing = routes.filter((route) => route !== '/' && !sources.has(route))

  if (missing.length > 0) {
    throw new Error(
      `vercel.json is missing rewrites for: ${missing.join(', ')}\n` +
        missing
          .map((r) => `  { "source": "${r}", "destination": "${r}/index.html" }`)
          .join('\n'),
    )
  }
}

const main = async () => {
  const template = await readFile(path.join(DIST, 'index.html'), 'utf8')

  for (const marker of [HEAD_START, HEAD_END, APP_SLOT]) {
    if (!template.includes(marker)) {
      throw new Error(`dist/index.html is missing the ${marker} marker — check index.html`)
    }
  }

  const { render, PUBLIC_ROUTES, sitemapEntries, robotsTxt, SITE_URL } = await import(
    pathToFileURL(SSR_ENTRY).href
  )

  const headPattern = new RegExp(
    `${HEAD_START}[\\s\\S]*?${HEAD_END}`,
  )

  for (const route of PUBLIC_ROUTES) {
    const { html, head } = render(route)

    const page = template
      .replace(headPattern, `${HEAD_START}\n    ${head}\n    ${HEAD_END}`)
      .replace(APP_SLOT, html)

    const outDir = route === '/' ? DIST : path.join(DIST, route.replace(/^\//, ''))
    await mkdir(outDir, { recursive: true })
    await writeFile(path.join(outDir, 'index.html'), page, 'utf8')

    const kb = (Buffer.byteLength(page) / 1024).toFixed(1)
    console.log(`[prerender] ${route.padEnd(9)} → ${path.relative(ROOT, path.join(outDir, 'index.html'))} (${kb} kB)`)
  }

  await assertRewritesCoverRoutes(PUBLIC_ROUTES)

  const lastmod = new Date().toISOString().slice(0, 10)
  await writeFile(path.join(DIST, 'sitemap.xml'), buildSitemap(sitemapEntries(), lastmod), 'utf8')
  await writeFile(path.join(DIST, 'robots.txt'), robotsTxt(), 'utf8')

  console.log(`[prerender] sitemap.xml + robots.txt written for ${SITE_URL}`)
}

main().catch((error) => {
  console.error('\n[prerender] FAILED — the built site would be invisible to non-JS crawlers.')
  console.error(error)
  process.exit(1)
})
