-- ============================================================================
--  0005_client_advance_invoices.sql — advance (deposit) tracking, and a real
--  link from an invoice back to the client it was raised for.
--
--  Two separate money facts, deliberately on two tables:
--    clients.advance_amount  — what the couple has actually paid to hold the
--                              date. Lives with the booking, survives every
--                              invoice being deleted and re-raised.
--    invoices.advance_paid   — what a given invoice *credits* against its
--                              total. Copied from the client at generation
--                              time, then editable, because a second invoice
--                              for the same booking must not credit the same
--                              deposit twice.
--
--  invoices.client_id is ON DELETE SET NULL, not CASCADE: an invoice is a
--  financial record. Deleting a client from the admin panel must never quietly
--  destroy the invoice that was already emailed to them — client_name/email
--  are denormalised onto the invoice precisely so it still reads correctly.
--
--  Run once in the SQL editor, on top of 0004. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  1. Advance held against the booking.
-- ----------------------------------------------------------------------------
alter table public.clients
  add column if not exists advance_amount numeric;

alter table public.clients drop constraint if exists clients_advance_amount_chk;
alter table public.clients
  add constraint clients_advance_amount_chk
  check (advance_amount is null or advance_amount >= 0);

-- ----------------------------------------------------------------------------
--  2. Invoice → client link + the advance this invoice credits.
-- ----------------------------------------------------------------------------
alter table public.invoices
  add column if not exists client_id uuid references public.clients (id) on delete set null,
  add column if not exists advance_paid numeric not null default 0;

alter table public.invoices drop constraint if exists invoices_advance_paid_chk;
alter table public.invoices
  add constraint invoices_advance_paid_chk check (advance_paid >= 0);

create index if not exists invoices_client_id_idx on public.invoices (client_id);

-- ----------------------------------------------------------------------------
--  3. The client-facing read has to carry the advance, or the public invoice
--     page shows a balance the client has already partly paid.
--     Recreated wholesale — this is the same function as in 0001 plus one key.
-- ----------------------------------------------------------------------------
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
    'advance_paid',   i.advance_paid,
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
