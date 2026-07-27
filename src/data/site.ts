/**
 * Site content extracted from the Claude Design prototype.
 * Kept in one place so copy/imagery can be edited without touching components.
 */

export const venueImg = (n: number) =>
  `/assets/img/venue-${String(n).padStart(2, '0')}.jpg`

export const contact = {
  email: 'infinityrioranch6@gmail.com',
  phones: ['+1 (512) 630-2236', '+1 (737) 328-3895'],
  phoneHref: 'tel:+15126302236',
  whatsappUrl: 'https://wa.me/15126302236',
  instagram: 'https://www.instagram.com/infinity_rio_ranch',
  instagramHandle: '@infinity_rio_ranch',
  address: '326 Rio Pk Dr, Liberty Hill, TX 78642',
  mapUrl: 'https://maps.google.com/?q=326+Rio+Pk+Dr,+Liberty+Hill,+TX+78642',
  mapEmbedUrl: 'https://www.google.com/maps?q=326+Rio+Pk+Dr,+Liberty+Hill,+TX+78642&output=embed',
  location: 'Liberty Hill, TX · Greater Austin',
} as const

export const stats = [
  { value: '2', label: 'Acres of Grounds' },
  { value: '2,600', label: 'Sq Ft Indoor' },
  { value: '12,400', label: 'Sq Ft Outdoor' },
] as const

export type NavLink = { key: string; label: string; to: string }
export const navLinks: NavLink[] = [
  { key: 'home', label: 'Home', to: '/' },
  { key: 'about', label: 'About', to: '/about' },
  { key: 'gallery', label: 'Gallery', to: '/gallery' },
  { key: 'contact', label: 'Contact', to: '/contact' },
]

export type EventItem = {
  n: string
  title: string
  blurb: string
  image: string
}
export const events: EventItem[] = [
  { n: '01', title: 'Weddings', blurb: 'A romantic setting for your perfect day.', image: '/assets/site/events/ev-61.png' },
  { n: '02', title: 'Corporate Events', blurb: 'A refined space for business gatherings.', image: '/assets/site/events/ev-60.png' },
  { n: '03', title: 'Cultural & Community', blurb: 'Connect and celebrate together.', image: '/assets/site/events/ev-57.png' },
  { n: '04', title: 'Birthday & Anniversary', blurb: 'Celebrate milestones in style.', image: '/assets/site/events/ev-62.png' },
]

export type Amenity = { icon: string; title: string; sub: string }
export const amenities: Amenity[] = [
  { icon: '✦', title: 'Indoor Hall', sub: '2,600 sq ft of climate-controlled elegance.' },
  { icon: '❦', title: 'Outdoor Grounds', sub: '12,400 sq ft of open-air celebration.' },
  { icon: '✷', title: 'Bridal Suite', sub: 'A private space to prepare and unwind.' },
  { icon: '☾', title: 'String-Lit Terrace', sub: 'Warm evenings under a canopy of light.' },
  { icon: '❈', title: 'Ample Parking', sub: 'Easy arrival for all your guests.' },
  { icon: '✧', title: 'Catering-Ready', sub: 'Flexible setups for any menu or vision.' },
]

export type GalleryCategory = 'ceremony' | 'reception' | 'outdoor' | 'details'
export type GalleryItem = {
  label: string
  cat: GalleryCategory
  src: string
}

/** Real photos scraped from infinityrioranch.com, stored under /public/assets/site. */
export const sitePhoto = (name: string) => `/assets/site/${name}`

/** n → local venue image from the design bundle; site → real scraped photo. */
const gallerySource = [
  { l: 'Grand Reception', c: 'reception', site: 'DSC3669-2.jpg' },
  { l: 'Ceremony Lawn', c: 'ceremony', site: 'wed.jpg' },
  { l: 'String-Lit Terrace', c: 'outdoor', n: 5 },
  { l: 'Golden Hour Portraits', c: 'details', site: 'f11.jpg' },
  { l: 'The Sweetheart Table', c: 'reception', site: 'DSC3705.jpg' },
  { l: 'Open-Air Pavilion', c: 'outdoor', n: 8 },
  { l: 'Evening Dancefloor', c: 'reception', site: 'DSC3707.jpg' },
  { l: 'The Bridal Suite', c: 'details', site: 'DSC3712.jpg' },
  { l: 'Sunset Vows', c: 'ceremony', site: 'DSC3699-2.jpg' },
  { l: 'Cocktail Garden', c: 'outdoor', n: 11 },
  { l: 'The Family Feast', c: 'reception', site: 'DSC3692.jpg' },
  { l: 'The Grand Entrance', c: 'details', site: 'DSC3674.jpg' },
  { l: 'Under the Arch', c: 'ceremony', site: 'arch.png' },
  { l: 'Candlelit Tables', c: 'reception', site: 'DSC3699-Edit-2.jpg' },
  { l: 'Garden Ceremony', c: 'ceremony', site: 'DSC3678.jpg' },
  { l: 'First Dance', c: 'reception', site: 'DSC3699.jpg' },
  { l: 'Floral Details', c: 'details', site: 'DSC3699-Edit-3.jpg' },
  { l: 'Twilight Toast', c: 'outdoor', n: 18 },
] as const

export const gallery: GalleryItem[] = gallerySource.map((g) => ({
  label: g.l,
  cat: g.c as GalleryCategory,
  src: 'site' in g ? sitePhoto(g.site) : venueImg(g.n as number),
}))

/** Indices that span two rows / two columns in the masonry grid. */
export const galleryTall = new Set([0, 4, 7, 10, 13, 16])
export const galleryWide = new Set([3, 6, 15])

export type Filter = { key: 'all' | GalleryCategory; label: string }
export const galleryFilters: Filter[] = [
  { key: 'all', label: 'All' },
  { key: 'ceremony', label: 'Ceremony' },
  { key: 'reception', label: 'Reception' },
  { key: 'outdoor', label: 'Outdoor' },
  { key: 'details', label: 'Details' },
]

export const eventTypes = [
  'Wedding',
  'Corporate Event',
  'Cultural & Community Gathering',
  'Birthday & Anniversary',
  'Other Celebration',
] as const

// ============================================================
// PLACEHOLDER CONTENT — replace with the venue's real details.
// Structure is final; only the copy needs swapping.
// ============================================================

export type Testimonial = { quote: string; name: string; event: string }
export const testimonials: Testimonial[] = [
  {
    quote:
      'Infinity made our wedding effortless. The grounds were breathtaking at golden hour, and every detail was handled with such care.',
    name: 'Priya & Arjun',
    event: 'Wedding · Spring 2025',
  },
  {
    quote:
      'From the first tour to the last dance, the team treated us like family. Our guests are still talking about the string-lit terrace.',
    name: 'The Ramirez Family',
    event: 'Anniversary Celebration',
  },
  {
    quote:
      'We hosted our community gathering here and the space adapted to everything we needed. Elegant, spacious, and truly welcoming.',
    name: 'Sana K.',
    event: 'Cultural Gathering',
  },
]

/** Concrete deliverables shown under "What's Included" on the About page. */
export const included: string[] = [
  'Tables & elegant seating',
  'Setup & teardown by our team',
  'Private bridal suite access',
  'String-lit outdoor terrace',
  'Ample on-site parking',
  'Sound-ready indoor & outdoor spaces',
  'Flexible, catering-friendly layouts',
  'A dedicated day-of venue contact',
]

export type Faq = { q: string; a: string }
export const faqs: Faq[] = [
  {
    q: 'How many guests can the venue accommodate?',
    a: 'Our two acres pair a 2,600 sq ft indoor hall with 12,400 sq ft of outdoor space, comfortably hosting intimate gatherings through large celebrations. Share your guest count on the inquiry form and we’ll confirm the best layout.',
  },
  {
    q: 'Can we bring our own caterer and vendors?',
    a: 'Yes — our spaces are catering-friendly and flexible. We’re happy to share a list of trusted local vendors if you’d like recommendations.',
  },
  {
    q: 'Is alcohol allowed?',
    a: 'Alcohol is welcome with the appropriate licensed and insured service. We’ll walk you through the specifics during your tour.',
  },
  {
    q: 'Is parking available?',
    a: 'Yes, we offer ample on-site parking so arrival is easy for all of your guests.',
  },
  {
    q: 'How do we reserve a date?',
    a: 'Send an inquiry with your preferred date and we’ll be in touch within one business day to confirm availability, arrange a tour, and hold your date.',
  },
]
