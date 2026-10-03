-- Travel Planner v1.55.0
-- Absicherung: Der Ersteller einer Reise ist immer Owner.
--
-- Wichtig: create_trip(...) legt die Mitgliedschaft bereits selbst an.
-- Deshalb darf der Owner-Trigger nicht sofort nach INSERT auf trips laufen:
-- sonst kollidiert er mit dem anschließenden INSERT von create_trip.
-- Als DEFERRABLE Constraint Trigger läuft die Absicherung erst am Ende
-- der Transaktion und kann die vorhandene Mitgliedschaft auf Owner setzen.

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

create constraint trigger v155_ensure_trip_creator_owner
after insert on public.trips
deferrable initially deferred
for each row
execute function public.ensure_trip_creator_owner();
