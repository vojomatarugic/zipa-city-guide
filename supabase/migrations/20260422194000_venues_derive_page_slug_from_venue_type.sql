-- Keep venue routing canonical: page_slug is derived from venue_type.
-- nightclub -> clubs; all other known venue types -> food-and-drink

update public.venues_ee0c365c v
set page_slug = mapped.page_slug
from (
  select
    id,
    case lower(trim(coalesce(venue_type::text, '')))
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
      else null
    end as page_slug
  from public.venues_ee0c365c
) as mapped
where v.id = mapped.id
  and mapped.page_slug is not null
  and v.page_slug is distinct from mapped.page_slug;

