-- Tells the public invoice page whether its token belongs to a booking. A
-- standalone invoice must not show a button for a rental agreement it cannot have.
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
    'tax_rate',       i.tax_rate,
    'advance_paid',   i.advance_paid,
    'notes',          i.notes,
    'has_agreement',  i.client_id is not null,
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
