-- Infinity at Rio Ranch — full backend schema
-- Reconstructed from the app code (the original project fgzztabgzoxuwkknpdmu was deleted).
-- Paste this whole file into the new project's SQL editor (Dashboard → SQL Editor → New query → Run).
-- Idempotent-ish: safe to run once on an empty project. Order matters — run top to bottom.

-- ============================================================================
-- 1. Admin allowlist + is_admin() (must exist before any RLS policy references it)
-- ============================================================================
create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- A user is "admin" only if their id is in admin_users. SECURITY DEFINER so RLS
-- policies can call it without the caller needing to read admin_users directly.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

alter table public.admin_users enable row level security;
create policy "admins read allowlist"
  on public.admin_users for select
  using (public.is_admin());

-- ============================================================================
-- 2. Leads (contact form)
-- ============================================================================
create table if not exists public.leads (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  phone      text,
  event_date date,
  type       text,
  message    text,
  status     text not null default 'new'
             check (status in ('new', 'read', 'replied', 'archived')),
  created_at timestamptz not null default now()
);

alter table public.leads enable row level security;

-- Public site (anon key) may only INSERT; admins do everything.
create policy "anyone can submit a lead"
  on public.leads for insert
  with check (true);
create policy "admins manage leads"
  on public.leads for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================================
-- 3. CMS content tables (testimonials / events / faqs / gallery)
--    Pattern: public reads published rows; admins do everything.
-- ============================================================================
create table if not exists public.testimonials (
  id         uuid primary key default gen_random_uuid(),
  quote      text not null,
  name       text not null,
  event      text,
  published  boolean not null default true,
  sort       integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  blurb      text,
  image      text,
  published  boolean not null default true,
  sort       integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.faqs (
  id         uuid primary key default gen_random_uuid(),
  question   text not null,
  answer     text not null,
  published  boolean not null default true,
  sort       integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.gallery (
  id         uuid primary key default gen_random_uuid(),
  label      text not null,
  cat        text not null,
  src        text not null,
  span       text check (span in ('tall', 'wide')),  -- null = normal tile
  featured   boolean not null default false,
  published  boolean not null default true,
  sort       integer not null default 0,
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['testimonials', 'events', 'faqs', 'gallery'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format(
      'create policy "public reads published" on public.%I for select using (published = true);', t);
    execute format(
      'create policy "admins do everything" on public.%I for all using (public.is_admin()) with check (public.is_admin());', t);
  end loop;
end $$;

-- ============================================================================
-- 4. Invoices + line items (admin-only under RLS; DB-assigned sequential number)
-- ============================================================================
create sequence if not exists public.invoice_seq;

create table if not exists public.invoices (
  id            uuid primary key default gen_random_uuid(),
  number        text unique,                              -- assigned by trigger below
  client_name   text not null,
  client_email  text,
  client_address text,
  issue_date    date not null default current_date,
  due_date      date,
  status        text not null default 'draft'
                check (status in ('draft', 'sent', 'paid')),
  tax_rate      numeric not null default 0,               -- percent
  notes         text,
  public_token  uuid not null unique default gen_random_uuid(),
  created_at    timestamptz not null default now()
);

create table if not exists public.invoice_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices (id) on delete cascade,
  description text,
  qty         numeric not null default 0,
  unit_price  numeric not null default 0,
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists invoice_items_invoice_id_idx on public.invoice_items (invoice_id);

-- Atomic INV-YYYY-0001 numbering (never generate in JS — races).
create or replace function public.set_invoice_number()
returns trigger
language plpgsql
security definer            -- so nextval runs as owner regardless of caller
set search_path = public
as $$
begin
  if new.number is null then
    new.number := 'INV-' || to_char(now(), 'YYYY') || '-'
                  || lpad(nextval('public.invoice_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists set_invoice_number on public.invoices;
create trigger set_invoice_number
  before insert on public.invoices
  for each row execute function public.set_invoice_number();

alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

create policy "admins manage invoices"
  on public.invoices for all
  using (public.is_admin()) with check (public.is_admin());
create policy "admins manage invoice items"
  on public.invoice_items for all
  using (public.is_admin()) with check (public.is_admin());

-- Client-facing read by unguessable token — bypasses RLS via SECURITY DEFINER,
-- so the invoices table itself stays admin-only. Returns the InvoiceData shape.
create or replace function public.get_invoice_by_token(p_token uuid)
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'number',         i.number,
    'client_name',    i.client_name,
    'client_email',   i.client_email,
    'client_address', i.client_address,
    'issue_date',     i.issue_date,
    'due_date',       i.due_date,
    'status',         i.status,
    'tax_rate',       i.tax_rate,
    'notes',          i.notes,
    'items', coalesce((
      select json_agg(json_build_object(
               'description', it.description,
               'qty',         it.qty,
               'unit_price',  it.unit_price
             ) order by it.sort)
      from public.invoice_items it
      where it.invoice_id = i.id
    ), '[]'::json)
  )
  from public.invoices i
  where i.public_token = p_token;
$$;

grant execute on function public.get_invoice_by_token(uuid) to anon, authenticated;

-- ============================================================================
-- 5. Storage bucket for gallery images (public read, admin write)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true)
on conflict (id) do nothing;

create policy "public read gallery"
  on storage.objects for select
  using (bucket_id = 'gallery');
create policy "admins upload gallery"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'gallery' and public.is_admin());
create policy "admins update gallery"
  on storage.objects for update to authenticated
  using (bucket_id = 'gallery' and public.is_admin());
create policy "admins delete gallery"
  on storage.objects for delete to authenticated
  using (bucket_id = 'gallery' and public.is_admin());

-- ============================================================================
-- 6. Seed data (from src/data/site.ts). Guarded by NOT EXISTS so re-running
--    this file won't duplicate rows. Delete this section if you want to start
--    the CMS empty — the public site falls back to site.ts either way.
-- ============================================================================
insert into public.testimonials (quote, name, event, sort)
select * from (values
  ('Infinity made our wedding effortless. The grounds were breathtaking at golden hour, and every detail was handled with such care.', 'Priya & Arjun', 'Wedding · Spring 2025', 0),
  ('From the first tour to the last dance, the team treated us like family. Our guests are still talking about the string-lit terrace.', 'The Ramirez Family', 'Anniversary Celebration', 1),
  ('We hosted our community gathering here and the space adapted to everything we needed. Elegant, spacious, and truly welcoming.', 'Sana K.', 'Cultural Gathering', 2)
) as v(quote, name, event, sort)
where not exists (select 1 from public.testimonials);

insert into public.events (title, blurb, image, sort)
select * from (values
  ('Weddings', 'A romantic setting for your perfect day.', '/assets/site/events/ev-61.png', 0),
  ('Corporate Events', 'A refined space for business gatherings.', '/assets/site/events/ev-60.png', 1),
  ('Cultural & Community', 'Connect and celebrate together.', '/assets/site/events/ev-57.png', 2),
  ('Birthday & Anniversary', 'Celebrate milestones in style.', '/assets/site/events/ev-62.png', 3)
) as v(title, blurb, image, sort)
where not exists (select 1 from public.events);

insert into public.faqs (question, answer, sort)
select * from (values
  ('How many guests can the venue accommodate?', 'Our two acres pair a 2,600 sq ft indoor hall with 12,400 sq ft of outdoor space, comfortably hosting intimate gatherings through large celebrations. Share your guest count on the inquiry form and we’ll confirm the best layout.', 0),
  ('Can we bring our own caterer and vendors?', 'Yes — our spaces are catering-friendly and flexible. We’re happy to share a list of trusted local vendors if you’d like recommendations.', 1),
  ('Is alcohol allowed?', 'Alcohol is welcome with the appropriate licensed and insured service. We’ll walk you through the specifics during your tour.', 2),
  ('Is parking available?', 'Yes, we offer ample on-site parking so arrival is easy for all of your guests.', 3),
  ('How do we reserve a date?', 'Send an inquiry with your preferred date and we’ll be in touch within one business day to confirm availability, arrange a tour, and hold your date.', 4)
) as v(question, answer, sort)
where not exists (select 1 from public.faqs);

insert into public.gallery (label, cat, src, span, featured, sort)
select * from (values
  ('Grand Reception',        'reception', '/assets/site/DSC3669-2.jpg',      'tall'::text, false, 0),
  ('Ceremony Lawn',          'ceremony',  '/assets/site/wed.jpg',            null::text,   false, 1),
  ('String-Lit Terrace',     'outdoor',   '/assets/img/venue-05.jpg',        null::text,   false, 2),
  ('Golden Hour Portraits',  'details',   '/assets/site/f11.jpg',            'wide',       false, 3),
  ('The Sweetheart Table',   'reception', '/assets/site/DSC3705.jpg',        'tall',       false, 4),
  ('Open-Air Pavilion',      'outdoor',   '/assets/img/venue-08.jpg',        null,         false, 5),
  ('Evening Dancefloor',     'reception', '/assets/site/DSC3707.jpg',        'wide',       false, 6),
  ('The Bridal Suite',       'details',   '/assets/site/DSC3712.jpg',        'tall',       false, 7),
  ('Sunset Vows',            'ceremony',  '/assets/site/DSC3699-2.jpg',      null,         false, 8),
  ('Cocktail Garden',        'outdoor',   '/assets/img/venue-11.jpg',        null,         false, 9),
  ('The Family Feast',       'reception', '/assets/site/DSC3692.jpg',        'tall',       false, 10),
  ('The Grand Entrance',     'details',   '/assets/site/DSC3674.jpg',        null,         false, 11),
  ('Under the Arch',         'ceremony',  '/assets/site/arch.png',           null,         true,  12),
  ('Candlelit Tables',       'reception', '/assets/site/DSC3699-Edit-2.jpg', 'tall',       false, 13),
  ('Garden Ceremony',        'ceremony',  '/assets/site/DSC3678.jpg',        null,         false, 14),
  ('First Dance',            'reception', '/assets/site/DSC3699.jpg',        'wide',       false, 15),
  ('Floral Details',         'details',   '/assets/site/DSC3699-Edit-3.jpg', 'tall',       false, 16),
  ('Twilight Toast',         'outdoor',   '/assets/img/venue-18.jpg',        null,         false, 17)
) as v(label, cat, src, span, featured, sort)
where not exists (select 1 from public.gallery);

-- ============================================================================
-- 7. AFTER running this: create your admin user, then promote them.
--    a) Dashboard → Authentication → Users → Add user (tick "Auto Confirm User").
--    b) Run, with your email:
--       insert into public.admin_users (user_id)
--       select id from auth.users where email = 'YOUR_EMAIL_HERE';
-- ============================================================================
