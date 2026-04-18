-- Optional: run against your Supabase project if these columns are missing on `events_ee0c365c`.
-- The deployed Edge Function persists `event_schedules`, `date`, and `map_url` on create/update.

alter table if exists public.events_ee0c365c
  add column if not exists event_schedules jsonb;

alter table if exists public.events_ee0c365c
  add column if not exists date text;

alter table if exists public.events_ee0c365c
  add column if not exists map_url text;
