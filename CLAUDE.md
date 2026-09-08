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
- `npm run lint` — oxlint. The archived `design/` handoff is excluded.
- `node scripts/agreement-preview.mjs` / `node scripts/vendor-agreement-preview.mjs`
  — stamp sample values onto the two contract templates and write a local PDF.
  Run and *look at* the output after touching a template or its field map.
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
- **Publishing is a rebuild, and there is no button for it.** Saving in the admin
  panel updates the DB — instant for JS visitors, invisible to crawlers until the
  next build, because only a build runs `pull:content` and rewrites the
  prerendered HTML. Closing that gap is a deploy: push to `main` (Vercel builds
  from it) or redeploy in the Vercel dashboard. There *was* a "Publish to live
  site" button in the sidebar backed by a deploy hook in `site_settings`; it was
  removed at the owner's request, never configured in practice. If it comes back,
  the hook belongs in `site_settings` and **never** in a `VITE_` var — the admin
  chunk is lazy but still served to anyone, so that would be a public rebuild
  button. The `site_settings` table and its RLS remain in 0003.
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
- **No native `<select>` or `<datalist>`, anywhere, admin or public.**
  `src/components/ui/select.tsx` owns both replacements: `<Select>` (a listbox)
  and `<SuggestInput>` (an input that suggests but accepts anything typed, where
  the list is CMS-editable and old rows keep values since renamed). The OS draws
  a native popup in system colours, so it ignored the theme in both directions —
  a white menu falling out of the dark public form, unreadable light-on-light
  options in the dark admin — and an `<option>` holds text and nothing else,
  which is why the filter counts had to be crammed into the label string.
  What the native control gave free is built back rather than dropped: the full
  keyboard model (arrows, Home/End, Enter, Escape, Tab, type-ahead), the listbox
  ARIA pattern with `aria-activedescendant` so focus stays on the trigger, and a
  **portal to `document.body`** — every one of these sits inside a scrolling pane
  or an `overflow-hidden` card that would otherwise clip it. Pass `className` for
  the trigger (`field` in the admin) and always an `ariaLabel`: the trigger is a
  `<button>`, so a nearby `<label>` doesn't name it.
- **Appending a width to a shared class string doesn't work.** `field` carries
  `w-full`, and Tailwind emits `.w-full` *after* `.w-16`/`.w-24` in the sheet, so
  `` `${field} w-24` `` silently renders full width — this shipped twice (the
  CMS "Order" input, the invoice line items). Size the *wrapper* instead. Same
  trap for any conflicting pair in one string.
- **List views share one filter toolbar** (`components/admin/list-filters.tsx`):
  search + one dropdown per filter, docked above the list it filters rather than
  floating in the page header. Counts ride in the option labels ("Paid (6)") and
  are computed against the *other* active filters, so "Paid (6)" can't sit above
  a list of two. `FilterGroup` is a **native `<select>`** — the segmented row it
  replaced grew with the option list and didn't read as clickable. Native buys
  keyboard/type-ahead/mobile pickers and an OS-drawn popup that can't be trapped
  by an `overflow` ancestor; the cost is that the popup ignores styling, so
  `<option>` must carry an explicit `bg-panel`/`text-cream` or the light theme's
  colours leak into the dark one.
- **Clients are a list route and a page route, like invoices.** `/admin/clients`
  (`pages/admin/clients.tsx`) is the table and nothing else — full width, one
  horizontal filter bar (`<FilterBar row>`). One client opens at
  `/admin/clients/:id`, and `/admin/clients/new` is the same component with a
  blank draft (`pages/admin/client-detail.tsx`); the row type, status colours
  and money helpers both views share live in `pages/admin/client-shared.ts`.
  Converting a lead navigates to `/admin/clients/<new id>` — there is no
  `?id=` param any more.
- **The client page is a profile, not a form.** Read-only by default behind an
  Edit toggle; status writes straight through on click. **Billing owns the main
  column** — the money band and then the invoice panel — because opening a client
  is almost always on the way to raising or sending one. The booking (event,
  contact, booking status, notes) is the sticky rail beside it, read while
  working rather than the reason you came. `client-invoice-panel.tsx` is laid out
  for that main-column width now, not the ~420px rail it used to sit in.
  **Both client-facing documents preview in place**, in a viewer under the
  invoice list with Invoice/Agreement tabs: the invoice tab iframes the real
  `/invoice/:token` page (same origin, so `X-Frame-Options: SAMEORIGIN` allows
  it) and the agreement tab iframes the PDF the `send-invoice` preview branch
  returns, held as one object URL at a time and revoked on close. Neither is a
  mock-up of the document — a preview that only resembles what gets sent is
  worth nothing as a check.
  Sections keep their place when empty — a Notes block that disappears is a block
  nobody remembers exists. Invoices are raised in
  place via `components/admin/client-invoice-panel.tsx`, which only ever
  *creates* — editing an existing invoice stays in `invoice-editor.tsx`, which
  owns the number, the public token and the send state. `/admin/invoices/new`
  also takes `?client=<uuid>` and prefills from that client.
- **The invoice email links, it never attaches.** Two buttons: **Download
  invoice** → `/invoice/<public_token>` (the existing page, which has its own
  Print / Save PDF) and **Download agreement** → `/agreement/<public_token>`,
  a `vercel.json` rewrite onto the **`public-agreement`** edge function. That
  function is deliberately unauthenticated — the invoice's `public_token` is the
  credential, the same claim `get_invoice_by_token` already makes — and it is a
  *separate function from `send-invoice`* because `verify_jwt` is per-function:
  serving the public route from `send-invoice` would drop the admin check from
  the send path. `verify_jwt` for both is pinned in `supabase/config.toml` so a
  redeploy can't silently flip it. Deploy the two together; the email contains a
  button only the other one can answer. Keep the agreement *built* in
  `send-invoice` even though it's no longer attached — whether it can be built
  is what decides if the button is rendered, and a dead link to a contract is
  worse than no link.
- **A booking is billed in three stages, and the composer knows them.** The
  venue's own flow, not an invented taxonomy:
  1. **Advance** — sent when the booking is taken. Bills the deposit that holds
     the date, credits nothing (this invoice *is* the request for that money),
     and its email doubles as the booking confirmation and carries the agreement
     to sign.
  2. **Extra charges** — after the event, for anything beyond the package.
     Deliberately prefills empty: only the owner knows what happened on the night.
  3. **Final payment** — bills the agreed amount and credits the deposit that
     hasn't been credited anywhere else, so the document reconciles the whole
     booking ("$500 total, less $300 advance, $200 due") and the invoices add up
     to the booking rather than to twice it.
  `Purpose` in `client-invoice-panel.tsx` is the stage; the composer picks a
  default from the rows (no invoices → advance; a balance left → final;
  otherwise extras) and states what it prefilled and why, because an amount that
  appears by itself has to explain itself. All three are defaults, overwritable
  by typing.
- **The agreement goes out once per booking, with the first invoice.** A couple
  signs one contract; a balance invoice carrying a second copy invites them to
  sign it twice, and the one they return may be the wrong one. `send-invoice`
  decides from the rows (the booking's earliest invoice by `created_at`, then
  `id`), never from a flag the caller passes, so the client panel, the full
  editor and a resend of that first invoice all reach the same answer. It
  answers `{ agreement, reason }` and the panel prints a different sentence for
  each reason — `follow-up` is the design working, `no-template` is a job left
  undone, and one message for both is how an owner learns to ignore the message.
  A preview always builds, whichever invoice is open: that's the owner checking
  their own paperwork.
- **The rental agreement is stamped, not templated.** The agreement PDF carries
  the client name, event date and event type drawn onto the venue's own template
  (`supabase/functions/_shared/agreement.ts`). The template has **no form
  fields**, so every value sits at a fixed coordinate in
  `agreement-fields.json`; re-exporting the PDF silently invalidates all of them
  and nothing errors. `node scripts/agreement-preview.mjs` renders a local copy
  from that same JSON — look at it after any change. What the function reads is
  the copy in the private `documents` bucket (0007), so replacing it is an
  upload; `INFINITY RIO RANCH - Rental Agreement.pdf` at the repo root is the
  same file, is what the preview script reads, and the two must be kept in step.
  No template = invoice still sends, toast says so. Signing dates are
  deliberately left blank for hand-signing. Full procedure in `docs/RUNBOOK.md`.
  **New wording goes into the PDF, never into the code** — the code fills blanks,
  it doesn't author clauses, and a clause drawn at send time is one the owner
  can't read in their own copy of the contract. The edits made so far (the
  opening line below; section 1E "Event Center Cancellation" in page 2's empty
  lower half; section 3 "Photos, Video & Social Media", drawn as a whole new
  page between the Property Damage Waiver page and the AGREEMENT/signature page;
  and section 4 "Rental Period, Package Hours & Grace Period", drawn into the
  blank lower half of the section-3 page itself) were drawn into the document
  with pdf-lib and saved, which reflows nothing and so leaves every coordinate
  valid. **Inserting a page still moves every page after it**, though: adding
  section 3 took `pageCount` to 5 and `signatureClientName.page` from 3 to 4,
  and nothing would have complained if they hadn't moved — the name would just
  have been stamped onto the new page. Section 4 avoided that risk entirely by
  reusing section 3's own already-blank space instead of inserting another
  page — no `pageCount` bump, no field-page shift. It states the half-day
  (8h) / full-day (12h) package hours (setup + event + teardown all inside
  that window), the 45-minute grace period, and the $100 flat decor-teardown
  charge / $300-per-hour event-continuation charge, and says it governs "in
  place of" the AGREEMENT page's older "past 12:00 AM" Extended Hours Policy —
  deliberately worded as a supersession rather than an edit, since covering and
  redrawing text on that page would mean fighting its watermark and cream fill
  to match the background exactly.
  Set new text in an embedded subset of the real Times New Roman rather than
  `StandardFonts.TimesRoman` — via `@pdf-lib/fontkit` (a devDependency) and a
  system copy of `times.ttf`/`timesbd.ttf` (e.g. `C:\Windows\Fonts` on Windows);
  the font file itself is never committed, only the subset pdf-lib bakes into
  the saved template — and match the page's own measure and leading: body
  text is 14pt on 18.5pt leading, paragraphs at x=94.5 and bullets at x=130.3,
  **left-aligned, ragged right** (the widest line in the document ends at x≈537,
  well short of the others) — a clause that renders as substituted Times, or
  justified against ragged neighbours, reads as bolted on.
  The template's **opening line used to be broken** ("...on this day of
  ________, 20, by and between:" — no day blank, no year blank, sentence
  unfinished) and was patched at run time by an `intro` block that covered and
  redrew it. That is **done**: the corrected line is baked into the template PDF
  and the block is deleted. Don't reintroduce it — the cover rectangle reaches
  the second line but not the first, so a second pass double-strikes line one.
  `pageSize`/`pageCount` stay in the JSON because `looksLikeKnownTemplate()`
  still reads them. Nothing draws a rectangle any more; if something ever does
  again, it must keep that guard, since a value in the wrong place is still
  readable but a rectangle in the wrong place can hide a clause.
  Names are title-cased **at the point of drawing** (`titleCaseName`), never in
  the DB — the owner's record stays as they typed it and only the contract is
  presented. It only ever *adds* capitals: lowercasing the rest would turn
  `McDonald` into `Mcdonald` and a `III` suffix into `Iii`, and a wrong name on
  a legal document beats an unconverted one. All-caps input therefore survives.
- **The vendor agreement is the same idea, built in the browser.** A caterer,
  decorator, DJ or event manager working an event signs the venue's *Vendor
  Services Agreement*; `/admin/vendors` lists those agreements and
  `/admin/vendors/:id` is one of them — the details as a form on the left, the
  real PDF rebuilt beside it as you type. Differences from the rental one, all
  deliberate:
  - **It is generated client-side** (`src/lib/vendor-agreement.ts`, plain
    `pdf-lib`), not in an edge function. Nothing emails a vendor agreement, so
    there is no server to need it, and building locally is what makes the
    preview live instead of a round trip per keystroke. The template still lives
    in the private `documents` bucket as **`vendor-agreement-template.pdf`**,
    which an admin can read under 0007's RLS.
  - **`vendor-services.ts` exists only to keep `pdf-lib` out of the list.** The
    four service names were imported from `vendor-agreement.ts`, which put 400 kB
    of PDF library into the chunk anyone opening the table downloads. Names live
    in the light module; the builder re-exports them.
  - **The panel's words and the paper's words are different, and the map is in
    code.** The form prints Food / Decoration / DJ / Other; the venue books
    Catering / Decor / DJ / Event Manager. `BOX` in `vendor-agreement.ts` ticks
    the right square, and an Event Manager ticks Other and gets its name written
    on the line beside it. The DB stores the venue's vocabulary, so re-labelling
    the PDF one day doesn't mean rewriting rows.
  - **This template is drawn, not typeset** — every glyph is a Type3 procedure,
    so there is no font in it to reuse. Values are set in Helvetica; don't
    "match" it with Times.
  - One clause has been drawn into it since: an unnumbered "Rental Period,
    Package Hours & Grace Period" section in the blank space below "06
    Indemnification" on page 2, mirroring the rental agreement's section 4 —
    same half-day (8h) / full-day (12h) package hours, 45-minute grace period,
    $100 flat decor-teardown charge and $300/hour event-continuation charge.
    Unlike the rental agreement there was no older extended-hours dollar figure
    to conflict with — "04 Venue Rules" only ever said "subject to availability
    and prior approval" — so this one was a pure addition, no supersession
    wording needed. Drawn in plain Helvetica per the rule above, not baked-in
    Type3, so it reads slightly different from the template's own headings;
    that mismatch is accepted, not fixed.
  - Coordinates in `src/lib/vendor-agreement-fields.json`, checked with
    `node scripts/vendor-agreement-preview.mjs`, which reads the repo copy
    `INFINITY RIO RANCH - Vendor Agreement.pdf`. Same rule as the rental one: the
    repo copy and the bucket copy must be kept in step, and a re-export
    invalidates every coordinate silently.
  - Nothing public ever writes `vendor_agreements` (0011) — admin-only RLS, no
    anon INSERT policy, unlike `leads`.
- **Invoice numbers are DB-assigned.** A `BEFORE INSERT` trigger pulls from a
  sequence (`INV-YYYY-0001`) — never generate numbers in JS (races).
- **Client-facing invoice** (`/invoice/:token`) reads via the `get_invoice_by_token`
  security-definer RPC — the invoices table stays admin-only under RLS.
- Admin + invoice pages are `React.lazy` chunks in `src/App.tsx` so public visitors
  don't download them. Keep new admin code lazy.
- **Google reviews come from the Business Profile v4 API, and it is gated on an
  approval.** `api/google-reviews.ts` is a Vercel Function that exchanges the
  five `GOOGLE_BUSINESS_PROFILE_*` vars for a `business.manage` token and reads
  `mybusiness.googleapis.com/v4/.../reviews`; `testimonials.tsx` fetches it and
  falls back to CMS testimonials on any failure, so the section never breaks.
  Two facts stop this being re-diagnosed from scratch. Reviews live **only** on
  that legacy v4 endpoint — the My Business *Business Information* and *Account
  Management* APIs have no reviews method, so enabling them buys nothing. And
  until Google grants the project Business Profile API access, the quota for
  every `mybusiness*` API is `0`, so the **first** call of each minute 429s with
  `quota_limit_value: "0"` and the Cloud dashboard reads a flat 100% error rate
  — which looks like broken credentials and isn't: the token exchange succeeds
  with the right scope while every data call still fails. Nothing in code can
  lift that; it needs the access-request form (project number, managing account,
  verified profile). Procedure in `docs/DEPLOY.md`.
  The Place ID check **throws** rather than warns, deliberately: the lookup is by
  account/location ID, so a mismatch means the wrong location is configured and
  the alternative is publishing another business's reviews.
  `pageSize=50` is the v4 per-request maximum and a page counts star-only
  ratings that get dropped for having no comment, so the function follows
  `nextPageToken` to reach `REVIEW_LIMIT` (50) text reviews — bounded by
  `MAX_REVIEW_PAGES` and `PAGINATION_BUDGET_MS` so a slow Google can't push it
  past the function execution limit; the 6-hour cache means one request pays it.
  Places API (New) was evaluated as the way around the approval and rejected by
  the owner: it needs no allowlist but caps at 5 reviews with no pagination. That
  implementation is in git history (`api/google-reviews.ts`, Sept 2026) if the
  approval never lands.
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
  happened once; see "The `public/` trap" in `docs/SEO.md`.
- **No catch-all rewrite in `vercel.json`.** A `/(.*)` → `/index.html` rule makes
  every unknown URL return 200 with the homepage's HTML (soft 404s at unbounded
  URLs). Unknown paths must fall through to `dist/404.html`. `App.tsx` and
  `entry-server.tsx` both route `path="*"` to `NotFoundPage`; the prerender
  script fails the build if a catch-all reappears.
  Photos must be real `<img>` with alt text — background images are unindexable.
  Full write-up in `docs/SEO.md`.
- **`vercel.json` takes no comments, and a stray key fails the deploy silently.**
  Vercel validates the file against a strict schema, so a `"//": "…"` note inside
  a `headers` or `rewrites` entry doesn't deploy with a warning — the build is
  *rejected*, the last good deployment keeps serving, and the site simply never
  changes. Three commits shipped into that hole before anyone noticed. Notes
  about the config belong here, not in it.
  Two of those notes worth keeping: `/assets` is cached 30 days rather than a
  year immutable because `optimize:images` re-encodes photos **in place** under
  the same filename, so a year would freeze a replaced photo in returning
  browsers. And fonts can't have a longer rule of their own — a second entry
  matching `/assets/fonts/*` is ignored whether ordered before or after the
  broad one, and a negative lookahead in `source` (`/assets/((?!fonts/).*)`)
  still matches font paths. Both were tried and checked against a cache-MISS
  response from the deployment. Moving the fonts to a top-level `/fonts/` would
  work and isn't worth the churn for 63 kB.
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
- `src/pages/admin/vendors.tsx` the vendor agreements list, `vendor-detail.tsx` one
  agreement (form + live PDF), `vendor-shared.ts` what both read;
  `src/lib/vendor-agreement.ts` builds the document, `vendor-services.ts` the four
  service names, `vendor-agreement-fields.json` where each value lands.
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
  `docs/RUNBOOK.md` — key rotation + new-project setup. `supabase/functions/send-invoice/` — Resend edge function (rebuilt in repo).
- Supabase edge function `send-invoice` (Resend) sends the client an invoice link.
  **Its source is not in the repo** (deployed directly) — must be rebuilt from
  scratch on a fresh project; see `docs/RUNBOOK.md`.

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
  `admin_users` (steps in `docs/admin-plan.md`).
- Set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in Vercel **before deploying** —
  `src/lib/supabase.ts` throws on load without them, white-screening the whole site.
- Invoice email needs `RESEND_API_KEY`, `INVOICE_FROM`, `SITE_URL` as `send-invoice`
  edge-function secrets.

## Project facts & references
- **Origin:** converted from the archived Claude Design handoff in `design/`, not
  via DesignSync MCP. Built to the bencium code conventions. Original public
  site build (Home/About/Gallery/Contact SPA) predates the backend; see `docs/progress.md`.
- **Theme:** dark (default) + light + 4 accents as CSS vars in `index.css`, mapped
  into Tailwind; `[data-theme]`/`[data-accent]` set on `<html>` by the theme store.
  Fonts: Cormorant Garamond (serif) / Dancing Script (script) / Jost (body).
- **Supabase:** ref `xmnneacpgjwaihwcvayx` (`https://xmnneacpgjwaihwcvayx.supabase.co`).
  Edge function: `send-invoice`. This replaced the original project
  `fgzztabgzoxuwkknpdmu` (org `cscvnreghecmarqhgkrq`, region us-east-1) after it was
  **deleted** — which is why the schema is now versioned in
  `supabase/migrations/0001_init.sql`. Confirm the new project's region/org in the
  dashboard; recovery steps in `docs/RUNBOOK.md`.
- **Hosting:** Vercel project `eshwar-uis-projects/infinity-rio-ranch`
  live at **https://www.infinityrioranch.com** (canonical host; the apex
  redirects to www, `infinity-rio-ranch.vercel.app` is the platform URL).
  `vercel.json` handles the prerendered-route + SPA rewrites.
  Vercel CLI auth is interactive-only — can't deploy non-interactively from here.
- **Git:** private repo `Eshwar-ui/infinity-rio-ranch` (gh CLI authed as Eshwar-ui).
  `.env.local` is gitignored — keys are never committed.
- **Venue (real data):** Infinity at Rio Ranch, 326 Rio Pk Dr, Liberty Hill, TX 78642
  (Greater Austin). Contact details live in `src/data/site.ts`.

See `docs/admin-plan.md` for full backend/feature status, `docs/progress.md` for
the original site build, `docs/RUNBOOK.md` for backend ops (key rotation,
standing up a new Supabase project, rebuilding the edge function),
`docs/DEPLOY.md` for shipping to Vercel (env vars, pre-flight, verification,
rollback), and `docs/SEO.md` for search/answer-engine architecture and the open
owner-side tasks.
