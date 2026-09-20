-- V1.0.0 Phase 3 – Realtime für gemeinsame Reiseplanung
-- Einmal im Supabase SQL Editor ausführen.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'trip_places'
  ) then
    alter publication supabase_realtime add table public.trip_places;
  end if;
end $$;
