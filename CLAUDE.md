# CLAUDE.md

Guidance for working in this repo. Keep it accurate — delete lines that go stale.

## What this is
Marketing site + admin backend for **Infinity at Rio Ranch**, a wedding/event venue
in Liberty Hill, TX. Single-page React app (public site + `/admin` panel) on a
Supabase backend, deployed to Vercel.

## Stack
- **Vite + React 19 + TypeScript**, **TailwindCSS v3** (never v4 — shadcn/ui was
  hand-wired for v3; don't run `shadcn init`).
- **Supabase** (Postgres + Auth + Storage) — the only backend. No server framework.
- Routing `react-router-dom`; state `zustand`; forms `react-hook-form` + `zod`;
  icons `@phosphor-icons/react`; toasts `sonner`.
- Path alias `@/*` → `src/*`.

## Commands
- `npm run dev` — dev server (use the preview tool, not raw shell, to run it).
- `npm run build` — pull:content → `tsc -b` → vite build → SSR build → prerender
  (must pass before shipping). The prerender step fails the build on error by design.
- `npm run pull:content` — refreshes `src/data/content.generated.json` from the
  CMS. Runs as the first build step; run it by hand after publishing edits if you
  want the change committed. Commit the result.
- `npm run lint` — oxlint. `design/` warnings are the design bundle, ignore them.
- `npm run optimize:images` — re-encodes `public/assets` in place (JPEG q78,
  1600px cap). Run it after adding photos; it's manifest-idempotent and
  deliberately outside `build` so nothing gets re-compressed every deploy.

## Architecture rules
- **Security is RLS, not app code.** The public site uses the publishable anon key;
  what it can do is decided by Row-Level Security. The React admin guard is UX only —
  never rely on it for access control.
- **Admin access = allowlist, not "logged in."** A user is admin only if their id is
  in `admin_users`, checked via the `is_admin()` security-definer function. RLS on
  admin data gates on `is_admin()`, so a stray signup can reach the login screen but
  read nothing. Reuse this pattern for any new admin table.
- **CMS content reaches crawlers via a build-time snapshot, not the client fetch.**
  `npm run pull:content` (`scripts/pull-content.mjs`, runs first in `build`)
  reads the published rows over PostgREST and writes `src/data/content.generated.json`,
  which is **committed**. `src/lib/content-snapshot.ts` layers that over the
  `src/data/site.ts` / `src/data/copy.defaults.json` defaults and is deliberately
  hook-free, so `seo.ts` and the prerenderer can read it at module scope.
  `use-site-content.ts` seeds every hook from it and then refetches live in the
  browser. This ordering is the whole point: effects don't run during SSR, so
  anything fetched in a `useEffect` is absent from `dist/` and invisible to
  GPTBot/ClaudeBot/PerplexityBot. Seeding from a static import puts real CMS
  values in the prerendered HTML *and* makes the client's first render match it,
  so hydration holds. The pull is forgiving by design — no creds, no network, or
  no tables and it keeps the committed snapshot and exits 0.
- **Editable content lives in six tables.** `site_copy` (keyed page copy —
  `key`, `page`, `label`, `value`, `type`), `stats`, `amenities`, `list_items`
  (`list` = `included` | `event_types`), `posts` (the blog), plus the
  pre-existing `testimonials`, `events`, `faqs`, `gallery`. Admin UI:
  `/admin/content` for copy, `/admin/blog` for posts,
  `ContentEditor` (with its `scope` prop for `list_items`) for the rest.
  All ten editors sit behind the single **CMS** sidebar entry as a tab bar
  (`pages/admin/cms-layout.tsx`, a pathless layout route in `App.tsx` — the
  per-editor URLs are unchanged). A new website editor needs a row in
  `pages/admin/cms-tabs.ts` and a child of that layout route; nothing in
  `admin-layout.tsx` changes.
  **Add a copy key to `src/data/copy.defaults.json` first** — it is the single
  source for the render fallback, the migration seed and the admin field list.
- **Anything editable must survive being deleted or emptied.** The prerender step
  fails the build on a throw, so `stats[1].value` in `seo.ts` meant removing one
  statistic in the admin panel broke the deploy. Never index CMS arrays
  positionally and never interpolate a possibly-absent value into a template.
- **The blog is prerendered per post, so `PUBLIC_ROUTES` is computed, not fixed.**
  `posts` (0008) holds slug, markdown body, cover, per-post `seo_title` /
  `seo_description`, an FAQ `jsonb` array and optional CTA overrides. Every
  published post becomes a `/blog/<slug>` entry in `PUBLIC_ROUTES`, which is what
  makes the prerenderer emit `dist/blog/<slug>/index.html`, a sitemap row and an
  `llms.txt` line. Consequences worth knowing before touching any of it:
  - **Never index `ROUTE_META` by an arbitrary member of `PUBLIC_ROUTES`** — post
    routes have no entry. `llms.txt` iterates `STATIC_ROUTES` for exactly this
    reason; post metadata comes from `postMeta(post)` instead.
  - **`vercel.json` gets one pattern rewrite, `/blog/:slug`**, not one per post.
    An unpublished slug matches no file and falls through to `404.html` — that's
    the design, not a gap. `assertRewritesCoverRoutes` knows about the pattern.
  - **Post `lastmod` comes from `updated_at`, not git.** There is no
    `src/pages/blog/<slug>.tsx`, so `gitLastModified()` returns null for posts;
    `sitemapEntries()` carries the DB value and the prerenderer prefers it.
  - **`published_at` is stamped by a DB trigger on first publish**, never by the
    admin UI — otherwise every unpublish/fix/republish cycle silently re-dates
    the article. Same rule as invoice numbers.
  - **The blog pages are eagerly imported in both `App.tsx` and
    `entry-server.tsx`.** They cannot be `React.lazy`: the Suspense fallback
    would land in the prerendered HTML and mismatch on hydration. The cost is
    that post bodies ship in the main bundle — `pull-content.mjs` warns past
    ~200 kB of body text, which is the point to reconsider the approach.
  - **Dates are formatted by `src/lib/post-format.ts`, never `toLocaleDateString`** —
    that reads the runtime's locale and timezone, so Node and the browser
    disagree and hydration breaks.
  - FAQ pairs render *and* emit `FAQPage` JSON-LD; Google drops the enhancement
    if the markup and the schema disagree, so both come from `post.faqs`.
- **Publishing is a rebuild.** Saving in the admin panel updates the DB — instant
  for JS visitors, invisible to crawlers until the next build. The "Publish to
  live site" button (`components/admin/publish-bar.tsx`) POSTs a Vercel deploy
  hook stored in the admin-only `site_settings` table (never a `VITE_` var — the
  admin chunk is lazy but still public).
- **Leads and clients are two tables, not one.** `leads` is the anon-writable
  contact-form inbox; `clients` (`0004_clients.sql`) is the booked side and is
  admin-only with **no public INSERT policy** — nothing on the public site ever
  writes a client. Conversion goes through the `convert_lead_to_client()`
  security-definer RPC so the client insert and the lead's `status = 'converted'`
  land in one transaction; never do it as two client-side writes. A lead's
  `converted` status is owned by that function — the admin UI deliberately can't
  set it by hand. `clients.lead_id` is UNIQUE (one conversion per lead) and
  `ON DELETE SET NULL` (deleting an old lead never removes a booked client).
- **The advance is two columns, not one.** `clients.advance_amount` is what the
  couple actually paid to hold the date and belongs to the booking;
  `invoices.advance_paid` is what *one* invoice credits against its total. The
  second is copied from the first when an invoice is raised, then editable —
  otherwise a follow-up invoice credits the same deposit twice, which is why the
  client profile prefills it with the *uncredited* remainder. Balance is
  `max(0, total − advance)` everywhere (`computeTotals`) — an advance over the
  total is an overpayment to refund, never a negative amount due — and the
  Advance/Balance rows only render once an advance exists.
  `invoices.client_id` is `ON DELETE SET NULL`, never CASCADE: an invoice is a
  financial record, and `client_name`/`client_email` are denormalised onto it so
  it still reads correctly after the client row is edited or deleted.
- **`clients.payment_status` is hand-set, not derived.** unpaid/partial/paid,
  a deliberate owner decision (0006): cash and transfers never touch this app,
  so the amounts on a client row aren't a complete payment record. The cost is
  that the flag *can* contradict the balance — nothing reconciles them, and the
  profile prints a plain note when they disagree instead of correcting either.
  Don't "fix" this by computing it from `amount`/`advance_amount`. It's separate
  from `status` (booked/completed/cancelled) and from an invoice's own
  draft/sent/paid.
- **The admin panel does not use the site's fonts.** `.admin-ui` (index.css,
  applied on the admin shell + login) switches to the OS UI stack via
  `font-admin` — the panel is lazy-loaded behind auth, so a webfont would be a
  download nobody sees, and Cormorant/Jost are branding, not tool typography.
  Class strings live once in `src/lib/admin-ui.ts` (`field`, `label`,
  `btnPrimary`, `pill`, …); every page used to declare its own `field`/`label`,
  which is how they drifted. Nothing structural is set in ALL CAPS with wide
  tracking any more — that treatment costs legibility at 12px. The
  client-facing invoice document keeps the serif deliberately.
- **Appending a width to a shared class string doesn't work.** `field` carries
  `w-full`, and Tailwind emits `.w-full` *after* `.w-16`/`.w-24` in the sheet, so
  `` `${field} w-24` `` silently renders full width — this shipped twice (the
  CMS "Order" input, the invoice line items). Size the *wrapper* instead. Same
  trap for any conflicting pair in one string.
- **List views share one filter toolbar** (`components/admin/list-filters.tsx`):
  search + per-option counts, docked above the list it filters rather than
  floating in the page header. Counts are computed against the *other* active
  filters, so "Paid 6" can't sit above a list of two.
- **`/admin/clients` is a profile, not a form.** Read-only by default behind an
  Edit toggle; status writes straight through on click. Invoices are raised in
  place via `components/admin/client-invoice-panel.tsx`, which only ever
  *creates* — editing an existing invoice stays in `invoice-editor.tsx`, which
  owns the number, the public token and the send state. `/admin/invoices/new`
  also takes `?client=<uuid>` and prefills from that client.
- **The rental agreement is stamped, not templated.** Emailing an invoice that
  belongs to a client attaches the venue's own agreement PDF with the client
  name, event date and event type drawn onto it
  (`supabase/functions/_shared/agreement.ts`). The template has **no form
  fields**, so every value sits at a fixed coordinate in
  `agreement-fields.json`; re-exporting the PDF silently invalidates all of them
  and nothing errors. `node scripts/agreement-preview.mjs` renders a local copy
  from that same JSON — look at it after any change. The blank template lives in
  the private `documents` bucket (0007), not the repo, so replacing it is an
  upload. No template = invoice still sends, toast says so. Signing dates are
  deliberately left blank for hand-signing. Full procedure in `RUNBOOK.md`.
- **Invoice numbers are DB-assigned.** A `BEFORE INSERT` trigger pulls from a
  sequence (`INV-YYYY-0001`) — never generate numbers in JS (races).
- **Client-facing invoice** (`/invoice/:token`) reads via the `get_invoice_by_token`
  security-definer RPC — the invoices table stays admin-only under RLS.
- Admin + invoice pages are `React.lazy` chunks in `src/App.tsx` so public visitors
  don't download them. Keep new admin code lazy.
- **Public routes are prerendered; `src/lib/seo.ts` is the only SEO source.**
  `scripts/prerender.mjs` writes real HTML per route into `dist/<route>/index.html`
  so non-JS crawlers (GPTBot, ClaudeBot, PerplexityBot) see the content. Titles,
  meta, JSON-LD, `sitemap.xml` and `robots.txt` all come from `src/lib/seo.ts`,
  used at build time by the prerenderer and at runtime by `useDocumentHead()`.
  Adding a public page means updating `PUBLIC_ROUTES` + `ROUTE_META` there, the
  router in `App.tsx` **and** `src/entry-server.tsx`, plus a rewrite in
  `vercel.json` (the prerender script fails the build if you forget that last one).
  The prerenderer also emits `404.html`, `llms.txt`, `llms-full.txt` and
  `facts.json` from the same module.
  **Never put `robots.txt` or `sitemap.xml` in `public/`** — Vite copies that
  folder into `dist/` *before* the prerender step overwrites both files, so
  hand-edits there look authoritative and ship nothing. This has already
  happened once; see "The `public/` trap" in `SEO.md`.
- **No catch-all rewrite in `vercel.json`.** A `/(.*)` → `/index.html` rule makes
  every unknown URL return 200 with the homepage's HTML (soft 404s at unbounded
  URLs). Unknown paths must fall through to `dist/404.html`. `App.tsx` and
  `entry-server.tsx` both route `path="*"` to `NotFoundPage`; the prerender
  script fails the build if a catch-all reappears.
  Photos must be real `<img>` with alt text — background images are unindexable.
  Full write-up in `SEO.md`.
- **The client hydrates the prerendered HTML — don't break the match.** Both
  `App.tsx` and `src/entry-server.tsx` render the same `AppShell`; if their trees
  diverge, React logs error #418 and silently falls back to client rendering,
  which quietly costs ~2s of LCP. Anything that differs between build time and
  first client paint (localStorage, `Date`, viewport measurements) must render
  its server value first and correct itself in an effect — see `use-reveal.ts`
  and the `skipHydration` in `store/theme.ts`.
- **Images go through `<SmartImage>`**, which reads `src/lib/image-sources.json`
  (generated) and falls back to a plain `<img>` for anything unknown, so CMS
  uploads still work. Pass a truthful `sizes` — a wrong one is worse than none.
  Photos live in `public/assets`; generated derivatives in `public/assets/_r`.
  Both are committed; never `git clean` that tree without regenerating
  (`public/assets/fonts` lives there too).

## Layout
- `src/pages/` public pages; `src/pages/admin/` admin panel; `src/pages/invoice-public.tsx`.
- `src/pages/blog.tsx` + `src/pages/blog-post.tsx` public blog;
  `src/pages/admin/blog.tsx` its editor; `src/lib/markdown.tsx` the body renderer
  (react-markdown, elements mapped to the site's type scale — not a `prose` sheet);
  `src/lib/post-format.ts` hydration-safe dates.
- `src/components/admin/content-editor.tsx` — generic CRUD editor (testimonials/events/faqs).
- `src/lib/supabase.ts` client; `src/lib/invoice.ts` totals/money helpers.
- `src/hooks/use-admin.ts` session + is_admin; `src/hooks/use-site-content.ts` public reads.
- `supabase/migrations/` — DB schema, source of truth for the backend; keep in
  sync with any schema change. `0001_init.sql` = tables, RLS, functions, triggers,
  storage bucket, seeds. `0002_hardening.sql` = leads CHECK constraints, single-
  featured trigger, `updated_at`, indexes. `0003_page_content.sql` = `site_copy`,
  `stats`, `amenities`, `list_items`, `site_settings` + RLS + copy seeds. `0004_clients.sql` = `clients`
  table, the `converted` lead status and `convert_lead_to_client()`.
  `0005_client_advance_invoices.sql` = `clients.advance_amount`,
  `invoices.client_id` + `invoices.advance_paid`, and `get_invoice_by_token()`
  recreated to carry the advance. `0006_client_payment_status.sql` =
  `clients.payment_status`, seeded once from the existing amounts.
  `0007_documents_bucket.sql` = the private `documents` bucket holding the
  rental-agreement template. `0008_posts.sql` = the `posts` table, its RLS, the
  `stamp_published_at()` trigger and the published/published_at index. Covers
  reuse the existing public `gallery` bucket rather than adding a new one.
  `supabase/seeds/` is **not** migrations — one-off content inserts, run by hand
  once. They upsert, so re-running one overwrites whatever the owner has since
  edited in the admin panel. Never move a seed into `migrations/`.
  `RUNBOOK.md` — key rotation + new-project setup. `supabase/functions/send-invoice/` — Resend edge function (rebuilt in repo).
- Supabase edge function `send-invoice` (Resend) sends the client an invoice link.
  **Its source is not in the repo** (deployed directly) — must be rebuilt from
  scratch on a fresh project; see `RUNBOOK.md`.

## Verifying in the browser (important gotchas)
- This site's **infinite CSS animations hang the preview's screenshot and
  accessibility (`read_page`) tools.** Verify via `javascript_tool` DOM eval +
  `get_page_text` instead.
- **React controlled inputs** won't pick up a plain `.value` set — use the native
  setter + dispatch an `input` event (see how login/CMS were driven in-session).
- After many HMR reloads a dev tab can stop submitting forms — open a fresh tab or
  restart the preview.
- When the public page and its `site.ts` fallback are identical, you can't tell DB
  reads from fallback by looking — change a DB row to a unique marker to prove it.
- **Forging a test admin via SQL:** inserting into `auth.users` directly requires
  coalescing the token columns (`confirmation_token`, `recovery_token`,
  `email_change_token_new`, etc.) to `''` — left NULL, GoTrue login 500s with
  "converting NULL to string is unsupported". Also add a matching `auth.identities`
  row + the `admin_users` entry. Real admin accounts should be made in the dashboard.

## Owner setup (not in code)
- Create the admin user in the Supabase dashboard, then insert their id into
  `admin_users` (steps in `admin-plan.md`).
- Set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in Vercel **before deploying** —
  `src/lib/supabase.ts` throws on load without them, white-screening the whole site.
- Invoice email needs `RESEND_API_KEY`, `INVOICE_FROM`, `SITE_URL` as `send-invoice`
  edge-function secrets.

## Project facts & references
- **Origin:** converted from a Claude Design file (`Infinity Rio Ranch.dc.html`),
  delivered as `Infinity Rio Ranch Redesign-handoff.zip` (extracted to `design/`) —
  not via DesignSync MCP. Built to the bencium code conventions. Original public
  site build (Home/About/Gallery/Contact SPA) predates the backend; see `progress.md`.
- **Theme:** dark (default) + light + 4 accents as CSS vars in `index.css`, mapped
  into Tailwind; `[data-theme]`/`[data-accent]` set on `<html>` by the theme store.
  Fonts: Cormorant Garamond (serif) / Dancing Script (script) / Jost (body).
- **Supabase:** ref `xmnneacpgjwaihwcvayx` (`https://xmnneacpgjwaihwcvayx.supabase.co`).
  Edge function: `send-invoice`. This replaced the original project
  `fgzztabgzoxuwkknpdmu` (org `cscvnreghecmarqhgkrq`, region us-east-1) after it was
  **deleted** — which is why the schema is now versioned in
  `supabase/migrations/0001_init.sql`. Confirm the new project's region/org in the
  dashboard; recovery steps in `RUNBOOK.md`.
- **Hosting:** Vercel project `eshwar-uis-projects/infinity-rio-ranch`
  live at **https://www.infinityrioranch.com** (canonical host; the apex
  redirects to www, `infinity-rio-ranch.vercel.app` is the platform URL).
  `vercel.json` handles the prerendered-route + SPA rewrites.
  Vercel CLI auth is interactive-only — can't deploy non-interactively from here.
- **Git:** private repo `Eshwar-ui/infinity-rio-ranch` (gh CLI authed as Eshwar-ui).
  `.env.local` is gitignored — keys are never committed.
- **Venue (real data):** Infinity at Rio Ranch, 326 Rio Pk Dr, Liberty Hill, TX 78642
  (Greater Austin). Contact details live in `src/data/site.ts`.

See `admin-plan.md` for full backend/feature status, `progress.md` for the
original site build, `RUNBOOK.md` for backend ops (key rotation, standing up a
new Supabase project, rebuilding the edge function), `DEPLOY.md` for shipping
to Vercel (env vars, pre-flight, verification, rollback), and `SEO.md` for
search/answer-engine architecture and the open owner-side tasks.
