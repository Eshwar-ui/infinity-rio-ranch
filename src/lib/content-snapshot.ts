import snapshotJson from '@/data/content.generated.json'
import { DEFAULT_COPY } from '@/data/copy'
import {
  amenities as amenitiesFallback,
  contact as contactFallback,
  eventTypes as eventTypesFallback,
  events as eventsFallback,
  faqs as faqsFallback,
  gallery as galleryList,
  galleryTall,
  galleryWide,
  included as includedFallback,
  stats as statsFallback,
  testimonials as testimonialsFallback,
  type Amenity,
  type EventItem,
  type Faq,
  type GalleryCategory,
  type Testimonial,
} from '@/data/site'

export type GalleryTileData = {
  label: string
  cat: GalleryCategory
  src: string
  span: 'tall' | 'wide' | null
  featured: boolean
}

export type Stat = { value: string; label: string }

type Snapshot = {
  pulledAt: string | null
  copy: Record<string, string>
  stats: Stat[]
  amenities: Amenity[]
  lists: Record<string, string[]>
  testimonials: Testimonial[]
  events: EventItem[]
  faqs: Faq[]
  gallery: GalleryTileData[]
}

/**
 * The build-time snapshot of the CMS, written by `npm run pull:content`.
 *
 * This is what makes editing the site mean something to search. The prerenderer
 * runs the same React tree as the browser, but effects never fire during SSR —
 * so anything a hook fetches in a `useEffect` is absent from the HTML in
 * `dist/`, and crawlers keep reading whatever was hardcoded at build time.
 * Resolving content from a static import instead puts real CMS values into the
 * prerendered markup, into `sitemap.xml` / `llms.txt` / `facts.json`, and into
 * the client's first render — identical on both sides, so hydration holds.
 *
 * Ships empty and falls through to `site.ts` / `copy.defaults.json`, so the app
 * builds fine before the migration is applied or when the pull can't reach
 * Supabase.
 *
 * Deliberately not a React module: `seo.ts` consumes these at module scope,
 * where hooks can't run.
 */
const snapshot = snapshotJson as unknown as Snapshot

/** True once a pull has actually populated the file. */
export const snapshotPulledAt = snapshot.pulledAt

/** Snapshot value when the pull found something, otherwise the shipped default. */
const seed = <T>(fromSnapshot: T[] | undefined, fallback: readonly T[]): T[] =>
  fromSnapshot && fromSnapshot.length > 0 ? fromSnapshot : ([...fallback] as T[])

/** Copy defaults with any CMS overrides layered on top. */
export const SEEDED_COPY: Record<string, string> = {
  ...DEFAULT_COPY,
  ...snapshot.copy,
}

export const copyValue = (key: string) => SEEDED_COPY[key] ?? DEFAULT_COPY[key] ?? ''

/** Fallback built from the static gallery + its index-keyed spans / featured shot. */
const galleryFallback: GalleryTileData[] = galleryList.map((g, i) => ({
  label: g.label,
  cat: g.cat,
  src: g.src,
  span: galleryTall.has(i) ? 'tall' : galleryWide.has(i) ? 'wide' : null,
  featured: i === 12,
}))

export const seededStats = seed(snapshot.stats, statsFallback)
export const seededAmenities = seed(snapshot.amenities, amenitiesFallback)
export const seededTestimonials = seed(snapshot.testimonials, testimonialsFallback)
export const seededEvents = seed(snapshot.events, eventsFallback)
export const seededFaqs = seed(snapshot.faqs, faqsFallback)
export const seededGallery = seed(snapshot.gallery, galleryFallback)

const LIST_FALLBACKS: Record<string, readonly string[]> = {
  included: includedFallback,
  event_types: eventTypesFallback,
}

export const seededList = (list: string): string[] =>
  seed(snapshot.lists?.[list], LIST_FALLBACKS[list] ?? [])

/**
 * Contact details assembled from the editable copy keys.
 *
 * The `tel:`, WhatsApp and both Google Maps URLs are derived rather than stored
 * so they cannot drift from the number and address shown on the page — editing
 * the address moves the map pin and the `hasMap` in the JSON-LD with it.
 */
const buildContact = (value: (key: string) => string) => {
  const digits = value('global.contact.phone_digits') || '15126302236'
  /*
   * Stored in parts, not as one string. The same address has to render as
   * display copy *and* as a schema.org PostalAddress with separate
   * streetAddress / addressLocality / addressRegion / postalCode fields —
   * keeping one flat string would mean either parsing it back apart with a
   * regex or hardcoding the structured copy, and the hardcoded one silently
   * stops matching the page the first time the venue's details change.
   */
  const street = value('global.contact.street')
  const city = value('global.contact.city')
  const region = value('global.contact.region')
  const postalCode = value('global.contact.postal_code')
  const address =
    [street, city, [region, postalCode].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join(', ') || contactFallback.address
  const query = encodeURIComponent(address)
  return {
    street,
    city,
    region,
    postalCode,
    email: value('global.contact.email') || contactFallback.email,
    phones: [
      value('global.contact.phone_primary'),
      value('global.contact.phone_secondary'),
    ].filter(Boolean),
    phoneHref: `tel:+${digits}`,
    whatsappUrl: `https://wa.me/${digits}`,
    instagram: value('global.contact.instagram_url') || contactFallback.instagram,
    instagramHandle:
      value('global.contact.instagram_handle') || contactFallback.instagramHandle,
    address,
    mapUrl: `https://maps.google.com/?q=${query}`,
    mapEmbedUrl: `https://www.google.com/maps?q=${query}&output=embed`,
    location: value('global.contact.location') || contactFallback.location,
  }
}

export type ContactDetails = ReturnType<typeof buildContact>

/** Module-scope contact details — what `seo.ts` and the prerenderer read. */
export const contactSnapshot: ContactDetails = buildContact(copyValue)

/** Live-copy variant, used by `useContact` once CMS values arrive in the browser. */
export const contactFrom = (value: (key: string) => string): ContactDetails =>
  buildContact(value)
