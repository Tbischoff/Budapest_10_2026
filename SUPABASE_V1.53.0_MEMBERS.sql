-- Travel Planner v1.53.0
-- Mitgliederverwaltung pro Reise. Einmal im Supabase SQL Editor ausführen.

alter table public.trip_members
  add column if not exists role text not null default 'editor'
  check (role in ('owner','editor','viewer'));

-- Je bestehender Reise genau ein vorhandenes Mitglied als Besitzer markieren.
with ranked as (
  select ctid, trip_id,
         row_number() over (partition by trip_id order by created_at nulls last, user_id) as rn
  from public.trip_members
)
update public.trip_members tm
set role = 'owner'
from ranked r
where tm.ctid = r.ctid and r.rn = 1
  and not exists (
    select 1 from public.trip_members x
    where x.trip_id = tm.trip_id and x.role = 'owner'
  );

create or replace function public.get_trip_members(p_trip_id uuid)
returns table(user_id uuid, email text, role text)
language plpgsql security definer set search_path = public, auth
as $$
begin
  if not exists (select 1 from public.trip_members tm where tm.trip_id=p_trip_id and tm.user_id=auth.uid()) then
    raise exception 'Kein Zugriff auf diese Reise';
  end if;
  return query
    select tm.user_id, u.email::text, tm.role
    from public.trip_members tm join auth.users u on u.id=tm.user_id
    where tm.trip_id=p_trip_id
    order by case tm.role when 'owner' then 0 else 1 end, lower(u.email);
end; $$;

create or replace function public.add_trip_member_by_email(p_trip_id uuid, p_email text)
returns void language plpgsql security definer set search_path = public, auth
as $$
declare v_user_id uuid;
begin
  if not exists (select 1 from public.trip_members tm where tm.trip_id=p_trip_id and tm.user_id=auth.uid() and tm.role='owner') then
    raise exception 'Nur der Besitzer kann Mitglieder hinzufügen';
  end if;
  select u.id into v_user_id from auth.users u where lower(u.email)=lower(trim(p_email)) limit 1;
  if v_user_id is null then raise exception 'Kein registrierter Benutzer mit dieser E-Mail-Adresse gefunden'; end if;
  if exists (select 1 from public.trip_members tm where tm.trip_id=p_trip_id and tm.user_id=v_user_id) then
    raise exception 'Dieser Benutzer ist bereits Mitglied der Reise';
  end if;
  insert into public.trip_members(trip_id,user_id,role) values(p_trip_id,v_user_id,'editor');
end; $$;

create or replace function public.remove_trip_member(p_trip_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public, auth
as $$
begin
  if not exists (select 1 from public.trip_members tm where tm.trip_id=p_trip_id and tm.user_id=auth.uid() and tm.role='owner') then
    raise exception 'Nur der Besitzer kann Mitglieder entfernen';
  end if;
  if exists (select 1 from public.trip_members tm where tm.trip_id=p_trip_id and tm.user_id=p_user_id and tm.role='owner') then
    raise exception 'Der Besitzer kann nicht aus der Reise entfernt werden';
  end if;
  delete from public.trip_members where trip_id=p_trip_id and user_id=p_user_id;
end; $$;

grant execute on function public.get_trip_members(uuid) to authenticated;
grant execute on function public.add_trip_member_by_email(uuid,text) to authenticated;
grant execute on function public.remove_trip_member(uuid,uuid) to authenticated;
