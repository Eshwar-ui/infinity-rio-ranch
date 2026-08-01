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

Everything in this section is **generated at build time from `src/lib/seo.ts`**
and written into `dist/` by `scripts/prerender.mjs`. Nothing here belongs in
`public/` — see "The `public/` trap" below, which has bitten this repo once.

- `robots.txt` — its `Sitemap:` line always matches the build's domain. Two
  groups: a `*` default, and 22 named AI crawlers explicitly **allowed** (this
  venue wants to be quoted when someone asks an assistant for a wedding venue
  near Austin), both keeping `/admin` and `/invoice/` out.

  Consecutive `User-agent:` lines share the rule block that follows — that is
  the standard's own grouping mechanism, and it is why the file is 45 lines
  (1.2 kB) rather than the 130 lines (2.5 kB) it takes to repeat the rules once
  per bot. Same coverage, half the bytes, one place to change a rule.

  The named group is currently **identical** to the `*` group, so it changes no
  crawler's behaviour today. It earns its place because it is a legible public
  statement of intent, and because `Google-Extended` and `Applebot-Extended` are
  opt-*out* controls where naming them is how you opt in. If the owner ever
  wants to exclude one engine, that group is where it splits.

  > ⚠️ Both groups carry the **full** rule set, and that is not redundant. A
  > crawler obeys only the most specific `User-agent` group matching it and
  > ignores `User-agent: *` **entirely**. A named group with a bare `Allow: /`
  > therefore *grants* that bot `/admin` and `/invoice/`. `CRAWL_RULES` is
  > defined once and spread into both groups so they cannot drift. Add bots to
  > the `AI_CRAWLERS` array; never hand-write a group.

- `sitemap.xml` — 4 URLs with a truthful `lastmod` and 27 `<image:image>`
  entries across all four (6 home / 2 about / 18 gallery / 1 contact).

  **`changefreq` and `priority` are deliberately not emitted.** Google has
  stated it ignores both, and `priority` is self-assigned — every site on earth
  claims `1.0` for its homepage, so the field carries no information. Dropping
  them is removing noise, not capability.

  **`lastmod` comes from git, not the clock.** It is the date of the last commit
  touching the files that compose each route (the page component plus
  `src/data/site.ts`, `src/lib/seo.ts` and the shared layout/section
  components). Stamping today's date on every URL at every deploy is a lie, and
  Google's documented response to a `lastmod` it cannot trust is to ignore the
  field **site-wide**. If git can't answer — CI often checks out shallow — the
  field is omitted for that URL and the build logs a warning. An absent
  `lastmod` costs nothing; a wrong one costs the signal.

  Two honest limitations:
  - It is **coarse**. `src/lib/seo.ts` and `src/data/site.ts` are shared by
    every route, so touching either moves all four dates together. That is a
    false positive when the edit only changed, say, `robotsTxt()`. It's the
    lesser evil: excluding those files would mean a title or description change
    *didn't* bump `lastmod`, and a false negative — Google not recrawling a page
    that really did change — is worse than a slightly eager one.
  - It tracks the **code, not the copy**. Published CMS content lives in
    Supabase and is fetched at runtime, so an edit made in `/admin` changes what
    visitors see without changing any file git can see. `lastmod` therefore
    reflects template changes, not content edits.
- `404.html` — a real, branded 404 (`noindex, follow`, no canonical, no JSON-LD)
  rendered from the same React tree as every other route. See "Soft 404s" below.
- `llms.txt`, `llms-full.txt`, `facts.json` — plain-text and JSON summaries for
  answer engines, built from the same constants as the JSON-LD so they cannot
  drift. `llms.txt` follows the [llmstxt.org](https://llmstxt.org) convention (an
  H1, a blockquote summary, curated links); `llms-full.txt` is the whole site as
  flat prose with the FAQ verbatim; `facts.json` is the numbers that get quoted
  most (square footage, address, phones).

  These are **belt-and-braces, not the mechanism.** No major engine honours the
  llms.txt convention yet — the prerendered HTML is what actually gets read
  today. They cost ~9 kB total and stay in sync for free, which is the only
  reason they're worth having. Don't let their presence justify letting the HTML
  rot.
- `vercel.json` — `X-Robots-Tag: noindex` headers on `/admin/*` and
  `/invoice/*` (defence in depth; those are token/auth surfaces), security
  headers, and split caching: `/build/*` (hashed bundles) immutable for a year,
  `/assets/*` (the venue's photos) one day with `stale-while-revalidate`.
  Vite now emits bundles to `build/` so the two can be told apart.

> ⚠️ `vercel.json` lists an explicit rewrite per prerendered route, plus
> SPA rewrites for `/admin` and `/invoice/`. There is deliberately **no**
> catch-all. `scripts/prerender.mjs` fails the build if a route is missing its
> rewrite, if the SPA rewrites go missing, **or if a catch-all reappears**.

#### Soft 404s — why there is no catch-all

`vercel.json` used to end with `{ "source": "/(.*)", "destination":
"/index.html" }`. That meant **every** URL that matched nothing returned `200`
with the homepage's full HTML:

```
/llms.txt                 200  text/html
/facts.json               200  text/html
/this-page-does-not-exist 200  text/html
```

An unbounded set of URLs each serving a complete, indexable copy of the
homepage — Google's definition of a soft 404. It wastes crawl budget, and the
client router had no `*` route either, so a human landing there got a **blank
page** after the JS booted.

Now the rewrites cover only the prerendered routes and the two SPA branches, so
anything else falls through to `dist/404.html` and returns a real `404`.
`NOT_FOUND_ROUTE` is deliberately **not** in `PUBLIC_ROUTES`: it must never
reach the sitemap, and it must never get a rewrite — a rewrite is exactly what
would turn it back into a 200.

`App.tsx` and `entry-server.tsx` both route `path="*"` to `NotFoundPage`, so the
prerendered 404 hydrates cleanly instead of falling back to client rendering.

#### The `public/` trap

`public/robots.txt` and `public/sitemap.xml` once existed alongside the
generated ones. **They never shipped.** Vite copies `public/` into `dist/`, then
`scripts/prerender.mjs` runs and overwrites both files — so hand-edits there are
silently discarded, while looking authoritative in the editor. They were also
wrong: the hand-written robots.txt named ~25 bots with a bare `Allow: /` and no
`Disallow`, which (see the warning above) would have opened `/admin` and
`/invoice/` to every one of them.

Both files are deleted. If you want to change robots or the sitemap, change
`src/lib/seo.ts`. `public/_redirects` is Netlify-only and inert on Vercel; it is
kept in sync purely so a platform move doesn't lose the rules.

### 5. Images

Every photo that was a CSS `background-image` is now a real `<img>` with
descriptive alt text, `loading="lazy"` and `decoding="async"` — gallery tiles,
the featured gallery shot (eager + `fetchpriority=high`, it's the LCP element),
home-page event cards, Polaroids and the lightbox. Background images cannot be
indexed by Google Images, cannot carry alt text, and cannot be lazy-loaded.

The homepage preloads the first hero slide (`DSC3699-2.jpg`) as its LCP element.

> ⚠️ **`PageHero` is the exception, and the claim above overstated things.**
> `src/components/layout/page-hero.tsx` still paints its photo with
> `style={{ backgroundImage: url(...) }}`, so the hero images on `/about`
> (`venue-06`), `/gallery` and `/contact` (`venue-01`) carry no alt text and
> cannot be indexed by Google Images. They are excluded from the image sitemap
> on purpose — declaring an image the crawler can't see is a claim it can't
> verify. Converting `PageHero` to a positioned `<img>` with
> `object-fit: cover` would look identical, add three indexable photos and let
> the hero take `fetchpriority="high"` (it is the LCP element on those routes).
> Not done here: it is a visual-component change and belongs in its own pass.

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

### 5b. CMS content actually reaches crawlers

For a while it didn't. `scripts/prerender.mjs` renders the real React tree, but
effects never run during SSR — so every hook that fetched its rows in a
`useEffect` contributed **nothing** to `dist/`. Testimonials, events, FAQs and
gallery captions were edited in the admin panel, changed in the browser, and
left the prerendered HTML frozen at the hardcoded `site.ts` values that every
non-JS crawler reads.

The fix is a build-time snapshot. `npm run pull:content` runs first in `build`,
reads the published rows over PostgREST with the anon key, and writes
`src/data/content.generated.json` (committed, so builds work offline).
`src/lib/content-snapshot.ts` layers it over the shipped defaults and is
hook-free on purpose, so this file and the prerenderer can read it at module
scope. Everything downstream — visible copy, `FAQPage`, `PostalAddress`,
`sitemap.xml`, `llms.txt`, `facts.json` — resolves from that one object, which
is why the address in the footer and the address in the JSON-LD can no longer
disagree.

**Publishing is therefore a rebuild.** Saving in the admin panel is instant for
human visitors and invisible to answer engines until a deploy runs. The
"Publish to live site" button in the admin sidebar POSTs a Vercel deploy hook
(stored in the admin-only `site_settings` table) to close that gap.

**Watch out:** anything the CMS can delete must not be read positionally.
`glanceFacts` used `stats[0]`/`stats[1]`/`stats[2]`, so removing one statistic
threw during prerender — and the prerender step fails the build by design.

### 6. Content for answer engines

- **FAQ answers now exist in the HTML.** `AccordionContent` uses `forceMount`,
  so collapsed panels stay in the DOM. Before this, the answers were in no HTML
  at all. Note that `forceMount` does **not** leave Radix's own hiding intact —
  it pins the panel "present", so Radix never applies `hidden` and every answer
  renders expanded. `AccordionContent` therefore collapses closed panels itself,
  off `data-state`, with a grid-template-rows transition; see the comment there
  before changing it.
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

#### Google Tag Manager is loaded after first paint, on purpose

GTM (`GTM-PXBN6P5J`) lives in `index.html`, below the font/LCP preloads so those
requests are queued first. Marking the injected script `async` stops it blocking
the *parser*, but not from executing on the main thread while the page is still
painting. Measured on the built site, Lighthouse median of 3, same machine:

| | eager | deferred | no GTM at all |
|---|---|---|---|
| Performance | 72 | **76** | 76 |
| Total Blocking Time | 240 ms | **152 ms** | 8 ms |
| FCP / LCP | unchanged | unchanged | unchanged |

The entire cost was main-thread execution — i.e. the TBT/INP budget, not paint.
Deferring recovers the full 4 points. TBT lands at 152 ms rather than 8 ms
because GTM still runs on idle *inside* the trace window; that's the trade-off,
and it's the right one. Loading only on interaction would zero it out but would
never record a visitor who bounces without touching the page.

Loading starts at whichever comes first: first interaction (`pointerdown`,
`keydown`, `touchstart`, `scroll`), `requestIdleCallback` after `load`, or a 3 s
backstop. `dataLayer` is still created synchronously, so anything pushed before
GTM arrives is queued and replayed — nothing is lost. To revert to eager
loading, call `start()` directly instead of scheduling it.

> GTM also loads on `/admin` and `/invoice/<token>`, which share the same shell.
> The invoice token is the secret that grants access to that invoice, and it
> reaches GA as part of `page_location`. If that matters, gate the snippet on
> `location.pathname`.

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
   this page. Claim it, verify the address, add photos and hours. Then put the
   profile URL into `sameAs`.

2. **Verified lat/long — one line, already wired up.** `venueGeo()` in
   `src/lib/seo.ts` returns `null`; return a `GeoPoint` and `venueNode()` emits
   a `geo` node automatically. Get the value from Google Maps: find the venue's
   own pin, right-click it, and the first menu item is the coordinates.

   It is null because **326 Rio Pk Dr does not geocode.** OpenStreetMap has no
   record of the street; the only match for the address is the Liberty Hill town
   centroid (30.6649, -97.9225), which is the town square, not this venue.
   Publishing that would put the business at the wrong point on every map
   surface that trusts the markup — worse than publishing nothing. This one
   genuinely needs a human with a map.
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

**Status codes can only be verified against the deployed site.** `npx serve` and
`vite preview` both have their own SPA fallback and will return `200` for
unknown paths regardless of what `vercel.json` says. After deploying:

```bash
# must be 404 — anything else means a catch-all rewrite came back
curl -o /dev/null -s -w '%{http_code}\n' https://www.infinityrioranch.com/no-such-page

# must be 200, and must not be HTML
curl -sI https://www.infinityrioranch.com/llms.txt | grep -i content-type

# must still be 200 (the SPA rewrites)
curl -o /dev/null -s -w '%{http_code}\n' https://www.infinityrioranch.com/admin/login
```
