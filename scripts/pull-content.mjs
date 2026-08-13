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
  if (!res.ok) {
    const error = new Error(`${path} → ${res.status} ${await res.text()}`)
    error.status = res.status
    throw error
  }
  return res.json()
}

/**
 * A table that PostgREST reports as absent is treated as empty; anything else
 * still takes the whole pull down.
 *
 * The distinction matters. A 404 (PGRST205, "could not find the table") is a
 * migration this project hasn't had applied — a known, local, permanent state
 * that the app already handles by falling back to its shipped defaults. A
 * timeout or a 5xx is transient, and quietly writing an empty section for it
 * would overwrite good committed content with nothing.
 *
 * This used to be all-or-nothing, and the cost was invisible: a project missing
 * one migration produced an *entirely* empty snapshot, so every other table's
 * content silently stopped reaching the prerendered HTML too.
 */
const optional = async (label, path) => {
  try {
    return await select(path)
  } catch (err) {
    if (err.status === 404) {
      console.warn(`[pull-content] ⚠ no ${label} table on this project — treating as empty.`)
      return []
    }
    throw err
  }
}

const published = (table, columns) =>
  optional(table, `${table}?select=${columns}&published=eq.true&order=sort.asc`)

/** Posts are ordered by publication date, not by a `sort` column. */
const POST_COLUMNS =
  'slug,title,excerpt,body,cover_image,cover_alt,seo_title,seo_description,category,tags,primary_query,author,faqs,cta_heading,cta_body,published_at,updated_at'

/**
 * What 0008 shipped. 0010 added `category`/`tags`/`primary_query`, and PostgREST answers a
 * *whole-request* 400 (42703) when one selected column is missing — so on a
 * project that never had 0010 applied the entire blog silently fell back to the
 * committed snapshot, cover images and all. One absent field must cost that
 * field, not the article.
 */
const CORE_POST_COLUMNS =
  'slug,title,excerpt,body,cover_image,cover_alt,seo_title,seo_description,author,faqs,cta_heading,cta_body,published_at,updated_at'

const postsPath = (columns) =>
  `posts?select=${columns}&published=eq.true&order=published_at.desc`

const pullPosts = async () => {
  try {
    return await optional('posts', postsPath(POST_COLUMNS))
  } catch (err) {
    if (err.status !== 400 || !/42703|does not exist/.test(err.message)) throw err
    console.warn(
      '[pull-content] ⚠ posts is missing the 0010 columns (category/tags/primary_query) — ' +
        'pulling without them. Apply supabase/migrations/0010_post_content_seo.sql.',
    )
    return optional('posts', postsPath(CORE_POST_COLUMNS))
  }
}

try {
  const [copyRows, stats, amenities, listRows, testimonials, events, faqs, gallery, posts] =
    await Promise.all([
      optional('site_copy', 'site_copy?select=key,value'),
      published('stats', 'value,label'),
      published('amenities', 'icon,title,sub'),
      published('list_items', 'list,value'),
      published('testimonials', 'quote,name,event'),
      published('events', 'title,blurb,image'),
      published('faqs', 'question,answer'),
      published('gallery', 'label,cat,src,span,featured'),
      pullPosts(),
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
    posts: posts.map((r) => ({
      slug: r.slug,
      title: r.title,
      excerpt: r.excerpt ?? '',
      body: r.body ?? '',
      coverImage: r.cover_image ?? '',
      coverAlt: r.cover_alt ?? '',
      seoTitle: r.seo_title ?? '',
      seoDescription: r.seo_description ?? '',
      category: r.category ?? '',
      tags: Array.isArray(r.tags) ? r.tags.map(String).filter(Boolean) : [],
      primaryQuery: r.primary_query ?? '',
      author: r.author ?? '',
      // Defensive: jsonb comes back parsed, but a hand-edited row could hold
      // anything, and a malformed entry here would throw inside the prerender.
      faqs: Array.isArray(r.faqs)
        ? r.faqs
            .filter((f) => f && f.q && f.a)
            .map((f) => ({ q: String(f.q), a: String(f.a) }))
        : [],
      ctaHeading: r.cta_heading ?? '',
      ctaBody: r.cta_body ?? '',
      publishedAt: r.published_at ?? null,
      updatedAt: r.updated_at ?? null,
    })),
  }

  writeFileSync(OUT, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')

  /*
   * Post bodies are bundled for the browser, not just baked into the HTML: the
   * blog pages can't be lazy chunks without breaking hydration against the
   * prerendered markup. That's fine at a venue blog's scale and quietly awful
   * at ten times it, and the failure mode is a slow first paint nobody
   * attributes to the CMS — so say something before it gets there.
   */
  const bodyBytes = posts.reduce((n, r) => n + Buffer.byteLength(r.body ?? ''), 0)
  if (bodyBytes > 200_000) {
    console.warn(
      `[pull-content] ⚠ ${(bodyBytes / 1024).toFixed(0)} kB of post bodies are now ` +
        'bundled for every visitor. Past ~200 kB it is worth moving the blog to ' +
        'its own lazily-fetched route — see the note in CLAUDE.md.',
    )
  }

  const counts = [
    `${Object.keys(copy).length} copy keys`,
    `${stats.length} stats`,
    `${amenities.length} amenities`,
    `${Object.values(lists).flat().length} list items`,
    `${testimonials.length} testimonials`,
    `${events.length} events`,
    `${faqs.length} faqs`,
    `${gallery.length} photos`,
    `${posts.length} posts`,
  ]
  console.log(`[pull-content] ${counts.join(', ')} → src/data/content.generated.json`)
} catch (err) {
  skip(`could not read the CMS (${err.message})`)
}
