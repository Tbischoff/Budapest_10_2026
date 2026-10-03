-- Travel Planner v1.55.0
-- Owner-Absicherung fuer neu angelegte Reisen.
--
-- create_trip(...) legt die Mitgliedschaft bereits an. Deshalb greifen wir
-- nicht mehr mit einem zweiten Trigger in denselben Ablauf ein.
-- Stattdessen wird die bestehende create_trip-Funktion separat geprüft bzw.
-- bei Bedarf gezielt angepasst. Dieses Skript entfernt den fehlerhaften
-- v1.55-Trigger wieder sicher.

drop trigger if exists v155_ensure_trip_creator_owner on public.trips;
drop function if exists public.ensure_trip_creator_owner();

-- Kontrolle: Welche create_trip-Signatur ist aktuell installiert?
select
  p.oid::regprocedure::text as function_signature,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'create_trip';
