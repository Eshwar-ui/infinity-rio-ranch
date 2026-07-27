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
- `npm run build` — `tsc -b` → vite build → SSR build → prerender (must pass
  before shipping). The prerender step fails the build on error by design.
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
- **Public content reads DB with a `site.ts` fallback.** `src/hooks/use-site-content.ts`
  fetches published rows; if the fetch fails/empty it falls back to the hardcoded
  arrays in `src/data/site.ts`, so the site never renders empty. New CMS content
  should follow this shape (table + hook + fallback).
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
- `src/components/admin/content-editor.tsx` — generic CRUD editor (testimonials/events/faqs).
- `src/lib/supabase.ts` client; `src/lib/invoice.ts` totals/money helpers.
- `src/hooks/use-admin.ts` session + is_admin; `src/hooks/use-site-content.ts` public reads.
- `supabase/migrations/` — DB schema, source of truth for the backend; keep in
  sync with any schema change. `0001_init.sql` = tables, RLS, functions, triggers,
  storage bucket, seeds. `0002_hardening.sql` = leads CHECK constraints, single-
  featured trigger, `updated_at`, indexes. `RUNBOOK.md` — key rotation + new-project
  setup. `supabase/functions/send-invoice/` — Resend edge function (rebuilt in repo).
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
