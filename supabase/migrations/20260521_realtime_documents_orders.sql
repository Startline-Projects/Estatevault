-- Enable Supabase Realtime for client document/order live updates.
-- The client Documents page and PackageStatusCard subscribe to postgres_changes
-- on these tables so download buttons appear the instant generation finishes or
-- an attorney approves a review — without a browser refresh. Without the table
-- being in the supabase_realtime publication, no change events are delivered and
-- the UI falls back to polling only.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'documents'
  ) then
    alter publication supabase_realtime add table public.documents;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
