/**
 * The website editors, in tab order.
 *
 * Its own module so both `cms-layout.tsx` (which renders the tabs) and
 * `admin-layout.tsx` (which lights the sidebar's CMS entry up on any of them)
 * can read it without either importing the other's component. Adding a website
 * editor means adding it here and to the CMS layout route in `App.tsx`.
 */
export const CMS_TABS = [
  { to: '/admin/content', label: 'Page content' },
  { to: '/admin/blog', label: 'Blog' },
  { to: '/admin/gallery', label: 'Gallery' },
  { to: '/admin/events', label: 'Events & Packages' },
  { to: '/admin/testimonials', label: 'Testimonials' },
  { to: '/admin/faqs', label: 'FAQs' },
  { to: '/admin/stats', label: 'Venue numbers' },
  { to: '/admin/amenities', label: 'Amenities' },
  { to: '/admin/included', label: "What's included" },
  { to: '/admin/event-types', label: 'Event types' },
] as const
