# DEPLOY.md — shipping Infinity at Rio Ranch

How the site gets to production. Keep it accurate — delete lines that go stale.
For backend/DB ops (schema, keys, new Supabase project) see `RUNBOOK.md`.

## What & where
- **App:** Vite + React SPA, static build output in `dist/`.
- **Host:** Vercel project `eshwar-uis-projects/infinity-rio-ranch`, live at
  **https://www.infinityrioranch.com** (the canonical host; the apex
  `infinityrioranch.com` redirects to www, and `infinity-rio-ranch.vercel.app`
  still resolves as the platform URL).
- **Repo:** `Eshwar-ui/infinity-rio-ranch` (gh CLI authed as `Eshwar-ui`).
  Production tracks the `main` branch.
- **Routing:** `/`, `/about`, `/gallery` and `/contact` ship as **prerendered
  static HTML** (`dist/<route>/index.html`) with their own rewrite in
  `vercel.json`; everything else (`/admin`, `/invoice/:token`) falls through the
  catch-all rewrite to `/index.html` and resolves client-side. See `SEO.md`.

## Required env vars (set in Vercel BEFORE deploying)
`src/lib/supabase.ts` throws on load if either is missing — a missing var
**white-screens the entire site**, not just the admin panel.

| Var | Value | Scope |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` | Production (+ Preview) |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_...` | Production (+ Preview) |
| `VITE_SITE_URL` | canonical origin — only if it ever changes | Production |

`VITE_SITE_URL` is optional: it defaults to `https://www.infinityrioranch.com`,
which is correct today. Set it only if the canonical host changes — every
canonical, OG URL, sitemap entry and `robots.txt` line is derived from it.

The build now **executes** app modules during prerendering, so missing Supabase
vars fail the *build* rather than white-screening at runtime.

Vercel → Project → Settings → Environment Variables. These are **build-time**
(`VITE_` vars are inlined into the bundle) — after changing them you must
**redeploy**; a running deployment won't pick up new values.

Current values live in local `.env.local` (gitignored). See `RUNBOOK.md` for
rotating them.

## Pre-flight (must pass)
```bash
npm ci            # clean install matching package-lock
npm run build     # typecheck + bundle + SSR build + prerender; fix any error before shipping
npm run lint      # oxlint; ignore design/ warnings (that's the design bundle)
```
`npm run preview` serves the built `dist/` locally — note its SPA fallback hides
the per-route prerendered files, so verify those by reading `dist/` directly.

## Deploy
Vercel auto-builds on push. Normal flow:
```bash
git push origin main          # production deploy
# or open a PR → Vercel posts a Preview URL for the branch
```
Vercel runs `npm run build` and serves `dist/`. **The Vercel CLI auth here is
interactive-only** — an agent session can't run `vercel --prod` non-interactively.
Deploy by pushing to `main` or with the **Redeploy** button in the dashboard.

## Post-deploy verification
1. Load https://infinity-rio-ranch.vercel.app — public site renders (not a white
   screen; a white screen = missing/av bad env vars).
2. Hard-refresh a sub-route (e.g. `/gallery`) — should load, not 404 (proves the
   `vercel.json` rewrite is live), and view-source should show that page's own
   `<title>` and content, not the homepage's (proves the prerender shipped).
   `curl -s https://<domain>/about | grep '<title>'` is the fast check.
3. Contact form submits → a row appears in Supabase `leads`.
4. `/admin` → login → the CMS lists content (proves keys + RLS + `is_admin()`).
5. Quick key/schema check without the app:
   ```bash
   curl -s -w "\nHTTP %{http_code}\n" \
     "https://<ref>.supabase.co/rest/v1/leads?select=id&limit=1" \
     -H "apikey: sb_publishable_..."
   ```
   `200` = keys valid + schema applied. `404 PGRST205` = schema not applied.
   `401` = wrong key/URL. (See `RUNBOOK.md` for the full response guide.)

## Rollback
Vercel keeps every deployment. Dashboard → Deployments → pick the last good one →
**Promote to Production** (instant; no rebuild). Then fix forward on a branch.

## Gotchas
- Changing Supabase env vars requires a **redeploy** — they're baked in at build.
- A brand-new Supabase project needs its **schema applied first**
  (`supabase/migrations/0001_init.sql`) or every DB call 404s even though the site
  loads. See `RUNBOOK.md`.
- Invoice email (`send-invoice` edge function) is a **separate Supabase deploy**,
  not part of the Vercel build — and its source isn't in this repo. See `RUNBOOK.md`.
