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
    `<link rel="canonical" href="${escapeAttr(head.canonical)}" />`,
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
  loc: string
  changefreq: string
  priority: string
  images: { loc: string; title: string }[]
}

/** One entry per indexable route; the gallery carries image-sitemap children. */
export const sitemapEntries = (): SitemapEntry[] =>
  PUBLIC_ROUTES.map((route) => ({
    loc: route === '/' ? `${SITE_URL}/` : abs(route),
    changefreq: route === '/gallery' ? 'monthly' : 'monthly',
    priority: route === '/' ? '1.0' : route === '/contact' ? '0.9' : '0.8',
    images:
      route === '/gallery'
        ? gallery.map((g) => ({
            loc: abs(g.src),
            title: `${g.label} — ${BRAND}, ${ADDRESS.city}, ${ADDRESS.region}`,
          }))
        : [],
  }))

/**
 * robots.txt written into dist at build time so the Sitemap line always points
 * at the domain the build was made for.
 *
 * AI crawlers are named explicitly and allowed: this is a venue that *wants* to
 * be quoted by ChatGPT / Perplexity / AI Overviews when someone asks for a
 * wedding venue near Austin. Admin and invoice URLs stay out of every index.
 */
export const robotsTxt = () =>
  [
    '# https://www.robotstxt.org/robotstxt.html',
    '',
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /admin/',
    'Disallow: /invoice/',
    '',
    '# Answer engines / AI crawlers — explicitly welcome.',
    ...[
      'GPTBot',
      'OAI-SearchBot',
      'ChatGPT-User',
      'ClaudeBot',
      'Claude-User',
      'Claude-SearchBot',
      'PerplexityBot',
      'Perplexity-User',
      'Google-Extended',
      'Applebot',
      'Applebot-Extended',
      'Bingbot',
      'DuckAssistBot',
      'cohere-ai',
      'meta-externalagent',
    ].flatMap((bot) => [
      `User-agent: ${bot}`,
      'Allow: /',
      'Disallow: /admin',
      'Disallow: /admin/',
      'Disallow: /invoice/',
      '',
    ]),
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
  ].join('\n')

/** Stat lines reused by the About page's at-a-glance block. */
export const glanceFacts = [
  { term: 'Location', detail: `${ADDRESS.street}, ${ADDRESS.city}, ${ADDRESS.region} ${ADDRESS.postalCode}` },
  { term: 'Grounds', detail: `${stats[0].value} acres — ${stats[1].value} sq ft indoors, ${stats[2].value} sq ft outdoors` },
  { term: 'Event types', detail: events.map((e) => e.title).join(' · ') },
  { term: 'Serving', detail: 'Liberty Hill, Georgetown, Leander, Cedar Park and Greater Austin' },
  { term: 'Booking', detail: 'Send an inquiry and we reply within one business day' },
] as const
