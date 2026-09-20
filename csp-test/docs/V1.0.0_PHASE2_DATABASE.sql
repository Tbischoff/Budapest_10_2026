-- V1.0.0 Phase 2
-- Bestehende Zeitspanne der App vollständig synchronisieren
alter table public.trip_places
  add column if not exists planned_end_time time;

grant select, insert, update, delete
on table public.trip_places
to authenticated;
