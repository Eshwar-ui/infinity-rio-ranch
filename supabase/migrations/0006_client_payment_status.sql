-- ============================================================================
--  0006_client_payment_status.sql — a payment state on the booking itself.
--
--  Deliberately hand-set, not derived from amount/advance_amount: the owner
--  takes cash and transfers that never pass through this app, so the numbers on
--  a client row are not a complete payment record and can't be trusted to
--  decide this. The trade-off is that the flag CAN disagree with the balance —
--  nothing in the DB reconciles them, and the admin profile shows a quiet note
--  when it happens rather than silently correcting either one.
--
--  Seeded once from the money that does exist, so no row starts out wrong.
--  From then on it only ever changes by hand.
--
--  Run once in the SQL editor, on top of 0005. Safe to re-run.
-- ============================================================================

alter table public.clients
  add column if not exists payment_status text not null default 'unpaid';

alter table public.clients drop constraint if exists clients_payment_status_chk;
alter table public.clients
  add constraint clients_payment_status_chk
  check (payment_status in ('unpaid', 'partial', 'paid'));

create index if not exists clients_payment_status_idx on public.clients (payment_status);

-- One-time seed. Guarded on 'unpaid' (the column default) so re-running this
-- migration never overwrites a state the owner has since set by hand.
update public.clients
   set payment_status = case
         when coalesce(amount, 0) > 0
              and coalesce(advance_amount, 0) >= amount then 'paid'
         when coalesce(advance_amount, 0) > 0            then 'partial'
         else 'unpaid'
       end
 where payment_status = 'unpaid';
