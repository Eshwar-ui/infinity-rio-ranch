# DEPLOY.md — shipping Infinity at Rio Ranch

How the site gets to production. Keep it accurate — delete lines that go stale.
For backend/DB ops (schema, keys, new Supabase project) see `RUNBOOK.md`.

## What & where
- **App:** Vite + React SPA, static build output in `dist/`.
- **Host:** Vercel project `eshwar-uis-projects/infinity-rio-ranch`, live at
  https://infinity-rio-ranch.vercel.app.
- **Repo:** `Eshwar-ui/infinity-rio-ranch` (gh CLI authed as `Eshwar-ui`).
  Production tracks the `main` branch.
- **SPA routing:** `vercel.json` rewrites every path to `/index.html` so
  client-side routes (`/gallery`, `/admin`, `/invoice/:token`) resolve on refresh.

## Required env vars (set in Vercel BEFORE deploying)
`src/lib/supabase.ts` throws on load if either is missing — a missing var
**white-screens the entire site**, not just the admin panel.

| Var | Value | Scope |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` | Production (+ Preview) |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_...` | Production (+ Preview) |

Vercel → Project → Settings → Environment Variables. These are **build-time**
(`VITE_` vars are inlined into the bundle) — after changing them you must
**redeploy**; a running deployment won't pick up new values.

Current values live in local `.env.local` (gitignored). See `RUNBOOK.md` for
rotating them.

## Pre-flight (must pass)
```bash
npm ci            # clean install matching package-lock
npm run build     # tsc -b && vite build — typecheck + bundle; fix any error before shipping
npm run lint      # oxlint; ignore design/ warnings (that's the design bundle)
```
`npm run preview` serves the built `dist/` locally to sanity-check before deploy.

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
   `vercel.json` rewrite is live).
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
