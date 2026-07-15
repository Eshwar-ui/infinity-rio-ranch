# Infinity Rio Ranch — Progress

## Goal
Convert the Claude Design file `Infinity Rio Ranch.dc.html` into a React + Tailwind
project following the bencium code conventions.

## Stack
- Vite + React 19 + TypeScript
- TailwindCSS **v3** (never v4) + `tailwindcss-animate`
- shadcn/ui foundation (`@/components/ui`), manually wired for v3
- Routing: `react-router-dom` (`/`, `/about`, `/gallery`, `/contact`)
- State: `zustand` (theme + lightbox), persisted theme
- Forms: `react-hook-form` + `zod`
- Icons: `@phosphor-icons/react`; Toasts: `sonner`
- Path alias: `@/*` → `src/*`

## Done — full site implemented ✅
- [x] Design read in full; assets copied to `public/assets/`
- [x] Theme tokens (dark default + light + 4 accents) as CSS vars in `index.css`,
      mapped into Tailwind; `[data-theme]`/`[data-accent]` on `<html>` via theme store
- [x] Fonts: Cormorant Garamond (serif), Dancing Script (script), Jost (body)
- [x] Effects: film grain, parallax, Ken Burns hero slideshow, bokeh, twinkling
      lights, scroll-reveal (IntersectionObserver), condensing sticky nav
- [x] Pages: Home, About, Gallery (filters), Contact (validated form + success)
- [x] Gallery masonry + keyboard-navigable lightbox (18 photos)
- [x] Mobile menu, theme toggle, footer
- [x] SPA host configs: `public/_redirects` (Netlify), `vercel.json` (Vercel)
- [x] `npm run build` passes clean (no warnings)

## Verified in-browser (via DOM, screenshots blocked by external-image network hang)
- Tokens/fonts applied; theme toggle dark↔light + accent shift
- Routing across all 4 pages; gallery 18 tiles + 5 filters
- Lightbox open + next (1/18 → 2/18); contact validation + success state

## Structure
```
src/
  App.tsx                 router + Toaster
  data/site.ts            all content (nav, events, gallery, amenities, contact)
  store/theme.ts          zustand theme/accent (persisted)
  store/lightbox.ts       zustand lightbox index
  hooks/                  use-reveal, use-parallax, use-scrolled
  lib/inquiry-schema.ts   zod contact-form schema
  components/
    ui/                   button, section-heading, stat-list
    layout/               navbar, footer, page-hero, root-layout, theme-provider
    effects/              grain, reveal, hero-ambiance
    gallery/              gallery-grid, lightbox
    sections/             home-hero
  pages/                  home, about, gallery, contact
```

## Images
- Real venue photos scraped from infinityrioranch.com (WP site; needed full browser
  headers to clear a 406 bot block) → `public/assets/site/` (22 full-res JP/PNG, ~23 MB).
- All external `infinityrioranch.com` URLs repointed to these local copies — hero
  slideshow, welcome, about, contact, and 13 gallery tiles. No external image deps remain,
  which also fixed the preview screenshot hang (page now reaches network-idle).
- Design-bundle `venue-*.jpg` still used for the 4 outdoor gallery tiles.
- [ ] Optimize to WebP + add width/height + lazy-loading (originals are large, ~1–3 MB each).

## Added sections (design-audit round 1)
- **Testimonials** (`components/sections/testimonials.tsx`) → Home, before final CTA.
- **What's Included** → About page (checklist, phosphor Check).
- **FAQ** → Contact page (radix accordion, `components/ui/accordion.tsx`).
- New content lives in `data/site.ts` (`testimonials`, `included`, `faqs`) — **all
  placeholder, clearly marked; swap in the venue's real quotes/answers.**
- Reused existing design system (SectionHeading, brass card, Reveal) — no new tokens.
- Bundle now >500 kB → consider route-level `React.lazy` code-splitting (advisory only).

### Approved but not yet built
- **Packages** (3 tiers: Intimate / Signature / Grand) as **"inquire for quote"** —
  no prices shown, route to contact form. Direction confirmed: single-venue site.

## Open decisions / next steps
- [ ] **Contact form behavior** (`src/lib/inquiry-schema.ts`): baseline requires only
      name + valid email. Decide stricter rules (require phone/date, min message)?
- [ ] **Form backend**: currently simulated (toast + success state, logs to console).
      Wire to email/Supabase/Formspree when ready — `onSubmit` in `pages/contact.tsx`.
- [ ] Consider optimizing images to WebP + lazy-loading (bencium convention).
- [ ] Deploy target: Netlify or Vercel (both configs in place). Set env vars in dashboard.
```
