# RUNBOOK — Infinity at Rio Ranch backend

Operational steps for the Supabase backend + Vercel deploy. Keep it accurate —
delete lines that go stale.

The schema is versioned at [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
It was reconstructed from the app code after the original Supabase project
(`fgzztabgzoxuwkknpdmu`) was deleted — **the schema now lives in the repo so this
can't happen again.** Any schema change must be added there, not applied
ad-hoc to the live project only.

---

## Stand up a NEW Supabase project (full recovery / migration)

Do this when the Supabase project is gone or you're moving to a fresh one.

1. **Create the project** — Supabase Dashboard → New project. Note its ref
   (the `<ref>` in `https://<ref>.supabase.co`), region, and org.
2. **Apply the schema** — SQL Editor → New query → paste and Run each migration
   **in order**: `0001_init.sql` (tables, RLS, `is_admin()`, invoice numbering,
   the `get_invoice_by_token` RPC, the `gallery` storage bucket, seed content),
   then `0002_hardening.sql` (leads CHECK constraints, single-featured trigger,
   `updated_at`), then `0003_page_content.sql` (`site_copy`, `stats`,
   `amenities`, `list_items`, `site_settings` + the shipped page copy), then
   `0004_clients.sql` (`clients`, the `converted` lead status and the
   `convert_lead_to_client()` RPC).
   All four are safe to re-run — seeds are `NOT EXISTS` / `ON CONFLICT`-guarded,
   so re-running never overwrites copy the owner has edited.
3. **Create the admin user** — Dashboard → Authentication → Users → Add user,
   tick **Auto Confirm User**. (Passwords are the owner's to set — never scripted.)
4. **Promote them to admin** — SQL Editor, with the real email:
   ```sql
   insert into public.admin_users (user_id)
   select id from auth.users where email = 'YOUR_EMAIL_HERE';
   ```
5. **Update env vars** (both places — see next section).
6. **Redeploy** on Vercel so production picks up the new keys.
7. **Rebuild the edge function** if invoice email is needed (see below).
8. **Set the deploy hook** — Vercel → Project Settings → Git → Deploy Hooks →
   create one, then paste it into the admin sidebar's "Publish to live site"
   panel (stored in `site_settings`). Without it, CMS edits stay invisible to
   crawlers until someone deploys by hand: the prerendered HTML is only rewritten
   during a build, when `pull:content` snapshots the tables. See SEO.md §5b.

---

## Rotate / update API keys

New-style publishable keys look like `sb_publishable_...`; the URL is
`https://<ref>.supabase.co`. Both come from Dashboard → Project Settings →
API (Data API).

- **Local dev** — edit `.env.local`:
  ```
  VITE_SUPABASE_URL="https://<ref>.supabase.co"
  VITE_SUPABASE_ANON_KEY="sb_publishable_..."
  ```
  `.env.local` is gitignored — never commit keys.
- **Production** — Vercel → Project → Settings → Environment Variables →
  update `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` → **Redeploy**.
  `src/lib/supabase.ts` throws on load if either is missing, white-screening the
  whole site — so set them *before* deploying.

### Verify a URL + key pair without the app
PostgREST accepting the key but reporting the table proves the pair is valid:
```bash
curl -s -w "\nHTTP %{http_code}\n" \
  "https://<ref>.supabase.co/rest/v1/leads?select=id&limit=1" \
  -H "apikey: sb_publishable_..."
```
- `200 []` (or rows) → keys valid **and** schema applied.
- `404 PGRST205 "Could not find the table"` → keys valid, **schema not applied yet**.
- `401` → key/URL pair is wrong.
- A `401 "Secret API key required"` at the bare `/rest/v1/` root is **normal** for
  publishable keys — that endpoint only accepts secret keys. Test a table instead.

---

## Invoice email (`send-invoice` edge function)

- **The function source is NOT in this repo** — it was deployed directly to the
  old (now-deleted) project via MCP. On a fresh project it must be **rebuilt from
  scratch.** What it did: take `{ id }`, load the invoice, and email the client
  (via Resend) a link to `/invoice/<public_token>`. See `admin-plan.md` Phase 5.
- Until it exists, the admin "Email client" button fails gracefully
  ("email service may not be configured") — everything else works.
- Secrets it needs (Dashboard → Edge Functions → send-invoice → Secrets):
  `RESEND_API_KEY`, `INVOICE_FROM` (e.g. `Infinity Rio Ranch <invoices@domain>`,
  domain verified in Resend), `SITE_URL` (e.g. the Vercel URL).

---

## Seed / content notes

- Seed rows come from `src/data/site.ts` and are re-inserted only if the table is
  empty. The public site falls back to `site.ts` when the DB is empty/unreachable,
  so it never renders blank — but the admin CMS starts empty without seeds.
- Gallery seed `src` paths point at bundled app assets (`/assets/site/...`,
  `/assets/img/venue-*.jpg`), **not** Supabase Storage. Photos uploaded through the
  admin panel go to the `gallery` bucket. There is nothing to copy into Storage on
  a new project — those seed images ship with the app.

---

## Deploy (Vercel)

- Project `eshwar-uis-projects/infinity-rio-ranch`, live at
  https://infinity-rio-ranch.vercel.app. `vercel.json` handles SPA rewrites.
- Vercel CLI auth is interactive-only — deploys can't be driven non-interactively
  from an agent session. Push to `main` (repo `Eshwar-ui/infinity-rio-ranch`) or
  deploy from the dashboard.
- `npm run build` (`tsc -b` + vite) must pass before shipping.
