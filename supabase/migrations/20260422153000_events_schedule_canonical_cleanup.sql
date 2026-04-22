-- Normalize legacy event_schedules JSON objects to canonical shape.
-- Canonical row shape: {"start_at":"ISO","end_at":"ISO|null"}

with normalized as (
  select
    e.id,
    jsonb_agg(
      jsonb_build_object(
        'start_at', x.start_at,
        'end_at', to_jsonb(x.end_at)
      )
      order by x.ord
    ) as event_schedules_canonical
  from public.events_ee0c365c e
  cross join lateral (
    select
      ord,
      case
        when jsonb_typeof(elem) = 'object'
             and elem ? 'start_at'
             and coalesce(nullif(btrim(elem->>'start_at'), ''), '') <> ''
          then btrim(elem->>'start_at')
        when jsonb_typeof(elem) = 'object'
             and elem ? 'date'
             and elem ? 'startTime'
             and (elem->>'date') ~ '^\d{4}-\d{2}-\d{2}$'
             and (elem->>'startTime') ~ '^\d{2}:\d{2}$'
          then (elem->>'date') || 'T' || (elem->>'startTime') || ':00.000Z'
        else null
      end as start_at,
      case
        when jsonb_typeof(elem) = 'object'
             and elem ? 'start_at'
          then case
            when elem ? 'end_at' and coalesce(nullif(btrim(elem->>'end_at'), ''), '') <> ''
              then btrim(elem->>'end_at')
            else null
          end
        when jsonb_typeof(elem) = 'object'
             and elem ? 'date'
             and elem ? 'endTime'
             and (elem->>'date') ~ '^\d{4}-\d{2}-\d{2}$'
             and (elem->>'endTime') ~ '^\d{2}:\d{2}$'
          then (elem->>'date') || 'T' || (elem->>'endTime') || ':00.000Z'
        else null
      end as end_at,
      elem
    from jsonb_array_elements(coalesce(e.event_schedules, '[]'::jsonb)) with ordinality as t(elem, ord)
  ) as x
  where x.start_at is not null
  group by e.id
)
update public.events_ee0c365c e
set event_schedules = n.event_schedules_canonical
from normalized n
where e.id = n.id
  and n.event_schedules_canonical is not null
  and e.event_schedules is distinct from n.event_schedules_canonical;

-- Keep legacy columns aligned with first canonical slot where missing.
update public.events_ee0c365c e
set
  start_at = coalesce(
    e.start_at,
    nullif(e.event_schedules->0->>'start_at', '')::timestamptz
  ),
  end_at = coalesce(
    e.end_at,
    nullif(e.event_schedules->0->>'end_at', '')::timestamptz
  )
where e.event_schedules is not null
  and jsonb_typeof(e.event_schedules) = 'array'
  and jsonb_array_length(e.event_schedules) > 0;
