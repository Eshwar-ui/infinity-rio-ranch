#!/usr/bin/env node
/**
 * Snapshots the CMS into src/data/content.generated.json, which the app imports
 * statically.
 *
 * This is what puts CMS content into the prerendered HTML. `scripts/prerender.mjs`
 * renders the real React tree, but effects don't run during SSR, so anything a
 * hook fetches in `useEffect` is missing from `dist/` — crawlers would keep
 * reading whatever was hardcoded at build time. Pulling the tables here, ahead
 * of `tsc`, means the same values are baked into the markup, bundled for the
 * client's first render (so hydration matches), and then refreshed live in the
 * browser for anything published since the deploy.
 *
 * Deliberately forgiving: if the credentials are absent, the network is down,
 * or the tables don't exist yet, it leaves the committed snapshot untouched and
 * exits 0. A content pull is not a reason to fail a deploy — the app falls back
 * to src/data/site.ts and src/data/copy.defaults.json and renders fine.
 *
 * The output file is committed so builds are reproducible offline. Run
 * `npm run pull:content` after publishing CMS edits, or let the deploy do it.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const OUT = resolve(root, 'src/data/content.generated.json')

/** Reads VITE_* vars from the environment, falling back to .env.local. */
const readEnv = () => {
  const env = { ...process.env }
  const local = resolve(root, '.env.local')
  if (existsSync(local)) {
    for (const line of readFileSync(local, 'utf8').split('\n')) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
      if (!match) continue
      const [, key, raw] = match
      if (env[key]) continue
      env[key] = raw.trim().replace(/^["']|["']$/g, '')
    }
  }
  return env
}

const skip = (why) => {
  console.log(`[pull-content] ${why} — keeping the committed snapshot.`)
  process.exit(0)
}

const env = readEnv()
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY
if (!url || !key) skip('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set')

/**
 * Queried over PostgREST directly rather than through @supabase/supabase-js:
 * the build only needs four GETs with the anon key, and this keeps a 110 kB
 * client (and its Node-vs-browser entry points) out of the build tooling.
 */
const select = async (path) => {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`)
  return res.json()
}

const published = (table, columns) =>
  select(`${table}?select=${columns}&published=eq.true&order=sort.asc`)

try {
  const [copyRows, stats, amenities, listRows, testimonials, events, faqs, gallery] =
    await Promise.all([
      select('site_copy?select=key,value'),
      published('stats', 'value,label'),
      published('amenities', 'icon,title,sub'),
      published('list_items', 'list,value'),
      published('testimonials', 'quote,name,event'),
      published('events', 'title,blurb,image'),
      published('faqs', 'question,answer'),
      published('gallery', 'label,cat,src,span,featured'),
    ])

  const copy = {}
  for (const row of copyRows) {
    // An empty value means "use the shipped default", so don't record it.
    if (row.value) copy[row.key] = row.value
  }

  const lists = {}
  for (const row of listRows) {
    ;(lists[row.list] ??= []).push(row.value)
  }

  const snapshot = {
    pulledAt: new Date().toISOString(),
    copy,
    stats,
    amenities,
    lists,
    testimonials: testimonials.map((r) => ({
      quote: r.quote,
      name: r.name,
      event: r.event ?? '',
    })),
    // `n` is derived from order at render time, matching use-site-content.ts.
    events: events.map((r) => ({
      n: '',
      title: r.title,
      blurb: r.blurb ?? '',
      image: r.image ?? '',
    })),
    faqs: faqs.map((r) => ({ q: r.question, a: r.answer })),
    gallery: gallery.map((r) => ({
      label: r.label,
      cat: r.cat,
      src: r.src,
      span: r.span ?? null,
      featured: !!r.featured,
    })),
  }

  writeFileSync(OUT, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')

  const counts = [
    `${Object.keys(copy).length} copy keys`,
    `${stats.length} stats`,
    `${amenities.length} amenities`,
    `${Object.values(lists).flat().length} list items`,
    `${testimonials.length} testimonials`,
    `${events.length} events`,
    `${faqs.length} faqs`,
    `${gallery.length} photos`,
  ]
  console.log(`[pull-content] ${counts.join(', ')} → src/data/content.generated.json`)
} catch (err) {
  skip(`could not read the CMS (${err.message})`)
}
