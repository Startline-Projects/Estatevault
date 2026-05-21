-- Enable Supabase Realtime for the attorney review queue.
-- The attorney Reviews page subscribes to postgres_changes on attorney_reviews
-- (filtered to attorney_id = auth.uid(), allowed by the existing RLS select
-- policy) so a new order entering review, or a status change, appears in the
-- queue instantly — without a browser refresh. Without the table in the
-- supabase_realtime publication no change events are delivered.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'attorney_reviews'
  ) then
    alter publication supabase_realtime add table public.attorney_reviews;
  end if;
end $$;
