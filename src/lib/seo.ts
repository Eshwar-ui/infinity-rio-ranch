/**
 * Single source of truth for every SEO / AEO / GEO signal the site emits.
 *
 * Used twice:
 *  - at build time by `src/entry-server.tsx` + `scripts/prerender.mjs`, which
 *    bake the tags into static HTML so crawlers that don't run JS (GPTBot,
 *    ClaudeBot, PerplexityBot, most social scrapers) see a complete <head>;
 *  - at runtime by `useDocumentHead()`, which re-applies them on client-side
 *    route changes.
 *
 * Both paths read the same builders below, so the two can never drift.
 */

import {
  amenities,
  contact,
  eventTypes,
  events,
  faqs,
  gallery,
  included,
  stats,
  venueImg,
} from '@/data/site'

/* ------------------------------------------------------------------ */
/* Site constants                                                      */
/* ------------------------------------------------------------------ */

/**
 * The live canonical host is www — the apex (infinityrioranch.com) redirects to
 * it, so every canonical, OG URL and sitemap entry must use www or they'd point
 * at a redirect. The vercel.app URL still resolves; the canonicals below are
 * what stop it being indexed as duplicate content.
 */
const rawSiteUrl =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SITE_URL) ||
  'https://www.infinityrioranch.com'

/** Absolute origin, no trailing slash. Override with VITE_SITE_URL. */
export const SITE_URL = String(rawSiteUrl).replace(/\/+$/, '')

/** Absolute URL for a site-relative path. */
export const abs = (path: string) =>
  path.startsWith('http') ? path : `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`

export const BRAND = 'Infinity at Rio Ranch'
export const LEGAL_NAME = 'Infinity Weddings & Events'

/** Every indexable public route. Drives prerendering and the sitemap. */
export const PUBLIC_ROUTES = ['/', '/about', '/gallery', '/contact'] as const
export type PublicRoute = (typeof PUBLIC_ROUTES)[number]

/**
 * Rendered to `dist/404.html`, which Vercel serves — with a real 404 status —
 * for any path that matches no static file and no rewrite.
 *
 * Deliberately *not* in PUBLIC_ROUTES: it must never reach the sitemap, and
 * `assertRewritesCoverRoutes` must not demand a rewrite for it (a rewrite is
 * exactly what would turn it back into a 200).
 */
export const NOT_FOUND_ROUTE = '/404'

/**
 * Social / link-preview card. 1752x1168 is the real size of this photo — the
 * dimensions must be truthful or scrapers fall back to guessing.
 */
const OG_IMAGE = {
  url: '/assets/site/DSC3669-2.jpg',
  width: 1752,
  height: 1168,
  alt: 'The reception hall at Infinity at Rio Ranch set for a wedding',
}

const ADDRESS = {
  street: '326 Rio Pk Dr',
  city: 'Liberty Hill',
  region: 'TX',
  postalCode: '78642',
  country: 'US',
}

/**
 * Verified coordinates for the venue, or `null`.
 *
 * ── TO ENABLE ────────────────────────────────────────────────────────────────
 * Open Google Maps, find the venue's own pin (not the street, not the town),
 * right-click it → the first item in the menu is the lat/long → return it here:
 *
 *     const venueGeo = (): GeoPoint => ({ latitude: 30.xxxxxx, longitude: -97.xxxxxx })
 *
 * That is all — `venueNode()` picks it up and emits a `geo` node automatically.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * It is null because 326 Rio Pk Dr does not resolve in OpenStreetMap; the only
 * match for the address is the Liberty Hill *town centroid* (30.6649, -97.9225),
 * which is roughly the town square, not this venue. Publishing that would place
 * the business at the wrong point on every map surface that trusts the markup —
 * worse than publishing nothing, and a fabricated-data risk. A guess here is not
 * a small guess.
 */
type GeoPoint = { latitude: number; longitude: number }

const venueGeo = (): GeoPoint | null => null

/** Towns we realistically serve — helps local + AI "near me" retrieval. */
const AREA_SERVED = [
  'Liberty Hill, TX',
  'Austin, TX',
  'Georgetown, TX',
  'Cedar Park, TX',
  'Leander, TX',
  'Round Rock, TX',
  'Williamson County, TX',
]

const VENUE_DESCRIPTION =
  'Infinity at Rio Ranch is a two-acre wedding and event venue in Liberty Hill, Texas, in the Greater Austin area. It pairs a 2,600 sq ft climate-controlled indoor hall with 12,400 sq ft of outdoor grounds, a private bridal suite and a string-lit terrace, and hosts weddings, corporate events, cultural and community gatherings, birthdays and anniversaries.'

/* ------------------------------------------------------------------ */
/* Per-route metadata                                                  */
/* ------------------------------------------------------------------ */

type RouteMeta = {
  title: string
  description: string
  /** Breadcrumb label; omitted on the homepage. */
  crumb?: string
  image?: typeof OG_IMAGE
}

const ROUTE_META: Record<string, RouteMeta> = {
  '/': {
    title: 'Wedding & Event Venue near Austin | Infinity at Rio Ranch',
    description:
      'Infinity at Rio Ranch is a two-acre wedding and event venue in Liberty Hill, TX, near Austin — 2,600 sq ft indoors, 12,400 sq ft outdoors. Book a tour today.',
  },
  '/about': {
    title: 'About Our Two-Acre Venue | Infinity at Rio Ranch',
    crumb: 'About',
    description:
      'Two acres of rustic elegance in Liberty Hill, TX: a 2,600 sq ft indoor hall, 12,400 sq ft of grounds, a bridal suite, string-lit terrace and everything included.',
    image: {
      url: '/assets/site/f11.jpg',
      width: 1200,
      height: 1358,
      alt: 'Golden-hour portraits on the grounds at Infinity at Rio Ranch',
    },
  },
  '/gallery': {
    title: 'Venue Photo Gallery | Infinity at Rio Ranch',
    crumb: 'Gallery',
    description:
      'Browse real weddings and events at Infinity at Rio Ranch in Liberty Hill, TX — ceremony lawn, reception hall, string-lit terrace, bridal suite and outdoor grounds.',
    image: {
      url: '/assets/site/wed.jpg',
      width: 1200,
      height: 1800,
      alt: 'A wedding ceremony on the lawn at Infinity at Rio Ranch',
    },
  },
  '/contact': {
    title: 'Contact & Venue Tours | Infinity at Rio Ranch',
    crumb: 'Contact',
    description:
      'Check your date at Infinity at Rio Ranch, 326 Rio Pk Dr, Liberty Hill, TX 78642. Send an inquiry or call (512) 630-2236 — we reply within one business day.',
  },
}

/** Routes that must never be indexed (token/auth surfaces). */
const isPrivateRoute = (pathname: string) =>
  pathname.startsWith('/admin') || pathname.startsWith('/invoice')

/* ------------------------------------------------------------------ */
/* Structured data (JSON-LD)                                           */
/* ------------------------------------------------------------------ */

const VENUE_ID = `${SITE_URL}/#venue`
const WEBSITE_ID = `${SITE_URL}/#website`
const LOGO_ID = `${SITE_URL}/#logo`

/**
 * The venue entity. Typed as both EventVenue and LocalBusiness so map/local
 * surfaces and AI answer engines both resolve it to one real-world place.
 *
 * Deliberately omitted until the owner supplies verified values:
 * `geo` (exact lat/long), `priceRange`, `openingHoursSpecification`,
 * `aggregateRating`. Guessing any of them is fabricated structured data.
 */
const venueNode = () => ({
  '@type': ['EventVenue', 'LocalBusiness'],
  '@id': VENUE_ID,
  name: BRAND,
  alternateName: [LEGAL_NAME, 'Infinity Rio Ranch'],
  url: `${SITE_URL}/`,
  description: VENUE_DESCRIPTION,
  slogan: 'Where Endless Celebrations Begin',
  logo: { '@id': LOGO_ID },
  image: [
    abs(OG_IMAGE.url),
    abs('/assets/site/wed.jpg'),
    abs('/assets/site/DSC3705.jpg'),
    abs('/assets/site/arch.png'),
  ],
  telephone: contact.phones.map((p) => p),
  email: contact.email,
  address: {
    '@type': 'PostalAddress',
    streetAddress: ADDRESS.street,
    addressLocality: ADDRESS.city,
    addressRegion: ADDRESS.region,
    postalCode: ADDRESS.postalCode,
    addressCountry: ADDRESS.country,
  },
  hasMap: contact.mapUrl,
  // Emitted only once a human has verified the pin — see venueGeo().
  ...(() => {
    const geo = venueGeo()
    return geo ? { geo: { '@type': 'GeoCoordinates', ...geo } } : {}
  })(),
  areaServed: AREA_SERVED.map((name) => ({ '@type': 'Place', name })),
  sameAs: [contact.instagram],
  currenciesAccepted: 'USD',
  /* Indoor hall — the only floor area with a verified square footage. */
  floorSize: { '@type': 'QuantitativeValue', value: 2600, unitCode: 'FTK' },
  additionalProperty: [
    { '@type': 'PropertyValue', name: 'Indoor space', value: '2,600 sq ft' },
    { '@type': 'PropertyValue', name: 'Outdoor space', value: '12,400 sq ft' },
    { '@type': 'PropertyValue', name: 'Total grounds', value: '2 acres' },
  ],
  amenityFeature: amenities.map((a) => ({
    '@type': 'LocationFeatureSpecification',
    name: a.title,
    description: a.sub,
    value: true,
  })),
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Events hosted at Infinity at Rio Ranch',
    itemListElement: events.map((e) => ({
      '@type': 'Offer',
      itemOffered: {
        '@type': 'Service',
        name: `${e.title} venue rental`,
        description: e.blurb,
        serviceType: e.title,
        areaServed: { '@type': 'Place', name: 'Greater Austin, TX' },
        provider: { '@id': VENUE_ID },
      },
    })),
  },
  knowsAbout: [...eventTypes],
  makesOffer: included.map((item) => ({
    '@type': 'Offer',
    itemOffered: { '@type': 'Service', name: item },
  })),
})

const websiteNode = () => ({
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  url: `${SITE_URL}/`,
  name: BRAND,
  description: VENUE_DESCRIPTION,
  inLanguage: 'en-US',
  publisher: { '@id': VENUE_ID },
})

const logoNode = () => ({
  '@type': 'ImageObject',
  '@id': LOGO_ID,
  url: abs('/assets/logo.png'),
  contentUrl: abs('/assets/logo.png'),
  width: 834,
  height: 834,
  caption: BRAND,
})

const breadcrumbNode = (pathname: string, crumb?: string) => ({
  '@type': 'BreadcrumbList',
  '@id': `${abs(pathname)}#breadcrumb`,
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
    ...(crumb
      ? [{ '@type': 'ListItem', position: 2, name: crumb, item: abs(pathname) }]
      : []),
  ],
})

/** Element key for the FAQ block, shared by the prerenderer and the runtime hook. */
export const FAQ_JSONLD_ID = 'faq'

/** FAQPage node — exported so the contact page can refresh it from live CMS data. */
export const faqPageNode = (list: { q: string; a: string }[] = [...faqs]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  '@id': `${abs('/contact')}#faq`,
  mainEntity: list.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
})

const pageTypeFor = (pathname: string) =>
  pathname === '/about'
    ? 'AboutPage'
    : pathname === '/contact'
      ? 'ContactPage'
      : pathname === '/gallery'
        ? 'CollectionPage'
        : 'WebPage'

const galleryNodes = () => [
  {
    '@type': 'ImageGallery',
    '@id': `${abs('/gallery')}#gallery`,
    name: `${BRAND} photo gallery`,
    description: ROUTE_META['/gallery'].description,
    about: { '@id': VENUE_ID },
    associatedMedia: gallery.map((g) => ({
      '@type': 'ImageObject',
      contentUrl: abs(g.src),
      name: g.label,
      caption: `${g.label} — ${BRAND}, Liberty Hill, TX`,
      representativeOfPage: false,
    })),
  },
]

/**
 * Voice-assistant hint: which parts of the page are worth reading aloud.
 * Applied to the h1 + the lead paragraph on every page.
 */
const speakable = {
  '@type': 'SpeakableSpecification',
  cssSelector: ['h1', 'main p'],
}

const jsonLdFor = (pathname: string, meta: RouteMeta) => {
  const url = abs(pathname)
  const image = meta.image ?? OG_IMAGE

  const graph: Record<string, unknown>[] = [
    logoNode(),
    venueNode(),
    websiteNode(),
    breadcrumbNode(pathname, meta.crumb),
    {
      '@type': pageTypeFor(pathname),
      '@id': `${url}#webpage`,
      url,
      name: meta.title,
      description: meta.description,
      inLanguage: 'en-US',
      isPartOf: { '@id': WEBSITE_ID },
      about: { '@id': VENUE_ID },
      primaryImageOfPage: { '@type': 'ImageObject', url: abs(image.url) },
      breadcrumb: { '@id': `${url}#breadcrumb` },
      speakable,
    },
  ]

  if (pathname === '/gallery') graph.push(...galleryNodes())

  const docs: JsonLdDoc[] = [
    { doc: { '@context': 'https://schema.org', '@graph': graph } },
  ]
  // Keyed so the contact page can rewrite it from live CMS answers without
  // ending up with two FAQPage blocks on the same URL.
  if (pathname === '/contact') docs.push({ id: FAQ_JSONLD_ID, doc: faqPageNode() })
  return docs
}

/* ------------------------------------------------------------------ */
/* Head model                                                          */
/* ------------------------------------------------------------------ */

/** `id` marks a block that a page owns and may rewrite at runtime. */
export type JsonLdDoc = { id?: string; doc: unknown }

export type HeadModel = {
  title: string
  description: string
  canonical: string
  robots: string
  metaName: Record<string, string>
  metaProperty: Record<string, string>
  jsonLd: JsonLdDoc[]
}

/** Everything the <head> needs for a given pathname. */
export const buildHead = (pathnameRaw: string): HeadModel => {
  // Normalise: strip query/hash, drop trailing slash (except root).
  const pathname =
    (pathnameRaw.split(/[?#]/)[0] || '/').replace(/(.+)\/$/, '$1') || '/'

  if (isPrivateRoute(pathname)) {
    return {
      title: `${BRAND}`,
      description: '',
      canonical: abs(pathname),
      robots: 'noindex, nofollow',
      metaName: { robots: 'noindex, nofollow' },
      metaProperty: {},
      jsonLd: [],
    }
  }

  /*
   * 404.html is served at whatever URL the visitor mistyped, so it gets no
   * canonical (there is no correct URL to point at) and no JSON-LD (there is no
   * entity on this page). `follow` keeps the nav links crawlable so the crawler
   * can find its way back to the real pages.
   */
  if (pathname === NOT_FOUND_ROUTE) {
    const robots404 = 'noindex, follow'
    return {
      title: `Page not found | ${BRAND}`,
      description: `That page doesn't exist. Browse ${BRAND} in Liberty Hill, TX — venue details, photo gallery and tour bookings.`,
      canonical: '',
      robots: robots404,
      metaName: { robots: robots404, 'theme-color': '#0c0a07' },
      metaProperty: {},
      jsonLd: [],
    }
  }

  const meta = ROUTE_META[pathname] ?? ROUTE_META['/']
  const image = meta.image ?? OG_IMAGE
  const canonical = pathname === '/' ? `${SITE_URL}/` : abs(pathname)
  const robots =
    'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1'

  return {
    title: meta.title,
    description: meta.description,
    canonical,
    robots,
    metaName: {
      description: meta.description,
      robots,
      'theme-color': '#0c0a07',
      // Local pack / map surfaces read these legacy hints.
      'geo.region': 'US-TX',
      'geo.placename': `${ADDRESS.city}, ${ADDRESS.region}`,
      'twitter:card': 'summary_large_image',
      'twitter:title': meta.title,
      'twitter:description': meta.description,
      'twitter:image': abs(image.url),
      'twitter:image:alt': image.alt,
    },
    metaProperty: {
      // 'website' on every page: none of these are timestamped articles, and a
      // wrong og:type makes scrapers hunt for publish dates that don't exist.
      'og:type': 'website',
      'og:site_name': BRAND,
      'og:locale': 'en_US',
      'og:title': meta.title,
      'og:description': meta.description,
      'og:url': canonical,
      'og:image': abs(image.url),
      'og:image:width': String(image.width),
      'og:image:height': String(image.height),
      'og:image:alt': image.alt,
      'business:contact_data:street_address': ADDRESS.street,
      'business:contact_data:locality': ADDRESS.city,
      'business:contact_data:region': ADDRESS.region,
      'business:contact_data:postal_code': ADDRESS.postalCode,
      'business:contact_data:country_name': 'USA',
      'business:contact_data:phone_number': contact.phones[0],
    },
    jsonLd: jsonLdFor(pathname, meta),
  }
}

/* ------------------------------------------------------------------ */
/* Serialisation (build-time / prerender)                              */
/* ------------------------------------------------------------------ */

const escapeAttr = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** `</script>` inside JSON-LD would close the tag early. */
const escapeJsonLd = (value: unknown) =>
  JSON.stringify(value).replace(/</g, '\\u003c')

/** Renders a HeadModel to the raw HTML injected by the prerenderer. */
export const renderHeadTags = (head: HeadModel): string => {
  const lines = [
    `<title>${escapeAttr(head.title)}</title>`,
    // 404.html has no canonical — see buildHead.
    ...(head.canonical
      ? [`<link rel="canonical" href="${escapeAttr(head.canonical)}" />`]
      : []),
    ...Object.entries(head.metaName).map(
      ([name, content]) =>
        `<meta name="${escapeAttr(name)}" content="${escapeAttr(content)}" />`,
    ),
    ...Object.entries(head.metaProperty).map(
      ([property, content]) =>
        `<meta property="${escapeAttr(property)}" content="${escapeAttr(content)}" />`,
    ),
    ...head.jsonLd.map(
      ({ id, doc }) =>
        `<script type="application/ld+json" ${
          id ? `data-seo-id="${escapeAttr(id)}"` : 'data-seo="jsonld"'
        }>${escapeJsonLd(doc)}</script>`,
    ),
  ]
  return lines.join('\n    ')
}

/* ------------------------------------------------------------------ */
/* Sitemap + robots (consumed by scripts/prerender.mjs)                */
/* ------------------------------------------------------------------ */

export type SitemapEntry = {
  /** The route itself, so the prerenderer doesn't have to pair by array index. */
  route: string
  loc: string
  images: { loc: string; title: string }[]
}

/**
 * Images to declare per route.
 *
 * These must be photos the page renders as a real `<img>`. A CSS
 * `background-image` is not crawlable, so listing one is a claim Google cannot
 * verify. That rules out every `PageHero` photo (`page-hero.tsx` still paints
 * its image via `style={{ backgroundImage }}`) — the hero shots on /about,
 * /gallery and /contact are therefore absent here on purpose.
 */
const routeImages = (route: string): { src: string; title: string }[] => {
  const tag = (label: string) => `${label} — ${BRAND}, ${ADDRESS.city}, ${ADDRESS.region}`

  switch (route) {
    case '/':
      return [
        { src: '/assets/site/wed.jpg', title: tag('Wedding ceremony on the lawn') },
        { src: '/assets/site/DSC3669-2.jpg', title: tag('The grand reception hall') },
        ...events.map((e) => ({ src: e.image, title: tag(e.title) })),
      ]
    case '/about':
      return [
        { src: '/assets/site/f11.jpg', title: tag('Golden-hour portraits on the grounds') },
        { src: venueImg(11), title: tag('The outdoor cocktail garden') },
      ]
    case '/gallery':
      return gallery.map((g) => ({ src: g.src, title: tag(g.label) }))
    case '/contact':
      return [{ src: '/assets/site/DSC3699-Edit-2.jpg', title: tag('Candlelit reception tables') }]
    default:
      return []
  }
}

/**
 * One entry per indexable route.
 *
 * `changefreq` and `priority` are deliberately **not** emitted. Google has
 * stated publicly that it ignores both, and `priority` in particular is
 * self-assigned — every site claims 1.0 for its homepage, so it carries no
 * information. Omitting them is not a downgrade; it is removing noise.
 *
 * `lastmod` is not set here either. It is filled in by scripts/prerender.mjs
 * from each route's real git history, because a `lastmod` of "today" on every
 * URL at every deploy is a lie that gets the signal ignored site-wide.
 */
export const sitemapEntries = (): SitemapEntry[] =>
  PUBLIC_ROUTES.map((route) => ({
    route,
    loc: route === '/' ? `${SITE_URL}/` : abs(route),
    images: routeImages(route).map((img) => ({ loc: abs(img.src), title: img.title })),
  }))

/**
 * robots.txt written into dist at build time so the Sitemap line always points
 * at the domain the build was made for.
 *
 * AI crawlers are named explicitly and allowed: this is a venue that *wants* to
 * be quoted by ChatGPT / Perplexity / AI Overviews when someone asks for a
 * wedding venue near Austin. Admin and invoice URLs stay out of every index.
 *
 * ⚠️ Every named group repeats the Disallow lines, and that is not redundant.
 * A crawler obeys **only** the most specific `User-agent` group that matches it
 * and ignores `User-agent: *` entirely. Naming a bot with a bare `Allow: /` —
 * which is what a hand-written robots.txt usually ends up doing — therefore
 * *grants* it `/admin` and `/invoice/`. Add bots to the list below; don't
 * hand-write groups.
 */
const AI_CRAWLERS = [
  // OpenAI — training, live retrieval, and user-initiated fetches.
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  // Anthropic
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'anthropic-ai',
  // Perplexity
  'PerplexityBot',
  'Perplexity-User',
  // Google Gemini / AI Overviews. Opt-out by default — naming it is the opt-IN.
  'Google-Extended',
  // Apple. Applebot-Extended is likewise an explicit opt-in for Apple Intelligence.
  'Applebot',
  'Applebot-Extended',
  // Microsoft Copilot
  'Bingbot',
  // DuckDuckGo
  'DuckAssistBot',
  'DuckDuckBot',
  // Meta AI
  'meta-externalagent',
  'Meta-ExternalFetcher',
  // Others feeding answer engines and training corpora
  'Amazonbot',
  'CCBot',
  'cohere-ai',
  'MistralAI-User',
  'YouBot',
]

/** The one rule set every group shares. Defined once so groups cannot drift. */
const CRAWL_RULES = ['Allow: /', 'Disallow: /admin', 'Disallow: /admin/', 'Disallow: /invoice/']

/**
 * Consecutive `User-agent:` lines share the rule block that follows them — that
 * is the standard's own grouping mechanism, and it is why this file is ~40
 * lines instead of the ~130 it takes to repeat the rules per bot.
 *
 * The named AI group is currently **identical** to the `*` group, so it changes
 * no crawler's behaviour today. It earns its place for two reasons: it is a
 * legible public statement that this venue wants to be cited, and
 * `Google-Extended` / `Applebot-Extended` are opt-out controls where naming
 * them is the explicit opt-in. If the owner ever wants to exclude one engine,
 * this is where it splits.
 *
 * ⚠️ A crawler obeys only the most specific group matching it and ignores
 * `User-agent: *` entirely — so any named group MUST carry the full rule set.
 * That is what CRAWL_RULES guarantees. Never hand-write a group.
 */
export const robotsTxt = () =>
  [
    `# ${SITE_URL}/robots.txt`,
    '# Generated at build time from src/lib/seo.ts — do not hand-edit, and never',
    '# put a copy in public/ (it is silently overwritten). See SEO.md.',
    '',
    '# Default for every crawler.',
    'User-agent: *',
    ...CRAWL_RULES,
    '',
    '# Answer engines and AI crawlers — explicitly welcome to read and cite.',
    ...AI_CRAWLERS.map((bot) => `User-agent: ${bot}`),
    ...CRAWL_RULES,
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
    '# Plain-text summaries for LLMs (llmstxt.org convention).',
    `# ${SITE_URL}/llms.txt`,
    `# ${SITE_URL}/llms-full.txt`,
    '',
  ].join('\n')

/* ------------------------------------------------------------------ */
/* llms.txt / llms-full.txt (consumed by scripts/prerender.mjs)        */
/* ------------------------------------------------------------------ */

/**
 * `llms.txt` — the llmstxt.org convention: an H1, a blockquote summary, then
 * curated links. It is a *map*, not the content.
 *
 * This is belt-and-braces, not the main GEO mechanism. The prerendered HTML is
 * what every crawler actually reads today; the convention is not yet honoured
 * by any major engine. It costs ~1 kB and is trivially generated from the same
 * constants as everything else, so it stays in sync for free — but do not
 * mistake it for a substitute for real HTML.
 */
export const llmsTxt = () =>
  [
    `# ${BRAND}`,
    '',
    `> ${VENUE_DESCRIPTION}`,
    '',
    `${BRAND} (also trading as ${LEGAL_NAME}) is located at ` +
      `${ADDRESS.street}, ${ADDRESS.city}, ${ADDRESS.region} ${ADDRESS.postalCode}, USA. ` +
      `Bookings and tours: ${contact.phones[0]} or ${contact.email}.`,
    '',
    '## Pages',
    '',
    ...PUBLIC_ROUTES.map((route) => {
      const meta = ROUTE_META[route]
      const loc = route === '/' ? `${SITE_URL}/` : abs(route)
      return `- [${meta.title.split('|')[0].trim()}](${loc}): ${meta.description}`
    }),
    '',
    '## Key facts',
    '',
    `- Venue type: wedding and event venue (${eventTypes.join(', ')})`,
    `- Location: ${ADDRESS.city}, ${ADDRESS.region} — Greater Austin, Williamson County`,
    `- Grounds: 2 acres total — 2,600 sq ft indoor hall, 12,400 sq ft outdoor space`,
    `- Areas served: ${AREA_SERVED.join(', ')}`,
    `- Amenities: ${amenities.map((a) => a.title).join(', ')}`,
    `- Phone: ${contact.phones.join(' / ')}`,
    `- Email: ${contact.email}`,
    `- Instagram: ${contact.instagram}`,
    '',
    '## Optional',
    '',
    `- [Full text](${SITE_URL}/llms-full.txt): every fact and FAQ answer on one page`,
    `- [Machine-readable facts](${SITE_URL}/facts.json): the same data as JSON`,
    '',
  ].join('\n')

/**
 * `llms-full.txt` — the whole site as one flat plain-text document.
 *
 * Answer engines cite what they can extract cleanly. Flat `Label: value` lines
 * and verbatim question/answer pairs survive chunking far better than the same
 * facts spread across a styled page.
 */
export const llmsFullTxt = () =>
  [
    `# ${BRAND}`,
    '',
    `${VENUE_DESCRIPTION}`,
    '',
    '## At a glance',
    '',
    ...glanceFacts.map((f) => `${f.term}: ${f.detail}`),
    `Legal name: ${LEGAL_NAME}`,
    `Phone: ${contact.phones.join(' / ')}`,
    `Email: ${contact.email}`,
    `Instagram: ${contact.instagram}`,
    `Map: ${contact.mapUrl}`,
    '',
    '## Spaces and amenities',
    '',
    ...amenities.map((a) => `- ${a.title}: ${a.sub}`),
    '',
    '## Included with every booking',
    '',
    ...included.map((item) => `- ${item}`),
    '',
    '## Events hosted',
    '',
    ...events.map((e) => `- ${e.title}: ${e.blurb}`),
    '',
    '## Areas served',
    '',
    ...AREA_SERVED.map((a) => `- ${a}`),
    '',
    '## Frequently asked questions',
    '',
    ...faqs.flatMap((f) => [`### ${f.q}`, '', f.a, '']),
    '## Booking',
    '',
    `Send an inquiry at ${abs('/contact')} or call ${contact.phones[0]}. ` +
      'We reply within one business day to confirm availability and arrange a tour.',
    '',
  ].join('\n')

/**
 * `facts.json` — the same facts as strict JSON.
 *
 * Not a standard (unlike llms.txt), but it costs nothing and gives any agent
 * that fetches the site a parse-free path to the numbers that get quoted most:
 * capacity, square footage, location and contact details.
 */
export const factsJson = () =>
  JSON.stringify(
    {
      name: BRAND,
      legalName: LEGAL_NAME,
      alternateNames: [LEGAL_NAME, 'Infinity Rio Ranch'],
      url: `${SITE_URL}/`,
      description: VENUE_DESCRIPTION,
      type: 'Wedding and event venue',
      address: {
        streetAddress: ADDRESS.street,
        addressLocality: ADDRESS.city,
        addressRegion: ADDRESS.region,
        postalCode: ADDRESS.postalCode,
        addressCountry: ADDRESS.country,
        formatted: contact.address,
        map: contact.mapUrl,
      },
      contact: {
        phones: [...contact.phones],
        email: contact.email,
        instagram: contact.instagram,
      },
      spaces: {
        totalAcres: 2,
        indoorSqFt: 2600,
        outdoorSqFt: 12400,
      },
      eventTypes: [...eventTypes],
      amenities: amenities.map((a) => ({ name: a.title, detail: a.sub })),
      included: [...included],
      areaServed: [...AREA_SERVED],
      faqs: faqs.map((f) => ({ question: f.q, answer: f.a })),
      booking: {
        url: abs('/contact'),
        responseTime: 'within one business day',
      },
    },
    null,
    2,
  ) + '\n'

/** Stat lines reused by the About page's at-a-glance block. */
export const glanceFacts = [
  { term: 'Location', detail: `${ADDRESS.street}, ${ADDRESS.city}, ${ADDRESS.region} ${ADDRESS.postalCode}` },
  { term: 'Grounds', detail: `${stats[0].value} acres — ${stats[1].value} sq ft indoors, ${stats[2].value} sq ft outdoors` },
  { term: 'Event types', detail: events.map((e) => e.title).join(' · ') },
  { term: 'Serving', detail: 'Liberty Hill, Georgetown, Leander, Cedar Park and Greater Austin' },
  { term: 'Booking', detail: 'Send an inquiry and we reply within one business day' },
] as const
