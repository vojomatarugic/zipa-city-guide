export type EventScheduleSlot = { start_at: string; end_at?: string | null };

export interface EventApiPayload {
  title?: string;
  title_en?: string;
  description?: string;
  description_en?: string;
  city?: string;
  venue_name?: string;
  address?: string;
  image?: string;
  price?: string;
  date?: string | null;
  map_url?: string | null;
  ticket_link?: string;
  organizer_name?: string;
  organizer_phone?: string;
  organizer_email?: string;
  event_type?: string;
  start_at?: string;
  end_at?: string | null;
  event_schedules?: EventScheduleSlot[] | string | null;
  assign_user_id?: string;
  submitted_by?: string;
  page_slug?: string;
}

function valueAsString(
  source: Record<string, unknown>,
  key: keyof EventApiPayload
): string | undefined {
  const value = source[key];
  return typeof value === 'string' ? value : undefined;
}

export function pickEventApiPayload(body: unknown): EventApiPayload {
  const source = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const payload: EventApiPayload = {
    title: valueAsString(source, 'title'),
    title_en: valueAsString(source, 'title_en'),
    description: valueAsString(source, 'description'),
    description_en: valueAsString(source, 'description_en'),
    city: valueAsString(source, 'city'),
    venue_name: valueAsString(source, 'venue_name'),
    address: valueAsString(source, 'address'),
    image: valueAsString(source, 'image'),
    price: valueAsString(source, 'price'),
    map_url: valueAsString(source, 'map_url'),
    ticket_link: valueAsString(source, 'ticket_link'),
    organizer_name: valueAsString(source, 'organizer_name'),
    organizer_phone: valueAsString(source, 'organizer_phone'),
    organizer_email: valueAsString(source, 'organizer_email'),
    event_type: valueAsString(source, 'event_type'),
    start_at: valueAsString(source, 'start_at'),
    end_at: valueAsString(source, 'end_at'),
    assign_user_id: valueAsString(source, 'assign_user_id'),
    submitted_by: valueAsString(source, 'submitted_by'),
    page_slug: valueAsString(source, 'page_slug'),
  };

  if ('date' in source) {
    payload.date =
      source.date === null ? null : typeof source.date === 'string' ? source.date : undefined;
  }
  if ('event_schedules' in source) {
    payload.event_schedules = source.event_schedules as EventApiPayload['event_schedules'];
  }

  return payload;
}
