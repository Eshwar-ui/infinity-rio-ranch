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
   `convert_lead_to_client()` RPC), then `0005_client_advance_invoices.sql`
   (`clients.advance_amount`, `invoices.client_id` + `advance_paid`), then
   `0006_client_payment_status.sql` (`clients.payment_status`), then
   `0007_documents_bucket.sql` (the private `documents` bucket).
   All are safe to re-run — seeds are `NOT EXISTS` / `ON CONFLICT` / status-guarded,
   so re-running never overwrites copy or states the owner has edited.
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
8. **Know that publishing content means deploying.** There is no in-app publish
   button — the sidebar's deploy-hook panel was removed. CMS edits are live for
   human visitors at once but stay invisible to crawlers until a build runs,
   because the prerendered HTML is only rewritten when `pull:content` snapshots
   the tables. After a content change that matters for search, push to `main` or
   redeploy from the Vercel dashboard. See SEO.md §5b.

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

## Invoice email (`send-invoice` + `public-agreement` edge functions)

**There are two functions and they must be deployed together** — the email
`send-invoice` writes contains a button that only `public-agreement` can answer.

```
npx supabase functions deploy send-invoice      --project-ref xmnneacpgjwaihwcvayx
npx supabase functions deploy public-agreement  --project-ref xmnneacpgjwaihwcvayx
```

Both pull in `supabase/functions/_shared/agreement.ts` and
`agreement-fields.json`. Deploy from the repo root or the `_shared` import
doesn't resolve and the function dies with `BOOT_ERROR` at first call.

**The billing flow it serves:** invoice 1 confirms the booking and asks for the
advance, and is the only one that carries the agreement. After the event come
the extras invoice and the final payment invoice. The admin composer prefills
per stage; this function only distinguishes the first invoice from the rest.

- **`send-invoice`** — ADMIN ONLY. `{ id }` emails the client two buttons:
  **Download invoice** → `/invoice/<public_token>`, and **Download agreement** →
  `/agreement/<public_token>`. Neither document is attached. `{ id, preview: 1 }`
  returns the agreement PDF to the caller instead of sending anything, which is
  what the admin panel's per-invoice **Agreement** tab uses.
  **The agreement button only appears on a booking's first invoice** — decided
  from the rows (earliest `created_at`, then `id`), not from what the caller
  asks for, so every send path and any resend of that first invoice agree. A
  balance invoice goes out as invoice alone: one contract per booking, signed
  once. The reply carries `{ agreement, reason }` where reason is
  `follow-up` | `no-template` | `no-client`, because "the client already has it"
  and "nobody uploaded the template" must not read the same in the panel.
  A follow-up's `/agreement/<token>` URL still works if the client kept the
  earlier link; nothing is revoked, it just isn't advertised twice.
- **`public-agreement`** — deliberately UNAUTHENTICATED. `GET ?token=<public_token>`
  rebuilds that client's agreement and returns it as a download. The token is the
  credential, exactly as it already is for the invoice page. It is a separate
  function because `verify_jwt` is per-function: serving this route from
  `send-invoice` would drop the admin check from the send path.
- **`verify_jwt` is pinned in `supabase/config.toml`**, not passed as a CLI flag,
  so it can't be lost on a redeploy. If you ever deploy from somewhere without
  that file, `public-agreement` needs `--no-verify-jwt` or every button 401s.
- **`/agreement/:token` is a rewrite in `vercel.json`** onto the function URL, so
  the link in the email is on the venue's own domain. A contract download
  pointing at a `supabase.co` host reads as phishing and filters treat it that
  way. Changing the Supabase project ref means changing that rewrite.
- Until they're deployed, the admin "Email client" button fails gracefully
  ("email service may not be configured") — everything else works.
- Secrets `send-invoice` needs (Dashboard → Edge Functions → Secrets):
  `RESEND_API_KEY`, `INVOICE_FROM` (e.g. `Infinity Rio Ranch <invoices@domain>`,
  domain verified in Resend), `SITE_URL` (e.g. `https://www.infinityrioranch.com`
  — the agreement button is built from it, so a wrong value breaks the link).
  Optional: `INVOICE_REPLY_TO`. `public-agreement` needs none.

---

## Rental agreement PDF

Every invoice emailed for a **client** carries that client's rental agreement,
with their name, event date and event type stamped onto the venue's own PDF.

1. **Upload the template** — Dashboard → Storage → `documents` (created by
   `0007_documents_bucket.sql`, private) → upload the blank agreement as exactly
   **`rental-agreement-template.pdf`**. Without it, invoices still send; the
   toast says "no agreement attached (no template uploaded)".
2. **Check one** — admin → Clients → pick a client → an invoice's **Preview** →
   the **Agreement** tab. That renders the exact PDF the email would attach,
   with a Download beside it. Every failure is written into the panel as well as
   toasted, so "no template uploaded" is readable after the toast has gone.

**If the template is ever re-exported or re-edited, recalibrate.** The PDF has no
form fields, so each value is drawn at a fixed coordinate in
`supabase/functions/_shared/agreement-fields.json`. Change the document and those
coordinates go silently wrong — a client receives a contract with their name
across the middle of a sentence, and nothing errors. After any change:

```bash
node scripts/agreement-preview.mjs "Client Name" 2027-06-12 Wedding
```

That writes `.agreement-preview.pdf` (gitignored) using the same JSON the
function reads. **Open it and look**, adjust the coordinates, repeat. Then
re-upload the template and redeploy the function.

Only the three page-1 blanks and the page-4 client name are filled. The signing
dates are left blank on purpose — "on this __ day of ____, 20__" and both
`Date:` lines — they're the date of *signing*, which isn't known when the email
goes out, and the client fills them in by hand with the signatures.

**The opening line is rewritten, not filled.** The template's own wording is
broken — it reads "This Agreement is entered into on this day of ________, 20,
by and between:", with no day blank, no year blank and the sentence stopping
mid-clause. The `intro` block in `agreement-fields.json` covers that line with a
rectangle of the page's cream and sets it again in two lines:

> This Agreement is entered into on this \_\_\_\_ day of \_\_\_\_\_\_\_\_\_\_, 20\_\_\_\_,
> by and between the Venue and the Client identified below (the "Parties"):

That patch is coordinate-based like everything else here, so it only draws when
the template still has 4 pages at 595.32 × 841.92 — on anything else the opening
line is left alone, because a misplaced cover rectangle could hide a clause. **If
you upload a template with the wording already corrected, delete the `intro`
block** or the fixed line gets covered by a second copy of itself.

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
