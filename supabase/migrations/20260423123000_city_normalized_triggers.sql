-- Keep city_normalized in sync at DB level for all write paths.
create extension if not exists unaccent;

create or replace function public.set_city_normalized()
returns trigger
language plpgsql
as $$
begin
  new.city_normalized := regexp_replace(
    unaccent(
      replace(lower(trim(coalesce(new.city, ''))), 'đ', 'dj')
    ),
    '\s+',
    ' ',
    'g'
  );
  return new;
end;
$$;

drop trigger if exists trg_events_city_normalized on public.events_ee0c365c;
create trigger trg_events_city_normalized
before insert or update on public.events_ee0c365c
for each row
execute function public.set_city_normalized();

drop trigger if exists trg_venues_city_normalized on public.venues_ee0c365c;
create trigger trg_venues_city_normalized
before insert or update on public.venues_ee0c365c
for each row
execute function public.set_city_normalized();
