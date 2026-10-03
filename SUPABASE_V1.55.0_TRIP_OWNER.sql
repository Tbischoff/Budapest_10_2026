-- Travel Planner v1.55.0
-- Bereinigung der verworfenen Trigger-Loesung und Auslesen von create_trip().
--
-- Die Trigger-Funktion kann bereits durch einen vorherigen, teilweise
-- erfolgreichen Lauf entfernt worden sein. Die Bereinigung ist daher
-- idempotent.

drop trigger if exists v155_ensure_trip_creator_owner on public.trips;

do $$
begin
  if to_regprocedure('public.ensure_trip_creator_owner()') is not null then
    execute 'drop function public.ensure_trip_creator_owner()';
  end if;
end
$$;

-- Vorhandene create_trip-Funktion(en) samt exakter Signatur und Definition.
select
  pg_get_function_identity_arguments(proc.oid) as function_arguments,
  pg_get_functiondef(proc.oid) as function_definition
from pg_catalog.pg_proc as proc
join pg_catalog.pg_namespace as ns
  on ns.oid = proc.pronamespace
where ns.nspname = 'public'
  and proc.proname = 'create_trip';
