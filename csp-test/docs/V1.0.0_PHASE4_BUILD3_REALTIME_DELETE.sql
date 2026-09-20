-- Phase 4 · Build 3
-- Make old row values available to Realtime DELETE events.
alter table public.trip_places replica identity full;
