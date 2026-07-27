# SEO / AEO / GEO

How search visibility works in this repo, what was implemented, and what still
needs a human. Keep this accurate — delete lines that go stale.

- **SEO** — classic search: Google/Bing crawling, indexing and ranking.
**Canonical host: `https://www.infinityrioranch.com`** (the apex redirects to
www). It's the default in `src/lib/seo.ts`; `VITE_SITE_URL` overrides it. The
`infinity-rio-ranch.vercel.app` URL still resolves — the canonical tags are what
keep it out of the index as duplicate content.

- **AEO** — answer engines: featured snippets, People Also Ask, voice results.
  Wants short, directly-extractable answers under question-shaped headings.
- **GEO** — generative engines: ChatGPT Search, Perplexity, Claude, AI
  Overviews. Wants a clearly-named entity, dense verifiable facts, and HTML that
  can be read **without running JavaScript**.

---

## Baseline (before this pass)

| Dimension | Score | The problem |
|---|---|---|
| SEO | 3/10 | 30 MB of unoptimised photos. One `<title>` and one description for the entire site. No canonical, no OG/Twitter cards, no sitemap, no robots.txt, no structured data. Every photo was a CSS `background-image` — zero alt text, zero image-search surface. |
| GEO | 2/10 | A client-rendered SPA served `<div id="root"></div>` and nothing else. GPTBot, ClaudeBot, PerplexityBot and OAI-SearchBot do not execute JavaScript, so the venue was effectively **absent** from every AI answer engine. No entity markup tying the brand to a real place. |
| AEO | 2/10 | The five FAQ answers — the site's only question-shaped content — lived in a Radix accordion that unmounts closed panels, so they existed in *no* HTML at all. No FAQ schema. |

The single most damaging issue was that everything except the SPA shell required
JavaScript. That is fixed by prerendering (below).

---

## What is implemented

### 1. Build-time prerendering — `src/entry-server.tsx`, `scripts/prerender.mjs`

`npm run build` now runs four steps:

```
tsc -b  →  vite build (client → dist/)  →  vite build --ssr (→ .prerender/)  →  node scripts/prerender.mjs
```

The prerender step renders each public route with `renderToString` and writes
real HTML:

```
dist/index.html          /          62 kB
dist/about/index.html    /about     36 kB
dist/gallery/index.html  /gallery   52 kB
dist/contact/index.html  /contact   34 kB
```

Crawlers now get the full copy, headings, images and structured data with no JS.
Browsers still get the same SPA: `src/main.tsx` clears `#root` and
client-renders. We deliberately **do not hydrate** — theme, CMS content and
scroll-reveal state all differ between build time and first paint, so hydration
would mismatch on every load.

A prerender failure **fails the build** on purpose (`SKIP_PRERENDER=1` opts out).
A silently skipped prerender means the site goes dark for AI crawlers, and that
is not something you want to discover from a traffic chart three weeks later.

`src/hooks/use-reveal.ts` starts `shown: true` when there is no `window`, so the
prerendered HTML isn't a page of `opacity: 0` text.

### 2. One source of truth for every signal — `src/lib/seo.ts`

Titles, descriptions, canonicals, OG/Twitter cards, JSON-LD, `sitemap.xml` and
`robots.txt` are all built from this one module. It is consumed twice:

- **build time** by the prerenderer (`renderHeadTags`), and
- **runtime** by `useDocumentHead()` (mounted in `RootLayout`), which *upserts*
  tags on client-side navigation rather than appending, so SPA route changes
  replace the baked-in tags instead of duplicating them.

Per-route titles and descriptions:

| Route | Title | Length |
|---|---|---|
| `/` | Wedding & Event Venue near Austin \| Infinity at Rio Ranch | 56 |
| `/about` | About Our Two-Acre Venue \| Infinity at Rio Ranch | 47 |
| `/gallery` | Venue Photo Gallery \| Infinity at Rio Ranch | 43 |
| `/contact` | Contact & Venue Tours \| Infinity at Rio Ranch | 45 |

### 3. Structured data

Every page emits a `@graph` containing:

- **`EventVenue` + `LocalBusiness`** (`#venue`) — name, alternate names, full
  `PostalAddress`, both phone numbers, email, `hasMap`, `sameAs` (Instagram),
  indoor `floorSize`, `additionalProperty` for the 2,600 / 12,400 sq ft / 2 acre
  figures, six `amenityFeature` entries, an `OfferCatalog` of the four event
  types, and `areaServed` across Liberty Hill, Austin, Georgetown, Cedar Park,
  Leander, Round Rock and Williamson County.
- **`WebSite`**, **`ImageObject`** (logo), **`BreadcrumbList`**, and a page node
  (`WebPage` / `AboutPage` / `CollectionPage` / `ContactPage`) with
  `SpeakableSpecification` for voice results.
- **`/gallery`** additionally emits `ImageGallery` with all 18 photos as
  `ImageObject` with captions.
- **`/contact`** emits `FAQPage`. It is keyed (`data-seo-id="faq"`) and rebuilt
  on the client from whatever the CMS is actually serving, so the schema can
  never claim answers that differ from the visible ones.

**Deliberately omitted** — adding these without verified values would be
fabricated structured data, which is a manual-action risk:
`geo` (exact lat/long), `priceRange`, `openingHoursSpecification`,
`aggregateRating` / `Review`. See "Still needs a human" below.

### 4. Crawl control

- `robots.txt` is generated at build time so its `Sitemap:` line always matches
  the build's domain. It names fifteen AI crawlers and explicitly **allows**
  them — this venue wants to be quoted when someone asks an assistant for a
  wedding venue near Austin — while keeping `/admin` and `/invoice/` out.
- `sitemap.xml` — 4 URLs with `lastmod`, plus 18 `<image:image>` entries on the
  gallery URL.
- `vercel.json` — `X-Robots-Tag: noindex` headers on `/admin/*` and
  `/invoice/*` (defence in depth; those are token/auth surfaces), security
  headers, and split caching: `/build/*` (hashed bundles) immutable for a year,
  `/assets/*` (the venue's photos) one day with `stale-while-revalidate`.
  Vite now emits bundles to `build/` so the two can be told apart.

> ⚠️ `vercel.json` lists an explicit rewrite per prerendered route *ahead* of the
> SPA catch-all. Without it the catch-all would serve homepage HTML at `/about`.
> `scripts/prerender.mjs` fails the build if a route is missing its rewrite, so
> adding a page to `PUBLIC_ROUTES` will tell you what else to update.

### 5. Images

Every photo that was a CSS `background-image` is now a real `<img>` with
descriptive alt text, `loading="lazy"` and `decoding="async"` — gallery tiles,
the featured gallery shot (eager + `fetchpriority=high`, it's the LCP element),
home-page event cards, Polaroids and the lightbox. Background images cannot be
indexed by Google Images, cannot carry alt text, and cannot be lazy-loaded.

The homepage preloads the first hero slide (`DSC3699-2.jpg`) as its LCP element.

### 7. Image weight — `scripts/optimize-images.mjs`

The photos shipped straight from a camera export: **30.3 MB across 59 files**,
with `wed.jpg` at 2.9 MB and `arch.png` at 2.3 MB. That was the dominant Core
Web Vitals cost — no amount of lazy-loading rescues a 2.9 MB hero.

```bash
npm run optimize:images            # re-encode anything not already done
npm run optimize:images -- --dry   # report only, write nothing
npm run optimize:images -- --force # ignore the manifest, redo everything
```

**30.3 MB → 7.6 MB (−74.9%)**, 41 files re-encoded, all 59 verified to still
decode. Worst offenders: `wed.jpg` 2893 → 422 kB (−85%), `arch.png` 2303 → 347 kB
(−85%), `f11.jpg` 2656 → 518 kB (−80%), `DSC3692.jpg` 1884 → 520 kB (−72%).

Settings, and why:

- **JPEG q78, default 4:2:0 chroma.** 4:4:4 is for text and screenshots; on
  photographs it cost ~50% more bytes for no visible gain (measured: 1072 kB vs
  708 kB on the same frame). Below ~q72 skin tones and sky gradients start
  showing artifacts, which is not a trade a wedding venue should make.
- **1600 px long edge.** Nothing renders wider: the lightbox caps at 1000 px,
  gallery tiles at ~440 px, and the full-bleed hero backgrounds sit under
  0.6–0.9 opacity gradient washes that hide any upscaling.
- **PNGs stay PNG** (palette-quantised, −70–85%). Converting them to JPEG would
  save more, but the `.png` URLs may already be referenced by rows in the
  Supabase `gallery` and `events` tables.

Files are re-encoded **in place**, so every URL, `site.ts` path and CMS row keeps
working. `scripts/image-manifest.json` records each file's post-optimisation hash,
so re-running is a no-op rather than stacking lossy generations on the same
photo — new or edited photos are picked up automatically. It is **not** wired into
`npm run build`, because a lossy encoder in the build path would degrade the same
photo a little more on every deploy. Originals: `git checkout -- public/assets`.

### 6. Content for answer engines

- **FAQ answers now exist in the HTML.** `AccordionContent` uses `forceMount`,
  so collapsed panels stay in the DOM (Radix marks them `hidden`; the page looks
  identical). Before this, the answers were in no HTML at all.
- **"The venue at a glance"** — a flat `<dl>` on `/about` with location, size,
  event types, area served and how to book. Flat key/value facts are the shape
  answer engines and featured snippets extract cleanly.
- **`/gallery` got prose.** It was a photo wall with ~650 characters of text; it
  now opens with an H2 and a paragraph naming each space.
- **Entity clarity** — the homepage and About lead paragraphs now say "Liberty
  Hill, Texas" and "Austin" in the first sentence. Generative engines resolve
  entities from opening sentences.
- **Full NAP in the footer of every page** — the street address, not just
  "Liberty Hill, TX · Greater Austin". Consistent name/address/phone across a
  site is the baseline local-search signal.

### 8. Performance, accessibility, Core Web Vitals

Measured with Lighthouse CLI against the **production build** served as static
files. A score from `npm run dev` is not a measurement — Vite dev ships
unminified modules, no bundling and an HMR client, and scored 30 where the same
code scored 59 built.

| | Before | After |
|---|---|---|
| Performance | 59 | **82** (median of 5: 81, 82, 82, 82, 82) |
| Accessibility | 95 | **100** |
| Best Practices | 96 | **100** |
| SEO | 100 | **100** |
| First Contentful Paint | 3.8 s | **2.3 s** |
| Largest Contentful Paint | 12.2 s | **4.5 s** |
| Total Blocking Time | 260 ms | **21 ms** |
| Cumulative Layout Shift | 0 | **0** |
| Page weight | 2,323 KiB | **1,000 KiB** |

Other routes: about 86, contact 82, gallery 76 — all 100/100/100 on
accessibility, best practices and SEO, with zero console errors.

What actually moved the needle, in order:

1. **Hydrate instead of client-render.** The prerender was being thrown away:
   `createRoot` rebuilt the whole DOM, so the largest element only repainted once
   the bundle had parsed — 89% of a 5.9 s LCP was render delay. Hydration needed
   three things to agree between server and client, and all three are load-bearing:
   scroll-reveal starts revealed (`use-reveal.ts`), the theme store skips
   automatic persist hydration (`store/theme.ts`), and **both entry points render
   the identical `AppShell`** (`components/layout/app-shell.tsx`). Getting that
   last one wrong produced React error #418 and a silent fallback to client
   rendering — which looks fine but costs you the entire benefit. If you touch
   `App.tsx`'s tree, mirror it in `entry-server.tsx`.
2. **Defer the decorative layers.** Film grain, 9 blurred bokeh orbs and 22
   twinkling points animate continuously; the grain is a full-viewport
   `mix-blend-mode` layer that forces the page to re-blend on every repaint.
   Running all of it during first paint cost ~2 s of style/layout. They now mount
   on `requestIdleCallback` via `use-after-paint.ts`, and never for visitors who
   ask for reduced motion.
3. **Self-host the fonts.** The Google Fonts stylesheet blocked first paint for
   ~900 ms. Loading it async instead removed the block but delayed the font swap,
   which *caused* layout shift (CLS 0.28) and held back the text paint. Four
   same-origin variable woff2 files with a preload fixed all three.
4. **Responsive image ladder** (see §7) and hero slides that no longer all load
   at once — the hero shipped 964 kB for one visible photo.
5. **Split Supabase out of the entry bundle** (~200 kB, dynamically imported
   after first paint) and preconnect to its origin, injected from
   `VITE_SUPABASE_URL` by a small Vite plugin.

Four real accessibility bugs were fixed along the way, all pre-existing:
light-theme `--muted` was 4.15:1 (every muted paragraph failed AA), light-theme
`--brass` was 3.63:1 behind white button labels, the hero slide dots were 8 px
touch targets, and the gallery tiles replaced their visible caption with an
`aria-label` (WCAG 2.5.3, label in name).

**Remaining levers**, none of them cheap: ~2 s of style/layout is inherent to the
design (large DOM, full-viewport gradient sections, heavy shadow work), and
~1 s of unused JavaScript sits in the entry chunk — mostly `zod` +
`react-hook-form`, which only the contact form needs. Route-level code splitting
would fix that but would flash a Suspense fallback over prerendered content, so
it's a net loss here.

---

## Result

| Dimension | Before | After |
|---|---|---|
| SEO | 3/10 | 8/10 |
| GEO | 2/10 | 8/10 |
| AEO | 2/10 | 8/10 |

Not 10s — the remaining points are off-site work and content that only the owner
can supply. See below.

---

## Still needs a human

Ordered by impact. None of these are code problems.

1. **Google Business Profile.** For a local venue this outranks everything on
   this page. Claim it, verify the address, add photos and hours. Then paste the
   verified latitude/longitude into `src/lib/seo.ts` (`venueNode`, add a `geo`
   node) and the profile URL into `sameAs`.
2. **Confirm the recompressed photos look right to you.** Done in code (see
   below) but not visually verified by me — open `/gallery` and the homepage
   hero and check nothing looks soft or banded. `git checkout -- public/assets`
   reverts everything if you disagree with the trade-off.
3. **Make the apex redirect permanent.** `infinityrioranch.com` currently
   answers with a **307 (temporary)** to `www.infinityrioranch.com`. A temporary
   redirect tells Google not to consolidate signals onto the www host. Fix in
   Vercel → Settings → Domains: set the apex to a permanent (308) redirect. This
   is a dashboard setting — Vercel's domain layer runs before `vercel.json`
   routes, so it can't be fixed from this repo.
4. **Submit the sitemap** in Google Search Console and Bing Webmaster Tools for
   the `https://www.infinityrioranch.com` property, and request indexing for all
   four URLs. Verify both the www and apex hosts so the redirect is visible to
   Search Console.
5. **Real testimonials.** `src/data/site.ts` still marks the three testimonials
   as placeholder copy. No `Review` or `AggregateRating` schema is emitted,
   because marking up invented reviews is exactly what earns a manual action.
   Once real, attributed reviews exist, add `Review` nodes to `venueNode()`.
6. **A 1200×630 OG card.** Link previews currently use a 1752×1168 venue photo.
   It works; a purpose-made card with the logo works better. Drop it at
   `public/assets/og-card.jpg` and point `OG_IMAGE` at it.
7. **Pricing.** If the owner will publish a starting price, add `priceRange` to
   `venueNode()` — "how much is it" is the single most common query an answer
   engine gets about a venue, and a page that answers it gets cited.
8. **Content depth.** The site has four pages. The highest-value additions, in
   order: a real-weddings blog post per event (long-tail queries), a pricing or
   packages page, and a "planning your day at Infinity" guide. Each is a new
   entry in `PUBLIC_ROUTES` + `ROUTE_META` + `vercel.json`.

---

## Verifying changes

Performance must be measured on the **built** site, never `npm run dev`:

```bash
npm run build && npx serve dist -l 4173
npx lighthouse http://localhost:4173/ --chrome-flags="--headless=new"
```

Take the median of 3–5 runs — single runs vary by 5–10 points. Use `serve` (or
any static server), **not** `npx vite preview`: its SPA fallback returns
`index.html` for every path and hides the per-route prerendered files.

```bash
npm run build              # prerender runs as part of it and fails loudly

# Inspect what a non-JS crawler sees:
cat dist/contact/index.html | grep -o '<title>[^<]*</title>'
node -e "const h=require('fs').readFileSync('dist/index.html','utf8');console.log([...h.matchAll(/application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)].length,'JSON-LD blocks')"
```

`npx vite preview` is **not** a valid check: its SPA fallback serves
`index.html` for every path and hides the per-route files. Read `dist/` directly,
or serve it with a plain static server.

Then, against the deployed URL:

- [Rich Results Test](https://search.google.com/test/rich-results) — the
  `EventVenue` and `FAQPage` blocks.
- [Schema Markup Validator](https://validator.schema.org/) — the full `@graph`.
- [PageSpeed Insights](https://pagespeed.web.dev) — Core Web Vitals.
- `curl -A "GPTBot" https://<domain>/` — confirm the copy is in the response
  body, not just in the JS bundle. This is the check that matters most for GEO.
