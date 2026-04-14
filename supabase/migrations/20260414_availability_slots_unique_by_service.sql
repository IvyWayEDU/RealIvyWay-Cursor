-- IvyWay: Allow per-service duplicate time windows in availability_slots
--
-- We need one inventory row PER (provider_id, service_type, start_time, end_time).
-- This enables providers to add services later and reuse their existing schedule.

-- Drop the old uniqueness that blocked per-service rows
drop index if exists public.availability_slots_provider_window_uniq;

-- Replace with per-service uniqueness
create unique index if not exists availability_slots_provider_service_window_uniq
on public.availability_slots (provider_id, service_type, start_time, end_time);

