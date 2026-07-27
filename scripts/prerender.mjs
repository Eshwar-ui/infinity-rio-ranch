/**
 * Post-build step: turn the SPA shell into real static HTML per public route,
 * then emit sitemap.xml and robots.txt for the domain this build targets.
 *
 * Runs after `vite build` (client → dist/) and `vite build --ssr` (server →
 * .prerender/entry-server.js). Fails the build on error, because a silently
 * skipped prerender means the site goes dark for every crawler that doesn't run
 * JavaScript. Set SKIP_PRERENDER=1 to opt out deliberately.
 */

import { execFileSync } from 'node:child_process'
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

/**
 * When each route last actually changed, from git — not from the clock.
 *
 * A `lastmod` of "today" on every URL at every deploy is a lie, and Google's
 * documented response to a sitemap whose lastmod it cannot trust is to ignore
 * the field for the whole site. So: the date of the last commit touching the
 * files that compose the route, or nothing at all.
 *
 * Returns null rather than guessing when git can't answer — CI often checks out
 * shallow, and `git log` then legitimately has no commit for an older file.
 * An absent lastmod costs nothing; a wrong one costs the signal.
 */
const SHARED_SOURCES = [
  'src/data/site.ts',
  'src/lib/seo.ts',
  'src/components/layout',
  'src/components/sections',
]

const routeSources = (route) => [
  route === '/' ? 'src/pages/home.tsx' : `src/pages${route}.tsx`,
  ...SHARED_SOURCES,
]

const gitLastModified = (route) => {
  try {
    const out = execFileSync(
      'git',
      ['log', '-1', '--format=%cI', '--', ...routeSources(route)],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim()
    return out || null
  } catch {
    return null
  }
}

/**
 * `changefreq` and `priority` are intentionally absent — Google ignores both,
 * and `priority` is self-assigned so it carries no information.
 */
const buildSitemap = (entries) =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...entries.map((entry) =>
      [
        '  <url>',
        `    <loc>${xmlEscape(entry.loc)}</loc>`,
        ...(entry.lastmod ? [`    <lastmod>${xmlEscape(entry.lastmod)}</lastmod>`] : []),
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
 * Two things must hold in vercel.json, and both fail silently in ways that only
 * show up in a traffic chart weeks later:
 *
 * 1. Every prerendered route needs its own rewrite. Without one it would fall
 *    through to whatever comes next and serve the wrong HTML.
 * 2. The SPA-only branches (/admin, /invoice) need rewrites, because there is
 *    no catch-all any more. A blanket `/(.*)` → /index.html is what used to
 *    make *every* unknown URL return 200 with the homepage's markup — an
 *    unbounded set of soft-404 duplicates. If someone reinstates it, say so.
 */
const SPA_REWRITES = ['/admin', '/admin/(.*)', '/invoice/(.*)']

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

  const missingSpa = SPA_REWRITES.filter((source) => !sources.has(source))
  if (missingSpa.length > 0) {
    throw new Error(
      `vercel.json is missing the SPA rewrites for: ${missingSpa.join(', ')}\n` +
        'Without them /admin and /invoice/<token> return 404 instead of loading the app.',
    )
  }

  const catchAll = [...sources].find((s) => s === '/(.*)' || s === '/(.+)')
  if (catchAll) {
    throw new Error(
      `vercel.json has a catch-all rewrite ("${catchAll}") again.\n` +
        'It makes every unknown URL return 200 with the homepage HTML (soft 404s).\n' +
        'Unknown paths must fall through to dist/404.html so they return a real 404.',
    )
  }
}

const main = async () => {
  const {
    render,
    PUBLIC_ROUTES,
    NOT_FOUND_ROUTE,
    sitemapEntries,
    robotsTxt,
    llmsTxt,
    llmsFullTxt,
    factsJson,
    SITE_URL,
  } = await import(pathToFileURL(SSR_ENTRY).href)

  /*
   * Validate vercel.json first. A routing mistake is cheap to detect and cheap
   * to fix, so it should not cost a full render pass to surface — and checking
   * here keeps the check independent of whatever state dist/ happens to be in.
   */
  await assertRewritesCoverRoutes(PUBLIC_ROUTES)

  const template = await readFile(path.join(DIST, 'index.html'), 'utf8')

  for (const marker of [HEAD_START, HEAD_END, APP_SLOT]) {
    if (!template.includes(marker)) {
      throw new Error(
        `dist/index.html is missing the ${marker} marker.\n` +
          'Either index.html lost it, or prerender ran twice without an intervening ' +
          '`vite build` (the first pass replaces the markers). Re-run `npm run build`.',
      )
    }
  }

  const headPattern = new RegExp(
    `${HEAD_START}[\\s\\S]*?${HEAD_END}`,
  )

  const renderRoute = (route) => {
    const { html, head } = render(route)
    return template
      .replace(headPattern, `${HEAD_START}\n    ${head}\n    ${HEAD_END}`)
      .replace(APP_SLOT, html)
  }

  const report = (label, file, body) =>
    console.log(
      `[prerender] ${label.padEnd(14)} → ${path.relative(ROOT, file)} (${(
        Buffer.byteLength(body) / 1024
      ).toFixed(1)} kB)`,
    )

  for (const route of PUBLIC_ROUTES) {
    const page = renderRoute(route)
    const outDir = route === '/' ? DIST : path.join(DIST, route.replace(/^\//, ''))
    await mkdir(outDir, { recursive: true })
    const file = path.join(outDir, 'index.html')
    await writeFile(file, page, 'utf8')
    report(route, file, page)
  }

  /*
   * 404.html sits in the output root, where Vercel picks it up for any path
   * that matches no file and no rewrite — and serves it with a real 404.
   * It is not in PUBLIC_ROUTES, so it never reaches the sitemap.
   */
  const notFound = renderRoute(NOT_FOUND_ROUTE)
  const notFoundFile = path.join(DIST, '404.html')
  await writeFile(notFoundFile, notFound, 'utf8')
  report(NOT_FOUND_ROUTE, notFoundFile, notFound)

  const dated = sitemapEntries().map((entry) => ({
    ...entry,
    lastmod: gitLastModified(entry.route),
  }))

  const undated = dated.filter((e) => !e.lastmod)
  if (undated.length > 0) {
    console.warn(
      `[prerender] no git history for ${undated.length} route(s) — emitting them ` +
        'without <lastmod> rather than stamping today. Shallow clone?',
    )
  }

  const files = [
    ['sitemap.xml', buildSitemap(dated)],
    ['robots.txt', robotsTxt()],
    ['llms.txt', llmsTxt()],
    ['llms-full.txt', llmsFullTxt()],
    ['facts.json', factsJson()],
  ]

  for (const [name, body] of files) {
    const file = path.join(DIST, name)
    await writeFile(file, body, 'utf8')
    report(name, file, body)
  }

  console.log(`[prerender] all crawl + LLM files written for ${SITE_URL}`)
}

main().catch((error) => {
  console.error('\n[prerender] FAILED — the built site would be invisible to non-JS crawlers.')
  console.error(error)
  process.exit(1)
})
