-- ============================================================================
--  0011_vendor_agreements.sql — the vendor side of a booking.
--
--  A caterer, decorator or DJ working an event signs the venue's Vendor
--  Services Agreement. This table is the record of one such agreement: the
--  details the owner types in the admin panel, which are then stamped onto the
--  template PDF (`documents/vendor-agreement-template.pdf`) for printing.
--
--  ADMIN-ONLY, top to bottom. Unlike `leads`, nothing on the public site ever
--  writes here — there is no anon INSERT policy and there should never be one.
--  Vendors are people the venue deals with directly, and their phone numbers
--  and emails are not a form the internet gets to fill in.
--
--  The document is built in the browser from these columns rather than stored
--  as a file: the template can be replaced by uploading a new one, and every
--  past agreement then re-prints from the new wording. A PDF saved at signing
--  time would freeze the old wording and double the places a correction has to
--  be made.
--
--  Run once in the SQL editor, on top of 0010. Safe to re-run.
-- ============================================================================

create table if not exists public.vendor_agreements (
  id                uuid primary key default gen_random_uuid(),
  business_name     text not null,
  contact_person    text,
  phone             text,
  email             text,
  client_event_name text,
  -- 'catering' | 'decor' | 'dj' | 'event_manager' — the venue's four kinds of
  -- vendor. An array because a caterer who also runs the decor ticks two.
  --
  -- These are the venue's words, not the template's: the printed form has boxes
  -- for Food, Decoration, DJ and Other, and src/lib/vendor-agreement.ts maps
  -- each value onto one of them (event_manager ticks Other and writes its name
  -- on the line). Storing the venue's vocabulary means re-labelling the PDF one
  -- day doesn't require rewriting every row.
  service_types     text[] not null default '{}',
  -- The date on the agreement itself, and the date of the event worked. Both
  -- nullable: a vendor is often recorded before either is settled.
  agreement_date    date,
  event_date        date,
  vendor_rep_name   text,
  venue_rep_name    text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Only the four known services are valid, so a typo in the app can't store a
-- service the printed form has no square for.
alter table public.vendor_agreements
  drop constraint if exists vendor_agreements_service_types_valid;
alter table public.vendor_agreements
  add constraint vendor_agreements_service_types_valid
  check (service_types <@ array['catering', 'decor', 'dj', 'event_manager']::text[]);

create index if not exists vendor_agreements_event_date_idx
  on public.vendor_agreements (event_date desc nulls last);
create index if not exists vendor_agreements_business_name_idx
  on public.vendor_agreements (business_name);

drop trigger if exists touch_vendor_agreements on public.vendor_agreements;
create trigger touch_vendor_agreements
  before update on public.vendor_agreements
  for each row execute function public.touch_updated_at();

alter table public.vendor_agreements enable row level security;

drop policy if exists "admins manage vendor agreements" on public.vendor_agreements;
create policy "admins manage vendor agreements"
  on public.vendor_agreements for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
