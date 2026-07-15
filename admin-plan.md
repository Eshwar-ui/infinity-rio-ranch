# Infinity Rio Ranch — Admin Panel & Backend Plan

Turns the static marketing SPA into a site with a real backend spine, an
authenticated admin area, and four features hanging off it: **leads**,
**testimonials**, **CMS** (events/packages, FAQs, gallery), and an
**invoice generator** (PDF + email + numbering).

## Status
- ✅ **Phase 0** — Supabase project `infinity-rio-ranch` (`fgzztabgzoxuwkknpdmu`,
  us-east-1) created; `supabase-js` installed; client at `src/lib/supabase.ts`;
  env in `.env.local`.
- ✅ **Phase 1** — `leads` table + RLS live; contact form writes real rows
  (verified end-to-end in browser → DB). Test row cleaned up.
- ✅ **Phase 2** — admin auth + shell. `admin_users` allowlist + `is_admin()`;
  leads RLS re-gated on `is_admin()`. `/admin/login`, guarded `/admin` layout
  with sidebar (`src/pages/admin/*`, `src/hooks/use-admin.ts`).
- ✅ **Phase 3** — leads inbox: list + detail, status filter, auto-mark-read,
  status changes, delete. Verified full flow (guard → login → read/update → DB).
- ✅ **Phase 4** — CMS complete: `testimonials`/`events`/`faqs`/`gallery` tables
  (RLS: anon reads published, admin full), seeded from site.ts. Public pages read
  from DB with site.ts fallback (`src/hooks/use-site-content.ts`); verified
  DB-backed via live markers. Shared admin CRUD
  (`src/components/admin/content-editor.tsx`) for testimonials/events/faqs;
  dedicated `src/pages/admin/gallery.tsx` with Supabase Storage image upload
  (bucket `gallery`, public read + admin write), category/span/featured controls.
- ✅ **Phase 4b** — Gallery refactor: lightbox is now list-based
  (`store/lightbox.ts` holds items+index; `open(items, i)`), spans moved from
  index-keyed Sets to a `span` column, featured from a `featured` boolean.
  Verified: upload→Storage, create→DB, single-featured enforcement, lightbox
  navigation (2/17→3/17), public gallery DB-backed.
- ✅ **Phase 5** — invoice generator. `invoices` + `invoice_items` (RLS admin-only);
  atomic sequential numbering via `set_invoice_number` trigger + `invoice_seq`
  (`INV-YYYY-0001`). Editor (`src/pages/admin/invoice-editor.tsx`): client fields,
  dynamic line items, live totals (subtotal/tax/total), live branded preview.
  List (`src/pages/admin/invoices.tsx`) with computed totals. Branded printable
  doc (`src/components/invoice/invoice-document.tsx`) + print CSS in `index.css`.
  Public token page (`/invoice/:token`) via `get_invoice_by_token` security-definer
  RPC (`src/pages/invoice-public.tsx`). Email via deployed edge function
  `send-invoice` (Resend) — verified wired (auth + graceful "not configured").
  Verified end-to-end: create→DB, numbering, totals math, public page, list.

### Email setup (Phase 5, to actually send)
Set these Edge Function secrets (Supabase Dashboard → Edge Functions → send-invoice
→ Secrets, or `supabase secrets set`): `RESEND_API_KEY`, `INVOICE_FROM`
(e.g. `Infinity Rio Ranch <invoices@yourdomain.com>`, domain verified in Resend),
`SITE_URL` (e.g. `https://infinity-rio-ranch.vercel.app`). Until set, "Email client"
reports "email service may not be configured" and nothing sends.

### Polish
- Route-level code-splitting: admin + invoice pages are `React.lazy` chunks
  (`src/App.tsx`), so public visitors don't download the admin panel. Lint clean
  for all new code; typecheck + build pass.

---
## ✅ All phases complete. Remaining owner setup: create admin account (above),
## set Vercel env vars (above), and Resend secrets (above) to enable invoice email.

> Browser note: this site's infinite CSS animations hang the preview's
> screenshot + a11y tree. Verify admin UI via DOM eval (`javascript_tool`) +
> `get_page_text`, and drive controlled inputs with the native-setter trick.

> **You must create your admin account** (I don't set passwords). See
> "Creating the admin account" at the bottom of this file.

> **Before deploying:** set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in
> the Vercel project env vars — they only exist in local `.env.local` right now.

## Decisions locked
- **Backend:** Supabase (Postgres + Auth + Storage). New project, dedicated to
  this venue (the two existing projects are unrelated).
- **CMS scope:** events/packages, FAQs, gallery. **Not** hero/page copy — those
  stay in `site.ts`.
- **Invoices:** full — sequential numbering, PDF, email to client.
- **Auth:** single owner account (email/password). No public signup.

## Architecture
- One new frontend dep: `@supabase/supabase-js`. Client reads `VITE_SUPABASE_URL`
  + `VITE_SUPABASE_ANON_KEY` from env (set in `.env.local` + Vercel dashboard).
- Public site keeps deploying to Vercel unchanged. Supabase is called from the
  browser; Row-Level Security (RLS) is the security boundary, not server code.
- Email + PDF-for-email handled by **one Supabase Edge Function + Resend**
  (the only server-side code we write).

### Tables & RLS
| Table | anon (public site) | authenticated (admin) |
|---|---|---|
| `leads` | INSERT only | full |
| `testimonials` | SELECT where `published` | full |
| `events` | SELECT where `published` | full |
| `faqs` | SELECT where `published` | full |
| `gallery` | SELECT where `published` | full |
| `invoices` | none | full |
| `invoice_items` | none | full |

- `leads`: name, email, phone, date, type, message, status
  (`new`/`read`/`replied`/`archived`), created_at.
- `invoices`: number (from a Postgres sequence, formatted `INV-YYYY-####`),
  client name/email/address, issue/due dates, status
  (`draft`/`sent`/`paid`), notes, totals. `invoice_items`: description, qty,
  unit_price. Storage bucket for generated PDFs + gallery images.

### Admin surface
- Routes under `/admin/*`, wrapped in an auth guard (redirect to `/admin/login`
  if no session). Reuses existing shadcn/Tailwind components — no new design
  system.
- Sidebar: Leads · Testimonials · Events · FAQs · Gallery · Invoices.

## Build order (each phase ships on its own)

### Phase 0 — Supabase project + client  *(needs your OK: project creation has a cost prompt)*
- Create project, add `supabase-js`, wire client + env vars, confirm connection.

### Phase 1 — Leads (highest value: stops the form losing data)
- `leads` table + RLS (anon INSERT). Replace the fake `onSubmit` in
  `src/pages/contact.tsx:46` with a real insert. Keep the existing success UI.
- Skipped until asked: lead-notification email to the owner (add in Phase 5,
  reuses the same Edge Function).

### Phase 2 — Admin shell + auth
- `/admin/login`, session guard, sidebar layout. Seed the single owner user.

### Phase 3 — Leads inbox
- List + detail view, status changes, filter/search. First CRUD; sets the
  pattern the rest reuse.

### Phase 4 — Testimonials + CMS (events/packages, FAQs, gallery)
- Admin CRUD for each. Public pages read from Supabase instead of the hardcoded
  arrays in `site.ts` (fall back to `site.ts` if a fetch fails, so the site
  never renders empty).
- Gallery adds Supabase Storage upload (the one piece beyond plain CRUD).

### Phase 5 — Invoice generator
- Create/edit invoice with line items, live totals, sequential number.
- Branded invoice view. **Download PDF** client-side. **Send email** via the
  Edge Function + Resend (branded HTML + link to a tokenized public invoice
  page; PDF attachment is the noted upgrade if a link isn't enough).
- Resend needs an API key + a verified sender domain — a one-time setup you do
  in the Resend dashboard.

## Costs / accounts you'll touch
- Supabase project (free tier covers this).
- Resend account + verified domain for invoice email (free tier ~100/day).
- Set `VITE_SUPABASE_*` env vars in Vercel before deploying.

## Deliberate simplifications (ponytail)
- No server framework — RLS + one Edge Function is the entire backend.
- CMS is per-content-type CRUD, not a page builder. Hero/page copy stays static.
- Invoice email sends a link to a hosted invoice page; PDF *attachment* is a
  later upgrade, not v1.
- Single admin user, no roles/permissions system until a second user exists.

## Creating the admin account (do this once)
Passwords are yours to set — I don't create them. Two steps:

1. **Supabase Dashboard → Authentication → Users → Add user.** Enter your email
   + a password, tick "Auto Confirm User". (Project: `infinity-rio-ranch`.)
2. **Promote that user to admin.** In the SQL editor (or ask me to run it), with
   your email:
   ```sql
   insert into public.admin_users (user_id)
   select id from auth.users where email = 'YOUR_EMAIL_HERE';
   ```

Then sign in at `/admin`. Anyone who signs up but isn't in `admin_users` hits a
"Not authorized" wall and can read nothing (RLS). Optional hardening: disable
email signups in Dashboard → Authentication → Providers if you never want public
signup at all.
