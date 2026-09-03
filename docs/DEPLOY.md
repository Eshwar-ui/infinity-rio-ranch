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
| `GOOGLE_BUSINESS_PROFILE_CLIENT_ID` | OAuth 2.0 client ID | Production (+ Preview) |
| `GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET` | OAuth 2.0 client secret | Production (+ Preview) |
| `GOOGLE_BUSINESS_PROFILE_REFRESH_TOKEN` | Offline refresh token for the profile owner/manager | Production (+ Preview) |
| `GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID` | Business Profile account ID, with or without `accounts/` | Production (+ Preview) |
| `GOOGLE_BUSINESS_PROFILE_LOCATION_ID` | Infinity Rio Ranch location ID, with or without `locations/` | Production (+ Preview) |

`VITE_SITE_URL` is optional: it defaults to `https://www.infinityrioranch.com`,
which is correct today. Set it only if the canonical host changes — every
canonical, OG URL, sitemap entry and `robots.txt` line is derived from it.

The build now **executes** app modules during prerendering, so missing Supabase
vars fail the *build* rather than white-screening at runtime.

Vercel → Project → Settings → Environment Variables. The `VITE_` variables are
**build-time** and inlined into the browser bundle. The Business Profile values
are server-only runtime variables used by the Vercel Function. After changing
either set, redeploy so every function instance receives the current values.

Current values live in local `.env.local` (gitignored). See `RUNBOOK.md` for
rotating them.

### Google reviews

The Home page loads reviews through the server-only `/api/google-reviews`
Vercel Function using the Google Business Profile APIs:

1. The Google account used for OAuth must own or manage the verified Infinity
   Rio Ranch profile. Request Business Profile API access for the Google Cloud
   project; Google currently requires an active verified profile and a valid
   business website.
2. After approval, enable **Google My Business API**, **My Business Account
   Management API**, and **My Business Business Information API**.
3. Configure an OAuth consent screen and create an OAuth 2.0 client. Authorize
   the owner/manager account with the scope
   `https://www.googleapis.com/auth/business.manage` and obtain an offline
   refresh token. Google OAuth Playground can be used for this one-business
   setup when it is configured with the project's own OAuth client credentials.
4. Retrieve the account ID from
   `GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts`, then
   retrieve the location ID from
   `GET https://mybusinessbusinessinformation.googleapis.com/v1/accounts/{accountId}/locations?readMask=name,title,metadata`.
5. Add all five `GOOGLE_BUSINESS_PROFILE_*` variables from `.env.example` to
   Vercel Production and Preview, then redeploy. For local endpoint testing,
   populate `.env.local` and run `vercel dev`.

The function verifies that the configured location resolves to Place ID
`ChIJpyGeLm3VWoYRSg2J_y46wmk`, requests up to 50 newest reviews, and sends the
newest 12 text reviews to the carousel. Review content is cached for six hours
with a 24-hour stale-on-error window. This is within Google's Business Profile
policy, which permits limited secure temporary caching for performance for no
more than 30 days. OAuth access tokens are refreshed server-side and never sent
to the browser. If credentials, approval, quota, network, or Google fail, the
public section silently retains its existing CMS testimonials.

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
