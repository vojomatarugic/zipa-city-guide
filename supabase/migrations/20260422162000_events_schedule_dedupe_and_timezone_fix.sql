-- Canonicalize + dedupe event schedules and fix UTC drift when first schedule doesn't match start_at.
--
-- Strategy:
-- 1) Parse schedule rows as timestamptz.
-- 2) Detect delta between first schedule slot and legacy start_at.
-- 3) If delta is exactly 1h or 2h, shift all slots back by that delta.
-- 4) Dedupe by adjusted (start_at,end_at), keep first occurrence order.
-- 5) Rebuild canonical JSON: [{start_at,end_at}] with UTC Z strings.

with expanded as (
  select
    e.id,
    e.start_at as legacy_start_at,
    t.ord,
    nullif(btrim(t.elem->>'start_at'), '')::timestamptz as slot_start_at,
    case
      when t.elem ? 'end_at' and nullif(btrim(t.elem->>'end_at'), '') is not null
        then nullif(btrim(t.elem->>'end_at'), '')::timestamptz
      else null
    end as slot_end_at
  from public.events_ee0c365c e
  cross join lateral jsonb_array_elements(coalesce(e.event_schedules, '[]'::jsonb)) with ordinality as t(elem, ord)
  where jsonb_typeof(coalesce(e.event_schedules, '[]'::jsonb)) = 'array'
    and t.elem ? 'start_at'
    and nullif(btrim(t.elem->>'start_at'), '') is not null
),
first_slot as (
  select distinct on (id)
    id,
    slot_start_at as first_slot_start_at
  from expanded
  order by id, ord
),
delta as (
  select
    e.id,
    case
      when e.legacy_start_at is not null
       and f.first_slot_start_at is not null
       and (f.first_slot_start_at - e.legacy_start_at) in (interval '1 hour', interval '2 hours')
      then (f.first_slot_start_at - e.legacy_start_at)
      else interval '0 hour'
    end as shift_back_by
  from (
    select distinct id, legacy_start_at from expanded
  ) e
  left join first_slot f on f.id = e.id
),
adjusted as (
  select
    x.id,
    x.ord,
    (x.slot_start_at - d.shift_back_by) as adj_start_at,
    case
      when x.slot_end_at is null then null
      else (x.slot_end_at - d.shift_back_by)
    end as adj_end_at
  from expanded x
  join delta d on d.id = x.id
),
deduped as (
  select distinct on (id, adj_start_at, adj_end_at)
    id,
    ord,
    adj_start_at,
    adj_end_at
  from adjusted
  order by id, adj_start_at, adj_end_at, ord
),
rebuilt as (
  select
    id,
    jsonb_agg(
      jsonb_build_object(
        'start_at', to_char(adj_start_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'end_at', case
          when adj_end_at is null then null
          else to_char(adj_end_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        end
      )
      order by ord
    ) as canonical_event_schedules,
    min(adj_start_at) as canonical_first_start_at,
    (array_agg(adj_end_at order by ord))[1] as canonical_first_end_at
  from deduped
  group by id
)
update public.events_ee0c365c e
set
  event_schedules = r.canonical_event_schedules,
  start_at = coalesce(e.start_at, r.canonical_first_start_at),
  end_at = coalesce(e.end_at, r.canonical_first_end_at)
from rebuilt r
where e.id = r.id
  and (
    e.event_schedules is distinct from r.canonical_event_schedules
    or (e.start_at is null and r.canonical_first_start_at is not null)
    or (e.end_at is null and r.canonical_first_end_at is not null)
  );
