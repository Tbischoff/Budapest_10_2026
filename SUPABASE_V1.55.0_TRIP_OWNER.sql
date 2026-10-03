-- Travel Planner v1.55.0
-- Absicherung: Der Ersteller einer Reise ist immer Owner.
--
-- Diese Migration ersetzt create_trip(...) bewusst nicht, weil die bestehende
-- Funktion je nach installierter Datenbankversion weitere Initialisierung
-- (z. B. Reisetage) enthalten kann. Stattdessen korrigiert ein Trigger die
-- Mitgliedschaft unmittelbar nach dem Anlegen einer Reise.

create or replace function public.ensure_trip_creator_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  insert into public.trip_members (trip_id, user_id, role)
  values (new.id, auth.uid(), 'owner')
  on conflict (trip_id, user_id)
  do update set role = 'owner';

  return new;
end;
$$;

drop trigger if exists v155_ensure_trip_creator_owner on public.trips;

create trigger v155_ensure_trip_creator_owner
after insert on public.trips
for each row
execute function public.ensure_trip_creator_owner();
