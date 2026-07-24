-- 0002_hardening.sql — security + robustness follow-up to 0001_init.sql.
-- Run once in the SQL editor, on top of 0001. Safe to re-run (idempotent).

-- ============================================================================
-- 1. Constrain the anon-writable leads table.
--    RLS decides WHO can insert (anyone, for the contact form); these decide
--    WHAT — the anon key ships in the browser bundle, so without this anyone
--    can script oversized/garbage rows straight at the REST API.
-- ============================================================================
alter table public.leads
  drop constraint if exists leads_name_len,
  drop constraint if exists leads_email_chk,
  drop constraint if exists leads_phone_len,
  drop constraint if exists leads_type_len,
  drop constraint if exists leads_message_len;
alter table public.leads
  add constraint leads_name_len    check (char_length(name) between 1 and 200),
  add constraint leads_email_chk   check (char_length(email) <= 320 and email ~ '^\S+@\S+\.\S+$'),
  add constraint leads_phone_len   check (phone   is null or char_length(phone)   <= 40),
  add constraint leads_type_len    check (type    is null or char_length(type)    <= 100),
  add constraint leads_message_len check (message is null or char_length(message) <= 5000);

-- ============================================================================
-- 2. Enforce a single featured gallery photo at the DB (was racy: the client
--    did it in two writes, so a failed second write left two featured).
--    AFTER trigger; the inner UPDATE only sets featured=false, so the
--    WHEN (new.featured) guard prevents recursion.
-- ============================================================================
create or replace function public.enforce_single_featured()
returns trigger language plpgsql as $$
begin
  update public.gallery set featured = false
  where id <> new.id and featured;
  return new;
end $$;

drop trigger if exists gallery_single_featured on public.gallery;
create trigger gallery_single_featured
  after insert or update of featured on public.gallery
  for each row when (new.featured)
  execute function public.enforce_single_featured();

-- ============================================================================
-- 3. updated_at columns + touch trigger on editable tables.
-- ============================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['testimonials','events','faqs','gallery','invoices'] loop
    execute format('alter table public.%I add column if not exists updated_at timestamptz not null default now();', t);
    execute format('drop trigger if exists touch_%1$s on public.%1$s;', t);
    execute format('create trigger touch_%1$s before update on public.%1$s for each row execute function public.touch_updated_at();', t);
  end loop;
end $$;

-- ============================================================================
-- 4. Indexes for the admin list/sort + public published queries.
--    Cheap now, meaningful as rows grow.
-- ============================================================================
create index if not exists leads_created_at_idx      on public.leads (created_at desc);
create index if not exists leads_status_idx          on public.leads (status);
create index if not exists invoices_created_at_idx   on public.invoices (created_at desc);
create index if not exists testimonials_pub_sort_idx on public.testimonials (published, sort);
create index if not exists events_pub_sort_idx       on public.events (published, sort);
create index if not exists faqs_pub_sort_idx         on public.faqs (published, sort);
create index if not exists gallery_pub_sort_idx      on public.gallery (published, sort);
