-- Travel Planner v1.55.0
-- Owner-Zuweisung bei neuen Reisen
--
-- Die bestehende create_trip()-Funktion setzt den Ersteller bereits korrekt
-- auf role = 'owner'. Es ist daher kein zusaetzlicher Trigger erforderlich.
-- Dieses Skript entfernt nur noch eventuelle Reste der verworfenen
-- Trigger-Loesung. create_trip() bleibt unveraendert.

drop trigger if exists v155_ensure_trip_creator_owner on public.trips;

do $$
begin
  if to_regprocedure('public.ensure_trip_creator_owner()') is not null then
    execute 'drop function public.ensure_trip_creator_owner()';
  end if;
end
$$;

-- Kontrollausgabe: create_trip() muss den Ersteller als Owner anlegen.
select
  pg_get_functiondef('public.create_trip(text,text,date,date)'::regprocedure)
  as create_trip_definition;
