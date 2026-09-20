-- Einmalig im Supabase SQL Editor ausführen, damit Änderungen an der Probierliste
-- sofort auf dem jeweils anderen angemeldeten Gerät erscheinen.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'trip_try_items'
  ) then
    alter publication supabase_realtime add table public.trip_try_items;
  end if;
end $$;
