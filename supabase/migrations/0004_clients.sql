-- ============================================================================
--  0004_clients.sql — split the pipeline in two: leads vs clients.
--
--  `leads` stays exactly what it is: an anon-writable inbox for the public
--  contact form. `clients` is the booked side of the funnel and is admin-only
--  end to end — no public INSERT policy, because nothing on the public site
--  ever writes a client. Keeping them apart is why this is a second table
--  rather than a `stage` column: every field below (package, guest count,
--  amount, booking status) would sit permanently null on the hundreds of
--  inquiries that never convert, and one shared table would mean the anon
--  INSERT policy is one careless edit away from letting the public write
--  client records.
--
--  Conversion runs through convert_lead_to_client() instead of two client-side
--  writes, so the insert and the lead's status change land in one transaction —
--  a failed second write can't leave a lead marked converted with no client.
--
--  Run once in the SQL editor, on top of 0003. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  1. 'converted' becomes a terminal lead status.
--     Recreated rather than altered — CHECK constraints can't be extended.
-- ----------------------------------------------------------------------------
alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads
  add constraint leads_status_check
  check (status in ('new', 'read', 'replied', 'converted', 'archived'));

-- ----------------------------------------------------------------------------
--  2. Clients
-- ----------------------------------------------------------------------------
create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  -- Where they came from, when they came from the inbox. Nullable: clients can
  -- be added by hand (walk-ins, phone calls). ON DELETE SET NULL so deleting an
  -- old lead never takes a booked client with it; UNIQUE so a lead can only be
  -- converted once.
  lead_id     uuid unique references public.leads (id) on delete set null,
  name        text not null,
  email       text,
  phone       text,
  event_date  date,
  event_type  text,
  guest_count integer,
  package     text,
  amount      numeric,                                  -- agreed booking value
  status      text not null default 'booked'
              check (status in ('booked', 'completed', 'cancelled')),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.clients
  drop constraint if exists clients_name_len,
  drop constraint if exists clients_guest_count_chk,
  drop constraint if exists clients_amount_chk;
alter table public.clients
  add constraint clients_name_len       check (char_length(name) between 1 and 200),
  add constraint clients_guest_count_chk check (guest_count is null or guest_count >= 0),
  add constraint clients_amount_chk      check (amount is null or amount >= 0);

create index if not exists clients_created_at_idx on public.clients (created_at desc);
create index if not exists clients_status_idx     on public.clients (status);
create index if not exists clients_event_date_idx on public.clients (event_date);

alter table public.clients enable row level security;

-- Admin-only, all verbs. Deliberately no "anyone can insert" twin of the leads
-- policy — the anon key is in the browser bundle.
drop policy if exists "admins manage clients" on public.clients;
create policy "admins manage clients"
  on public.clients for all
  using (public.is_admin()) with check (public.is_admin());

drop trigger if exists touch_clients on public.clients;
create trigger touch_clients
  before update on public.clients
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
--  3. Lead → client, atomically.
--
--  SECURITY DEFINER so the whole conversion is one transaction, with an
--  explicit is_admin() gate standing in for the RLS it bypasses. Returns the
--  new client id; re-converting an already-converted lead returns the existing
--  client instead of raising, so a double-click is a no-op rather than an error.
-- ----------------------------------------------------------------------------
create or replace function public.convert_lead_to_client(p_lead_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead    public.leads%rowtype;
  v_client_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select * into v_lead from public.leads where id = p_lead_id;
  if not found then
    raise exception 'lead % not found', p_lead_id;
  end if;

  select id into v_client_id from public.clients where lead_id = p_lead_id;
  if found then
    return v_client_id;
  end if;

  insert into public.clients (lead_id, name, email, phone, event_date, event_type, notes)
  values (
    v_lead.id,
    v_lead.name,
    v_lead.email,
    v_lead.phone,
    v_lead.event_date,
    v_lead.type,
    v_lead.message
  )
  returning id into v_client_id;

  update public.leads set status = 'converted' where id = p_lead_id;

  return v_client_id;
end;
$$;

-- authenticated only: anon has no business calling this, and the is_admin()
-- gate above rejects it anyway.
revoke all on function public.convert_lead_to_client(uuid) from public, anon;
grant execute on function public.convert_lead_to_client(uuid) to authenticated;
