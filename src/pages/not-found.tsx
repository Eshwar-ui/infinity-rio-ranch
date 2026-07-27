import { Link } from 'react-router-dom'

import { navLinks } from '@/data/site'
import { Button } from '@/components/ui/button'

/**
 * Rendered for any path no other route matches, and prerendered to
 * `dist/404.html` — which Vercel serves with a real 404 status once the SPA
 * catch-all rewrite is narrowed to /admin and /invoice (see vercel.json).
 *
 * Before this existed every unknown URL returned 200 with the homepage's HTML,
 * so crawlers saw an unbounded set of duplicate pages (a "soft 404").
 *
 * Deliberately plain: no hero image, no reveal animation, nothing that needs a
 * second network round-trip. It sits inside RootLayout, so the navbar and
 * footer still give a crawler — and a lost visitor — a way back.
 */
export const NotFoundPage = () => (
  <section className="relative flex min-h-[70vh] items-center bg-ink px-[clamp(20px,6vw,80px)] py-[clamp(80px,12vw,150px)]">
    <div className="mx-auto max-w-content text-center">
      <p className="font-script text-[clamp(28px,5vw,44px)] text-brass">404</p>
      <h1 className="mt-2 font-serif text-[clamp(34px,6vw,64px)] leading-tight text-cream">
        This page has wandered off
      </h1>
      <p className="mx-auto mt-6 max-w-[54ch] text-muted">
        The link you followed doesn&rsquo;t exist on our site. Infinity at Rio Ranch is a
        two-acre wedding and event venue at 326 Rio Pk Dr, Liberty Hill, TX &mdash; the
        pages below cover the venue, the photos and how to book a tour.
      </p>

      <nav className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
        {navLinks.map((link) => (
          <Link
            key={link.key}
            to={link.to}
            className="text-sm uppercase tracking-[0.18em] text-muted transition-colors hover:text-brass"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="mt-10">
        <Button asChild>
          <Link to="/contact">Check your date</Link>
        </Button>
      </div>
    </div>
  </section>
)
