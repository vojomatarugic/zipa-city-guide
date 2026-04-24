-- Canonical city key for strict and scalable city filtering.
create extension if not exists unaccent;

alter table public.events_ee0c365c
  add column if not exists city_normalized text;

alter table public.venues_ee0c365c
  add column if not exists city_normalized text;

update public.events_ee0c365c
set city_normalized = regexp_replace(
  unaccent(
    replace(lower(trim(coalesce(city, ''))), 'đ', 'dj')
  ),
  '\s+',
  ' ',
  'g'
)
where city_normalized is null;

update public.venues_ee0c365c
set city_normalized = regexp_replace(
  unaccent(
    replace(lower(trim(coalesce(city, ''))), 'đ', 'dj')
  ),
  '\s+',
  ' ',
  'g'
)
where city_normalized is null;

create index if not exists events_ee0c365c_city_normalized_idx
  on public.events_ee0c365c (city_normalized);

create index if not exists venues_ee0c365c_city_normalized_idx
  on public.venues_ee0c365c (city_normalized);
