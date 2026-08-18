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
   The repo's own copy, `INFINITY RIO RANCH - Rental Agreement.pdf`, is the one
   to upload — it is what `scripts/agreement-preview.mjs` reads, so a bucket that
   has drifted from it means the preview no longer shows what clients receive.
   **Editing the document is an upload, not a deploy**: the function downloads
   the template on every send, so a re-upload takes effect on the next email with
   nothing to redeploy.
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

**Wording changes go into the template PDF, not into the code.** The stamping
code fills blanks; it does not author clauses. Three edits have been made to the
document this way — all drawn into the PDF with pdf-lib and saved, so nothing
existing reflowed and every coordinate above stayed valid:

- **The opening line** on page 1. The original read "This Agreement is entered
  into on this day of ________, 20, by and between:" — no day blank, no year
  blank, sentence stopping mid-clause. It is covered with a rectangle of the
  page's cream and set again in two lines: "…on this \_\_\_\_ day of
  \_\_\_\_\_\_\_\_\_\_, 20\_\_\_\_, by and between the Venue and the Client
  identified below (the "Parties"):". This used to be redone on every send by an
  `intro` block in `agreement-fields.json`; that block is **gone** and must not
  come back — against this template its cover rectangle would strike the first
  line twice. See the `_readme` in that file.
- **Section 1E, "Event Center Cancellation"**, in the empty lower half of page 2:

  > If the Event Center is unable to host the scheduled event due to any issue,
  > problem, or unforeseen circumstance on the Event Center's side, the Event
  > Center will promptly inform the Client of the cancellation. In such a case,
  > all amounts paid by the Client toward the event booking will be fully
  > refunded.

  It sits under D. Credit Expiry at the same measure, leading and justification
  as the sections above it, in an embedded subset of Times New Roman — the face
  Word embedded for the body text, so it renders identically everywhere rather
  than relying on the reader substituting a standard font.
- **Section 3, "Photos, Video & Social Media"**, added as a whole new page 4,
  between the Property Damage Waiver page and the AGREEMENT/signature page:

  > • The Venue may take photos and video at the event, and the Client and their
  >   guests may appear in them.
  > • The Venue may use them on its website (www.infinityrioranch.com), its
  >   Instagram page (@infinity_rio_ranch) and other social media, advertising
  >   and printed material.
  > • No payment is due either way for this use, and the Venue will not sell the
  >   photos or video to anyone else.
  > • If the Client does not want their event used, they must tell the Venue in
  >   writing at least 7 days before the event.

  There was no room for it on any existing page, so it is an inserted page
  carrying the same cream ground, watermark and hairline frame as its
  neighbours — that frame is drawn per page as eight thin filled rects, and an
  added page without it reads instantly as bolted on. **Inserting a page moves
  every page after it**: `pageCount` went to 5 and `signatureClientName.page`
  from 3 to 4 in `agreement-fields.json`. Nothing would have complained if they
  hadn't — the client's name would simply have stopped appearing.

Both live only in the PDF. **If the document is ever re-exported from Word, they
are gone** along with every coordinate above — the Word source has neither.

---

## Vendor agreement PDF

The venue's *Vendor Services Agreement*, filled in at **admin → Vendors**. A
caterer, decorator, DJ or event manager gets one per event; the panel keeps the
record and prints the document. Nothing emails it — the owner downloads the PDF
and sends it themselves.

1. **Upload the template** — Dashboard → Storage → `documents` → upload the repo
   copy `INFINITY RIO RANCH - Vendor Agreement.pdf` as exactly
   **`vendor-agreement-template.pdf`**. Without it the page still opens and
   still saves; the preview pane says "No template uploaded" instead of showing
   a document.
2. **Run the migration** — `supabase/migrations/0011_vendor_agreements.sql` in
   the SQL editor. Admin-only RLS; nothing public can read or write it.
3. **Check one** — admin → Vendors → **+ New agreement** → type a business name
   and watch the document build beside the form.

**Unlike the rental agreement, this one is built in the browser** by
`src/lib/vendor-agreement.ts`, not by an edge function — there is no email to
attach it to, and building locally is what makes the preview live. There is no
function to redeploy when the template changes: a re-upload takes effect on the
next page load.

**If the template is ever re-exported, recalibrate.** No form fields here either
— every value is drawn at a coordinate in `src/lib/vendor-agreement-fields.json`:

```bash
node scripts/vendor-agreement-preview.mjs "Hill Country Catering" 2027-06-12 catering,dj
```

That writes `.vendor-agreement-preview.pdf` (gitignored) from the repo copy of
the template and the same JSON the panel reads. **Open it and look.**

Two things about this document worth knowing before editing it:

- **The panel's service names are not the form's.** The printed boxes say Food,
  Decoration, DJ and Other; the panel offers Catering, Decor, DJ and Event
  Manager, and `BOX` in `vendor-agreement.ts` maps between them — Event Manager
  ticks Other and writes its name on the line beside it. Re-label the boxes in
  the PDF one day and that map is the single place to update.
- **Every glyph in it is a Type3 procedure**, so unlike the rental agreement
  there is no embedded font to reuse for new text. Stamped values are Helvetica.

Signature and date lines are left blank on purpose, the same as the rental
agreement: both parties sign by hand.

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
