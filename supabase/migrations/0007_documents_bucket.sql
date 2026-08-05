-- ============================================================================
--  0007_documents_bucket.sql — private storage for the rental-agreement template.
--
--  The `send-invoice` edge function stamps each client's details onto the
--  venue's own agreement PDF and attaches the result to the invoice email. The
--  blank template lives here rather than in the repo or the function bundle so
--  replacing it when the wording changes is a file upload (Storage → documents →
--  rental-agreement-template.pdf), not a redeploy. See docs/RUNBOOK.md.
--
--  PRIVATE, unlike `gallery`: this is a contract template, not a marketing
--  photo, and a public bucket would put it at a guessable URL. The edge
--  function reads it with the service-role key (which bypasses these policies);
--  the admin panel reads and writes it as a logged-in admin.
--
--  Run once in the SQL editor, on top of 0006. Safe to re-run.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "admins read documents"   on storage.objects;
drop policy if exists "admins upload documents" on storage.objects;
drop policy if exists "admins update documents" on storage.objects;
drop policy if exists "admins delete documents" on storage.objects;

create policy "admins read documents"
  on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.is_admin());
create policy "admins upload documents"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.is_admin());
create policy "admins update documents"
  on storage.objects for update to authenticated
  using (bucket_id = 'documents' and public.is_admin());
create policy "admins delete documents"
  on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.is_admin());
