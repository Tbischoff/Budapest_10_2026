grant select, insert, update, delete on table public.places to authenticated;
grant select, insert, update, delete on table public.trip_places to authenticated;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='places'
  ) then
    alter publication supabase_realtime add table public.places;
  end if;
end $$;
