-- Keep venues.page_slug automatically synced from venues.venue_type
-- (same expectation as events event_type -> page_slug behavior).

create or replace function public.sync_venue_page_slug_from_type()
returns trigger
language plpgsql
as $$
begin
  if new.venue_type is null then
    return new;
  end if;

  new.page_slug := case new.venue_type::text
    when 'nightclub' then 'clubs'
    when 'restaurant' then 'food-and-drink'
    when 'cafe' then 'food-and-drink'
    when 'bar' then 'food-and-drink'
    when 'pub' then 'food-and-drink'
    when 'brewery' then 'food-and-drink'
    when 'kafana' then 'food-and-drink'
    when 'fast_food' then 'food-and-drink'
    when 'cevabdzinica' then 'food-and-drink'
    when 'pizzeria' then 'food-and-drink'
    when 'dessert_shop' then 'food-and-drink'
    when 'other' then 'food-and-drink'
    else new.page_slug
  end;

  return new;
end;
$$;

drop trigger if exists trg_sync_venue_page_slug_from_type on public.venues_ee0c365c;

create trigger trg_sync_venue_page_slug_from_type
before insert or update of venue_type on public.venues_ee0c365c
for each row
execute function public.sync_venue_page_slug_from_type();

