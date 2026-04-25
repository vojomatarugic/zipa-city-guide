import { resolveEventCategoryForPayload } from '../config/eventCategories';

export type EventScheduleSlot = { start_at: string; end_at?: string | null };

/**
 * Row shape for `events_ee0c365c` (and API normalization). Columns `event_time` and `source`
 * exist on the table but are not read or written by this application.
 */
export interface EventDbRow {
  id?: string;
  page_slug?: string | null;
  status?: string | null;
  title: string;
  title_en?: string | null;
  description: string;
  description_en?: string | null;
  city?: string | null;
  venue_name?: string | null;
  address?: string | null;
  image?: string | null;
  price?: string | null;
  date?: string | null;
  map_url?: string | null;
  ticket_link?: string | null;
  organizer_name?: string | null;
  organizer_phone?: string | null;
  organizer_email?: string | null;
  event_type?: string | null;
  is_featured?: boolean | null;
  /** User-selected genre / show type / music type (cinema, theatre, concert). */
  category?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  event_schedules?: EventScheduleSlot[] | null;
  submitted_by?: string | null;
  submitted_by_user_id?: string | null;
  submitted_by_name?: string | null;
  created_at?: string;
  updated_at?: string | null;
}

function normalizeEventCategoryValue(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed ? trimmed : null;
  }
  const serialized = String(raw).trim();
  return serialized ? serialized : null;
}

export interface EventApiPayload {
  title: string;
  title_en?: string;
  description: string;
  description_en?: string;
  city: string;
  venue_name: string;
  address: string;
  image?: string;
  price?: string;
  date?: string;
  map_url?: string;
  ticket_link?: string;
  organizer_name?: string;
  organizer_phone?: string;
  organizer_email?: string;
  event_type?: string;
  /** Listing bucket (concerts, theatre, cinema, events) — derived client-side from event_type. */
  page_slug?: string;
  category?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  event_schedules?: EventScheduleSlot[] | null;
  assign_user_id?: string;
  submitted_by?: string;
}

export interface EventFormModel {
  eventType: string;
  /** Set when event type uses EVENT_CATEGORY_CONFIG; otherwise empty. */
  category: string;
  image: string;
  eventName: string;
  eventNameEn: string;
  venue: string;
  city: string;
  address: string;
  mapUrl: string;
  description: string;
  descriptionEn: string;
  ticketLink: string;
  priceType: 'free' | 'paid';
  price: string;
  organizerName: string;
  organizerPhone: string;
  organizerEmail: string;
  submittedByEmail: string;
}

const DEFAULT_EVENT_IMAGE =
  'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800';

const VALID_EVENT_TYPES = new Set([
  'cinema',
  'club',
  'concert',
  'conference',
  'exhibition',
  'festival',
  'gastro',
  'kids',
  'other',
  'sport',
  'standup',
  'theatre',
  'workshop',
]);

function sanitizeEventType(type: string | null | undefined): string {
  if (!type) return '';
  if (VALID_EVENT_TYPES.has(type)) return type;
  if (type === 'music') return 'concert';
  return 'other';
}

export function normalizeEventSchedulesInput(raw: unknown): EventScheduleSlot[] | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      return normalizeEventSchedulesInput(JSON.parse(trimmed));
    } catch {
      return null;
    }
  }
  if (!Array.isArray(raw)) return null;

  const out: EventScheduleSlot[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const source = row as Record<string, unknown>;
    const startRaw = source.start_at ?? source.startAt;
    const endRaw = source.end_at ?? source.endAt;

    // Canonical shape: { start_at, end_at }
    if (typeof startRaw === 'string' && startRaw.trim()) {
      out.push({
        start_at: startRaw.trim(),
        end_at: typeof endRaw === 'string' && endRaw.trim() ? endRaw.trim() : null,
      });
      continue;
    }

    // Legacy shape compatibility: { date: "YYYY-MM-DD", startTime: "HH:mm", endTime?: "HH:mm" }.
    const dateRaw = source.date;
    const startTimeRaw = source.startTime;
    const endTimeRaw = source.endTime;
    if (
      typeof dateRaw === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(dateRaw.trim()) &&
      typeof startTimeRaw === 'string' &&
      /^\d{2}:\d{2}$/.test(startTimeRaw.trim())
    ) {
      const [y, m, d] = dateRaw.trim().split('-').map(Number);
      const [sh, sm] = startTimeRaw.trim().split(':').map(Number);
      const startDate = new Date(y, m - 1, d, sh, sm, 0, 0);
      if (isNaN(startDate.getTime())) continue;
      const start_at = startDate.toISOString();

      let end_at: string | null = null;
      if (typeof endTimeRaw === 'string' && /^\d{2}:\d{2}$/.test(endTimeRaw.trim())) {
        const [eh, em] = endTimeRaw.trim().split(':').map(Number);
        const endDate = new Date(y, m - 1, d, eh, em, 0, 0);
        if (!isNaN(endDate.getTime())) end_at = endDate.toISOString();
      }

      out.push({ start_at, end_at });
    }
  }
  return out.length ? out : null;
}

export function mapFormModelToEventApiPayload(form: EventFormModel): EventApiPayload {
  return {
    title: form.eventName,
    title_en: form.eventNameEn || undefined,
    description: form.description,
    description_en: form.descriptionEn || undefined,
    city: form.city.trim(),
    venue_name: form.venue.trim(),
    address: form.address.trim(),
    image: form.image.trim() || DEFAULT_EVENT_IMAGE,
    price: form.priceType === 'free' ? 'Free' : form.price,
    map_url: form.mapUrl.trim() || undefined,
    ticket_link: form.ticketLink || undefined,
    organizer_name: form.organizerName || undefined,
    organizer_phone: form.organizerPhone || undefined,
    organizer_email: form.organizerEmail || undefined,
    event_type: form.eventType || undefined,
    category: resolveEventCategoryForPayload(form.eventType, form.category),
  };
}

export function mapDbRowToFormModel(row: EventDbRow): EventFormModel {
  const rowPrice = row.price || '';
  const ext = row as unknown as Record<string, unknown>;
  const categoryStr = normalizeEventCategoryValue(ext['category'] ?? ext['Category']) ?? '';
  return {
    eventType: sanitizeEventType(row.event_type || ''),
    category: categoryStr,
    image: row.image || '',
    eventName: row.title || '',
    eventNameEn: row.title_en || '',
    venue: row.venue_name || '',
    city: row.city || '',
    address: row.address || '',
    mapUrl: row.map_url || '',
    description: row.description || '',
    descriptionEn: row.description_en || '',
    ticketLink: row.ticket_link || '',
    priceType: rowPrice === 'Free' || rowPrice === 'Besplatno' ? 'free' : rowPrice ? 'paid' : 'free',
    price: rowPrice !== 'Free' && rowPrice !== 'Besplatno' ? rowPrice : '',
    organizerName: row.organizer_name || '',
    organizerPhone: row.organizer_phone || '',
    organizerEmail: row.organizer_email || row.submitted_by || '',
    submittedByEmail: row.submitted_by || '',
  };
}

export function mapDbRowToUiEvent(row: EventDbRow): EventDbRow {
  const ext = row as unknown as Record<string, unknown>;
  const category = normalizeEventCategoryValue(ext['category'] ?? ext['Category']);
  const { Category: _legacyCategory, ...rowWithoutLegacyCategory } = ext;

  return {
    ...(rowWithoutLegacyCategory as unknown as EventDbRow),
    event_schedules: normalizeEventSchedulesInput(row.event_schedules),
    category,
  };
}
