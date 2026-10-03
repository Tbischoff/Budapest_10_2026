-- Travel Planner v1.54.0
-- Rollenmodell: owner / editor / viewer
-- Einmal im Supabase SQL Editor ausführen.

create or replace function public.can_edit_trip(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trip_members tm
    where tm.trip_id = p_trip_id
      and tm.user_id = auth.uid()
      and tm.role in ('owner','editor')
  );
$$;

-- is_trip_owner(uuid) existiert bereits aus der bisherigen Datenbankstruktur
-- und wird von v1.54.0 unverändert weiterverwendet.

create or replace function public.set_trip_member_role(
  p_trip_id uuid,
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_trip_owner(p_trip_id) then
    raise exception 'Nur der Besitzer kann Rollen ändern';
  end if;

  if p_role not in ('editor','viewer') then
    raise exception 'Ungültige Rolle';
  end if;

  if exists (
    select 1 from public.trip_members
    where trip_id = p_trip_id and user_id = p_user_id and role = 'owner'
  ) then
    raise exception 'Die Besitzerrolle kann hier nicht geändert werden';
  end if;

  update public.trip_members
  set role = p_role
  where trip_id = p_trip_id and user_id = p_user_id;

  if not found then
    raise exception 'Mitglied nicht gefunden';
  end if;
end;
$$;

grant execute on function public.can_edit_trip(uuid) to authenticated;
grant execute on function public.is_trip_owner(uuid) to authenticated;
grant execute on function public.set_trip_member_role(uuid,uuid,text) to authenticated;

-- Zusätzliche restriktive RLS-Regeln: bestehende Leserechte bleiben unverändert,
-- Schreibzugriffe benötigen aber mindestens Editor-Rechte.
drop policy if exists "v154_trip_places_write" on public.trip_places;
create policy "v154_trip_places_write"
on public.trip_places
as restrictive
for all
to authenticated
using (public.can_edit_trip(trip_id))
with check (public.can_edit_trip(trip_id));

drop policy if exists "v154_trip_activities_write" on public.trip_activities;
create policy "v154_trip_activities_write"
on public.trip_activities
as restrictive
for all
to authenticated
using (public.can_edit_trip(trip_id))
with check (public.can_edit_trip(trip_id));

drop policy if exists "v154_trip_try_items_write" on public.trip_try_items;
create policy "v154_trip_try_items_write"
on public.trip_try_items
as restrictive
for all
to authenticated
using (public.can_edit_trip(trip_id))
with check (public.can_edit_trip(trip_id));

drop policy if exists "v154_trip_days_write" on public.trip_days;
create policy "v154_trip_days_write"
on public.trip_days
as restrictive
for all
to authenticated
using (public.can_edit_trip(trip_id))
with check (public.can_edit_trip(trip_id));

-- Reisedaten selbst dürfen nur vom Owner geändert/gelöscht werden.
-- SELECT wird durch die bestehenden Policies geregelt.
drop policy if exists "v154_trips_owner_update" on public.trips;
create policy "v154_trips_owner_update"
on public.trips
as restrictive
for update
to authenticated
using (public.is_trip_owner(id))
with check (public.is_trip_owner(id));

drop policy if exists "v154_trips_owner_delete" on public.trips;
create policy "v154_trips_owner_delete"
on public.trips
as restrictive
for delete
to authenticated
using (public.is_trip_owner(id));
