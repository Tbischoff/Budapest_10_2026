-- Travel Planner v1.55.0
-- Bereinigung der verworfenen Trigger-Loesung und Auslesen von create_trip().
--
-- Die Trigger-Funktion kann bereits durch einen vorherigen, teilweise
-- erfolgreichen Lauf entfernt worden sein. Deshalb ist die Bereinigung
-- absichtlich idempotent und bricht in diesem Fall nicht ab.

drop trigger if exists v155_ensure_trip_creator_owner on public.trips;

do $$
begin
  if to_regprocedure('public.ensure_trip_creator_owner()') is not null then
    execute 'drop function public.ensure_trip_creator_owner()';
  end if;
end
$$;

select
  p.oid::regprocedure::text as function_signature,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'create_trip';
