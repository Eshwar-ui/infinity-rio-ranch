-- ============================================================================
--  0003_page_content.sql — the rest of the public site becomes editable.
--
--  Adds four tables:
--    site_copy   every heading, eyebrow and paragraph, addressed by a dotted key
--    stats       the three headline numbers
--    amenities   the About-page amenity cards
--    list_items  flat string lists ('included', 'event_types')
--
--  Seeds are the values the site shipped with, generated from
--  src/data/copy.defaults.json and src/data/site.ts. They are inserted with
--  ON CONFLICT DO NOTHING so re-running this migration never overwrites copy
--  the owner has since edited.
--
--  RLS follows the house pattern: the public reads, is_admin() writes. site_copy
--  has no 'published' column on purpose — an unpublished heading is a blank
--  heading, and blanking a string is what the empty value already means (the
--  component falls back to its shipped default).
-- ============================================================================

create table if not exists public.site_copy (
  key        text primary key,
  page       text not null,
  label      text not null,
  value      text not null default '',
  type       text not null default 'text' check (type in ('text', 'multiline')),
  sort       integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.stats (
  id         uuid primary key default gen_random_uuid(),
  value      text not null,
  label      text not null,
  published  boolean not null default true,
  sort       integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.amenities (
  id         uuid primary key default gen_random_uuid(),
  icon       text,
  title      text not null,
  sub        text,
  published  boolean not null default true,
  sort       integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.list_items (
  id         uuid primary key default gen_random_uuid(),
  list       text not null check (list in ('included', 'event_types')),
  value      text not null,
  published  boolean not null default true,
  sort       integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists list_items_list_sort_idx
  on public.list_items (list, sort);

-- Admin-only key/value settings. Holds the Vercel deploy hook that the
-- "Publish" button calls, which is why it is NOT public-readable: the anon key
-- ships in the browser bundle, and a world-readable deploy hook is a free
-- rebuild button for anyone who reads it.
create table if not exists public.site_settings (
  key        text primary key,
  value      text not null default '',
  created_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

drop policy if exists "admins manage settings" on public.site_settings;
create policy "admins manage settings"
  on public.site_settings for all
  using (public.is_admin()) with check (public.is_admin());

insert into public.site_settings (key, value)
values ('vercel_deploy_hook', '')
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
--  RLS
-- ----------------------------------------------------------------------------

alter table public.site_copy enable row level security;

drop policy if exists "public reads copy" on public.site_copy;
create policy "public reads copy"
  on public.site_copy for select using (true);

drop policy if exists "admins do everything" on public.site_copy;
create policy "admins do everything"
  on public.site_copy for all
  using (public.is_admin()) with check (public.is_admin());

do $$
declare t text;
begin
  foreach t in array array['stats', 'amenities', 'list_items'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "public reads published" on public.%I;', t);
    execute format(
      'create policy "public reads published" on public.%I for select using (published = true);', t);
    execute format('drop policy if exists "admins do everything" on public.%I;', t);
    execute format(
      'create policy "admins do everything" on public.%I for all using (public.is_admin()) with check (public.is_admin());', t);
  end loop;
end $$;

-- updated_at triggers, matching 0002_hardening.sql.
do $$
declare t text;
begin
  foreach t in array array['site_copy', 'stats', 'amenities', 'list_items'] loop
    execute format('alter table public.%I add column if not exists updated_at timestamptz not null default now();', t);
    execute format('drop trigger if exists touch_%1$s on public.%1$s;', t);
    execute format('create trigger touch_%1$s before update on public.%1$s for each row execute function public.touch_updated_at();', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
--  Seeds — the copy the site shipped with.
-- ----------------------------------------------------------------------------

insert into public.site_copy (key, page, label, value, type, sort) values
  ('global.contact.email', 'global', 'Email address', 'infinityrioranch6@gmail.com', 'text', 0),
  ('global.contact.phone_primary', 'global', 'Phone (primary, as displayed)', '+1 (512) 630-2236', 'text', 1),
  ('global.contact.phone_secondary', 'global', 'Phone (secondary, as displayed)', '+1 (737) 328-3895', 'text', 2),
  ('global.contact.phone_digits', 'global', 'Phone digits for call & WhatsApp links (no spaces, with country code)', '15126302236', 'text', 3),
  ('global.contact.street', 'global', 'Street address', '326 Rio Pk Dr', 'text', 4),
  ('global.contact.city', 'global', 'City', 'Liberty Hill', 'text', 5),
  ('global.contact.region', 'global', 'State (two letters)', 'TX', 'text', 6),
  ('global.contact.postal_code', 'global', 'ZIP code', '78642', 'text', 7),
  ('global.contact.location', 'global', 'Short location line', 'Liberty Hill, TX · Greater Austin', 'text', 8),
  ('global.contact.instagram_url', 'global', 'Instagram profile URL', 'https://www.instagram.com/infinity_rio_ranch', 'text', 9),
  ('global.contact.instagram_handle', 'global', 'Instagram handle', '@infinity_rio_ranch', 'text', 10),
  ('home.hero.eyebrow', 'home', 'Hero · eyebrow', 'Austin, Texas · Wedding & Event Venue', 'text', 0),
  ('home.hero.title_lead', 'home', 'Hero · headline, first line', 'Where Endless', 'text', 1),
  ('home.hero.title_accent', 'home', 'Hero · headline, italic word', 'Celebrations', 'text', 2),
  ('home.hero.title_trail', 'home', 'Hero · headline, after the italic word', 'Begin', 'text', 3),
  ('home.hero.cta_primary', 'home', 'Hero · primary button', 'Inquire About a Date', 'text', 4),
  ('home.hero.cta_secondary', 'home', 'Hero · secondary button', 'Explore the Venue', 'text', 5),
  ('home.welcome.eyebrow', 'home', 'Welcome · eyebrow', 'Welcome', 'text', 10),
  ('home.welcome.title', 'home', 'Welcome · heading', 'A premier venue where rustic elegance meets refined celebration.', 'multiline', 11),
  ('home.welcome.body1', 'home', 'Welcome · first paragraph', 'Welcome to Infinity at Rio Ranch, a premier wedding venue and event center in Liberty Hill, Texas, just outside Austin. Combining timeless charm with modern amenities, our rustic elegance provides the perfect backdrop for your most unforgettable moments. Whether you''re exchanging vows in a breathtaking indoor/outdoor setting or envisioning stunning photos to share, Infinity is the perfect place to make your dreams come true.', 'multiline', 12),
  ('home.welcome.body2', 'home', 'Welcome · second paragraph', 'From intimate gatherings to grand celebrations, our venue offers the perfect blend of sophistication and natural beauty.', 'multiline', 13),
  ('home.welcome.caption', 'home', 'Welcome · photo caption', 'The Grand Reception Hall', 'text', 14),
  ('home.events.eyebrow', 'home', 'Events · eyebrow', 'Every Occasion', 'text', 20),
  ('home.events.title', 'home', 'Events · heading', 'Made for your most meaningful gatherings', 'multiline', 21),
  ('home.band.eyebrow', 'home', 'Photo band · eyebrow', 'Begin your journey', 'text', 30),
  ('home.band.title', 'home', 'Photo band · heading', 'Discover the perfect setting for your special moments.', 'multiline', 31),
  ('home.band.body', 'home', 'Photo band · paragraph', 'Spanning two acres with stunning indoor and outdoor spaces, Infinity at Rio Ranch is designed for unforgettable weddings, celebrations, corporate events, and community gatherings — elegance, versatility, and natural beauty all in one place.', 'multiline', 32),
  ('home.band.cta', 'home', 'Photo band · button', 'View the Gallery →', 'text', 33),
  ('home.gallery.eyebrow', 'home', 'Gallery preview · eyebrow', 'Get inspired', 'text', 40),
  ('home.gallery.title', 'home', 'Gallery preview · heading', 'Photo Gallery', 'text', 41),
  ('home.gallery.link', 'home', 'Gallery preview · link', 'View Full Gallery →', 'text', 42),
  ('home.cta.script', 'home', 'Closing CTA · script line', 'Take a tour', 'text', 50),
  ('home.cta.title_lead', 'home', 'Closing CTA · heading, before the script word', 'Let''s plan something', 'text', 51),
  ('home.cta.title_accent', 'home', 'Closing CTA · heading, script word', 'unforgettable', 'text', 52),
  ('home.cta.body', 'home', 'Closing CTA · paragraph', 'We''d love to show you around, reserve your event date, or discuss your wedding-day dreams.', 'multiline', 53),
  ('home.cta.button_primary', 'home', 'Closing CTA · primary button', 'Contact Us', 'text', 54),
  ('home.cta.button_secondary', 'home', 'Closing CTA · secondary button', 'Call to Schedule', 'text', 55),
  ('about.hero.eyebrow', 'about', 'Hero · eyebrow', 'Our story', 'text', 0),
  ('about.hero.title', 'about', 'Hero · title', 'About Us', 'text', 1),
  ('about.intro.eyebrow', 'about', 'Intro · eyebrow', 'Welcome to Infinity', 'text', 10),
  ('about.intro.title', 'about', 'Intro · heading', 'Two acres of timeless charm and modern amenities.', 'multiline', 11),
  ('about.intro.body1', 'about', 'Intro · first paragraph', 'Infinity at Rio Ranch is a wedding and event venue in Liberty Hill, Texas, in the Greater Austin area. It spreads across two acres, featuring 2,600 sq ft of indoor space and 12,400 sq ft of outdoor space — perfect for hosting unforgettable celebrations. Whether you''re planning an intimate gathering or a grand celebration, our venue offers the perfect blend of sophistication and natural beauty.', 'multiline', 12),
  ('about.intro.body2', 'about', 'Intro · second paragraph', 'Combining rustic elegance with contemporary comfort, Infinity is designed to be the backdrop for your most meaningful moments — and the stunning photographs you''ll treasure long after.', 'multiline', 13),
  ('about.intro.cta', 'about', 'Intro · button', 'Schedule a Tour', 'text', 14),
  ('about.glance.title', 'about', 'Venue at a glance · heading', 'The venue at a glance', 'text', 20),
  ('about.amenities.eyebrow', 'about', 'Amenities · eyebrow', 'Owners & amenities', 'text', 30),
  ('about.amenities.title', 'about', 'Amenities · heading', 'Family-owned, personally hosted.', 'multiline', 31),
  ('about.amenities.body', 'about', 'Amenities · paragraph', 'Infinity Weddings & Events pairs attentive, personal service with thoughtfully appointed spaces — so every detail of your celebration feels effortless from your first tour to your final dance.', 'multiline', 32),
  ('about.included.eyebrow', 'about', 'What''s included · eyebrow', 'Effortless from the start', 'text', 40),
  ('about.included.title', 'about', 'What''s included · heading', 'Every celebration includes', 'multiline', 41),
  ('about.included.cta', 'about', 'What''s included · button', 'Inquire About Your Date', 'text', 42),
  ('gallery.hero.eyebrow', 'gallery', 'Hero · eyebrow', 'Get inspired', 'text', 0),
  ('gallery.hero.title', 'gallery', 'Hero · title', 'Gallery', 'text', 1),
  ('gallery.intro.title', 'gallery', 'Intro · heading', 'Real weddings and events at Infinity at Rio Ranch', 'multiline', 10),
  ('gallery.intro.body', 'gallery', 'Intro · paragraph', 'A look around our two acres in Liberty Hill, Texas — the ceremony lawn and floral arch, the 2,600 sq ft indoor reception hall, the string-lit outdoor terrace, the private bridal suite, and the golden-hour light our couples come back for. Filter by ceremony, reception, outdoor spaces or details, and tap any photo to enlarge.', 'multiline', 11),
  ('gallery.cta.title', 'gallery', 'Closing CTA · heading', 'Ready to see it in person?', 'text', 20),
  ('gallery.cta.button', 'gallery', 'Closing CTA · button', 'Schedule a Tour', 'text', 21),
  ('contact.hero.eyebrow', 'contact', 'Hero · eyebrow', 'Take a tour', 'text', 0),
  ('contact.hero.title', 'contact', 'Hero · title', 'Contact Us', 'text', 1),
  ('contact.form.script', 'contact', 'Form · script line', 'Inquire', 'text', 10),
  ('contact.form.title', 'contact', 'Form · heading', 'Tell us about your celebration.', 'multiline', 11),
  ('contact.form.submit', 'contact', 'Form · submit button', 'Send Inquiry', 'text', 12),
  ('contact.success.title', 'contact', 'After sending · heading', 'Thank you!', 'text', 20),
  ('contact.success.body', 'contact', 'After sending · paragraph', 'We''ve received your inquiry and will be in touch within one business day to talk dates and details.', 'multiline', 21),
  ('contact.success.button', 'contact', 'After sending · button', 'Send Another', 'text', 22),
  ('contact.faq.eyebrow', 'contact', 'FAQ · eyebrow', 'Good to know', 'text', 30),
  ('contact.faq.title', 'contact', 'FAQ · heading', 'Frequently asked questions', 'multiline', 31)
on conflict (key) do nothing;

insert into public.stats (value, label, sort)
select v, l, s from (values
  ('2', 'Acres of Grounds', 0),
  ('2,600', 'Sq Ft Indoor', 1),
  ('12,400', 'Sq Ft Outdoor', 2)
) as seed(v, l, s)
where not exists (select 1 from public.stats);

insert into public.amenities (icon, title, sub, sort)
select i, t, sb, s from (values
  ('✦', 'Indoor Hall', '2,600 sq ft of climate-controlled elegance.', 0),
  ('❦', 'Outdoor Grounds', '12,400 sq ft of open-air celebration.', 1),
  ('✷', 'Bridal Suite', 'A private space to prepare and unwind.', 2),
  ('☾', 'String-Lit Terrace', 'Warm evenings under a canopy of light.', 3),
  ('❈', 'Ample Parking', 'Easy arrival for all your guests.', 4),
  ('✧', 'Catering-Ready', 'Flexible setups for any menu or vision.', 5)
) as seed(i, t, sb, s)
where not exists (select 1 from public.amenities);

insert into public.list_items (list, value, sort)
select l, v, s from (values
  ('included', 'Tables & elegant seating', 0),
  ('included', 'Setup & teardown by our team', 1),
  ('included', 'Private bridal suite access', 2),
  ('included', 'String-lit outdoor terrace', 3),
  ('included', 'Ample on-site parking', 4),
  ('included', 'Sound-ready indoor & outdoor spaces', 5),
  ('included', 'Flexible, catering-friendly layouts', 6),
  ('included', 'A dedicated day-of venue contact', 7),
  ('event_types', 'Wedding', 0),
  ('event_types', 'Corporate Event', 1),
  ('event_types', 'Cultural & Community Gathering', 2),
  ('event_types', 'Birthday & Anniversary', 3),
  ('event_types', 'Other Celebration', 4)
) as seed(l, v, s)
where not exists (select 1 from public.list_items);
