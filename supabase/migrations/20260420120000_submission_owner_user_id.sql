-- Stable ownership columns for submissions.
-- Keep `submitted_by` as display-friendly email while ownership moves to auth UUID.

alter table if exists public.events_ee0c365c
  add column if not exists submitted_by_user_id uuid;

alter table if exists public.events_ee0c365c
  add column if not exists submitted_by_name text;

alter table if exists public.venues_ee0c365c
  add column if not exists submitted_by_user_id uuid;

alter table if exists public.venues_ee0c365c
  add column if not exists submitted_by_name text;

create index if not exists events_ee0c365c_submitted_by_user_id_idx
  on public.events_ee0c365c (submitted_by_user_id);

create index if not exists venues_ee0c365c_submitted_by_user_id_idx
  on public.venues_ee0c365c (submitted_by_user_id);
