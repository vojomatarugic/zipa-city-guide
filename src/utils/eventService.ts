/**
 * Event Service - Events with datetime filtering
 */

import { projectId, publicAnonKey } from './supabase/info';
import { Item } from './dataService';
import { supabase } from './supabaseClient';
import { formatDate } from './dateFormat';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-a0e1e9cb`;

export type EventFilter = 'upcoming' | 'today' | 'tomorrow' | 'weekend' | 'past' | 'all';

/**
 * Format price for display — KM for Serbian, EUR conversion for English.
 * Fixed rate: 1 EUR = 1.95583 KM (official BAM/EUR peg).
 * "Free" / "Besplatno" → translated appropriately.
 */
export function formatPrice(price: string | null | undefined, language: string): string {
  if (!price) return '';
  const lower = price.toLowerCase().trim();
  if (lower === 'free' || lower === 'besplatno') {
    return language === 'en' ? 'Free' : 'Besplatno';
  }
  if (language !== 'en') return price; // Serbian — show original KM price

  // English — convert KM numbers to EUR
  // Handle ranges like "7-12 KM", "20 KM", "od 15 KM"
  const converted = price.replace(/(\d+(?:[.,]\d+)?)/g, (match) => {
    const kmValue = parseFloat(match.replace(',', '.'));
    const eurValue = kmValue / 1.95583;
    return eurValue < 1 ? eurValue.toFixed(2) : Math.round(eurValue).toString();
  });
  // Replace KM/BAM with EUR
  return converted.replace(/\s*(KM|BAM)\s*/gi, ' EUR ').trim().replace(/\s+/g, ' ');
}

/**
 * Get events with datetime filtering
 */
export async function getEvents(filter?: EventFilter, city?: string, type?: string, page_slug?: string): Promise<Item[]> {
  try {
    const params = new URLSearchParams();
    if (filter && filter !== 'all') params.append('filter', filter);
    if (city) params.append('city', city);
    if (type) params.append('type', type);
    if (page_slug) params.append('page_slug', page_slug);
    
    const url = `${API_BASE_URL}/events${params.toString() ? '?' + params.toString() : ''}`;
    
    console.log('🎉 Fetching events from:', url);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`❌ HTTP ${response.status} ${response.statusText}:`, errorText);
      return [];
    }

    const data = await response.json();
    console.log(`✅ Fetched ${data.events?.length || 0} events (filter: ${filter || 'all'})`);
    return data.events || [];
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('❌ Request timeout - server took too long to respond');
    } else {
      console.error('❌ Error fetching events:', error);
    }
    return [];
  }
}

/**
 * Get single event by ID
 */
export async function getEventById(id: string): Promise<Item | null> {
  try {
    const url = `${API_BASE_URL}/events/${id}`;
    
    console.log('🎯 Fetching event by ID:', id);
    
    // Get user's access token for ownership verification of non-approved events
    let accessToken: string | null = null;
    try {
      const { data } = await supabase.auth.getSession();
      accessToken = data.session?.access_token || null;
    } catch (e) {
      // Ignore auth errors - public access still works for approved events
    }
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${publicAnonKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    
    if (accessToken) {
      headers['x-auth-token'] = accessToken;
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`❌ HTTP ${response.status} ${response.statusText}:`, errorText);
      return null;
    }

    const data = await response.json();
    console.log('✅ Fetched event:', data.event?.id);
    return data.event || null;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('❌ Request timeout - server took too long to respond');
    } else {
      console.error('❌ Error fetching event by ID:', error);
    }
    return null;
  }
}

/**
 * Format event datetime for display
 */
export function formatEventDate(startAt: string, language: 'sr' | 'en' = 'sr'): string {
  return formatDate(startAt, language);
}

/**
 * Format event time for display
 */
export type EventScheduleSlot = { start_at: string; end_at?: string | null };

/**
 * Parse `event_schedules` from API/DB (may be JSON string, camelCase keys, or missing).
 */
export function parseEventSchedulesField(raw: unknown): EventScheduleSlot[] | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return null;
    try {
      return parseEventSchedulesField(JSON.parse(t));
    } catch {
      return null;
    }
  }
  if (!Array.isArray(raw)) return null;
  const out: EventScheduleSlot[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const start = o.start_at ?? o.startAt;
    if (typeof start !== 'string' || !start.trim()) continue;
    const endRaw = o.end_at ?? o.endAt;
    const end_at =
      typeof endRaw === 'string' && endRaw.trim() ? endRaw.trim() : null;
    out.push({ start_at: start.trim(), end_at });
  }
  return out.length ? out : null;
}

function mergeScheduleSources(
  fromJson: EventScheduleSlot[] | null,
  legacyStart: string | null | undefined,
  legacyEnd: string | null | undefined
): EventScheduleSlot[] {
  const seen = new Set<string>();
  const out: EventScheduleSlot[] = [];
  const add = (s: EventScheduleSlot) => {
    const key = `${s.start_at}\0${s.end_at ?? ''}`;
    if (!s.start_at || seen.has(key)) return;
    seen.add(key);
    out.push({ start_at: s.start_at, end_at: s.end_at ?? null });
  };
  if (fromJson?.length) {
    for (const s of fromJson) add(s);
  }
  if (legacyStart) {
    add({ start_at: legacyStart, end_at: legacyEnd ?? null });
  }
  out.sort(
    (a, b) =>
      new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  );
  return out;
}

/** All screenings: merged `event_schedules` JSON + legacy `start_at`/`end_at` (deduped). */
export function getEventScheduleSlots(event: Item): EventScheduleSlot[] {
  const ev = event as Item & {
    event_schedules?: unknown;
    eventSchedules?: unknown;
  };
  const parsed =
    parseEventSchedulesField(ev.event_schedules) ??
    parseEventSchedulesField(ev.eventSchedules);
  const merged = mergeScheduleSources(
    parsed,
    event.start_at ?? null,
    event.end_at ?? null
  );
  const seenDayTime = new Set<string>();
  const deduped: EventScheduleSlot[] = [];
  for (const s of merged) {
    const k = scheduleSlotDayTimeKey(s.start_at);
    if (seenDayTime.has(k)) continue;
    seenDayTime.add(k);
    deduped.push(s);
  }
  return deduped;
}

/** Local calendar day key for grouping screenings (YYYY-MM-DD). */
export function scheduleLocalDayKey(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch {
    return iso;
  }
}

/** Dedupe key: same local calendar day + same clock time (ignores seconds / duplicate rows). */
function scheduleSlotDayTimeKey(startAt: string): string {
  try {
    const d = new Date(startAt);
    if (isNaN(d.getTime())) return startAt;
    const day = scheduleLocalDayKey(startAt);
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${day}|${h}:${min}`;
  } catch {
    return startAt;
  }
}

/**
 * Full weekday + date for schedule rows, e.g. "Srijeda, 23. april 2026." (sr) or "Wednesday, April 23, 2026" (en).
 */
export function formatWeekdayWithDate(iso: string, language: 'sr' | 'en'): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const loc = language === 'sr' ? 'sr-Latn' : 'en-US';
    const weekday = new Intl.DateTimeFormat(loc, { weekday: 'long' }).format(d);
    const normalizedWeekday = weekday ? weekday.charAt(0).toUpperCase() + weekday.slice(1) : weekday;
    return `${normalizedWeekday}, ${formatDate(d, language)}`;
  } catch {
    return iso;
  }
}

export type GroupedScheduleRow = {
  dayKey: string;
  weekdayDateLabel: string;
  timeLabels: string[];
};

/**
 * Group schedule slots by local calendar day; multiple times on the same day appear once on the left with all times on the right.
 */
export function getGroupedEventSchedule(
  event: Item,
  language: 'sr' | 'en'
): GroupedScheduleRow[] {
  const slots = getEventScheduleSlots(event);
  const byDay = new Map<string, { start_at: string; end_at?: string | null }[]>();
  for (const slot of slots) {
    const key = scheduleLocalDayKey(slot.start_at);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(slot);
  }
  const rows: GroupedScheduleRow[] = [];
  for (const [dayKey, daySlots] of byDay) {
    daySlots.sort(
      (a, b) =>
        new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
    );
    const first = daySlots[0].start_at;
    rows.push({
      dayKey,
      weekdayDateLabel: formatWeekdayWithDate(first, language),
      timeLabels: daySlots.map((s) => formatEventTime(s.start_at, s.end_at, language)),
    });
  }
  rows.sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  return rows;
}

export function formatEventTime(startAt: string, endAt?: string | null, language: 'sr' | 'en' = 'sr'): string {
  try {
    const locale = language === 'sr' ? 'sr-Latn' : 'en-US';
    const formatter = new Intl.DateTimeFormat(locale, {
      hour: language === 'sr' ? '2-digit' : 'numeric',
      minute: '2-digit',
      hour12: language === 'en',
    });
    const start = new Date(startAt);
    if (isNaN(start.getTime())) return '';
    const startTime = formatter.format(start);
    
    if (endAt) {
      const end = new Date(endAt);
      if (isNaN(end.getTime())) return startTime;
      const endTime = formatter.format(end);
      return `${startTime} - ${endTime}`;
    }
    
    return startTime;
  } catch (error) {
    console.error('Error formatting time:', error);
    return '';
  }
}

/**
 * Check if event is happening today
 */
export function isEventToday(startAt: string): boolean {
  try {
    const eventDate = new Date(startAt);
    const today = new Date();
    
    return eventDate.getDate() === today.getDate() &&
           eventDate.getMonth() === today.getMonth() &&
           eventDate.getFullYear() === today.getFullYear();
  } catch (error) {
    return false;
  }
}

/**
 * Check if event is happening tomorrow
 */
export function isEventTomorrow(startAt: string): boolean {
  try {
    const eventDate = new Date(startAt);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return eventDate.getDate() === tomorrow.getDate() &&
           eventDate.getMonth() === tomorrow.getMonth() &&
           eventDate.getFullYear() === tomorrow.getFullYear();
  } catch (error) {
    return false;
  }
}

/**
 * Check if event is in the past
 */
export function isEventPast(startAt: string): boolean {
  try {
    const eventDate = new Date(startAt);
    const now = new Date();
    return eventDate < now;
  } catch (error) {
    return false;
  }
}

/**
 * Get relative date label (Today, Tomorrow, date)
 */
export function getRelativeDateLabel(startAt: string, language: 'sr' | 'en' = 'sr'): string {
  if (isEventToday(startAt)) {
    return language === 'sr' ? 'Danas' : 'Today';
  }
  
  if (isEventTomorrow(startAt)) {
    return language === 'sr' ? 'Sutra' : 'Tomorrow';
  }
  
  return formatEventDate(startAt, language);
}

/**
 * Translate event type to current language
 */
export function translateEventType(eventType: string, language: 'sr' | 'en' = 'sr'): string {
  if (!eventType) return '';
  
  // Event type translation map
  const translations: Record<string, { sr: string; en: string }> = {
    'art': { sr: 'Umjetnost', en: 'Art' },
    'music': { sr: 'Muzika', en: 'Music' },
    'concert': { sr: 'Koncert', en: 'Concert' },
    'festival': { sr: 'Festival', en: 'Festival' },
    'theatre': { sr: 'Pozorište', en: 'Theatre' },
    'standup': { sr: 'Standup komedija', en: 'Stand-up Comedy' },
    'cinema': { sr: 'Film / Projekcija', en: 'Film / Screening' },
    'exhibition': { sr: 'Izložba', en: 'Exhibition' },
    'sports': { sr: 'Sport', en: 'Sports' },
    'sport': { sr: 'Sport', en: 'Sport' },
    'workshop': { sr: 'Radionica', en: 'Workshop' },
    'conference': { sr: 'Konferencija', en: 'Conference' },
    'party': { sr: 'Zabava', en: 'Party' },
    'food': { sr: 'Hrana', en: 'Food' },
    'gastro': { sr: 'Gastro', en: 'Gastro' },
    'club': { sr: 'Klubski event', en: 'Club Event' },
    'kids': { sr: 'Kids', en: 'Kids' },
    'restaurant': { sr: 'Restoran', en: 'Restaurant' },
    'event': { sr: 'Događaj', en: 'Event' },
    'other': { sr: 'Ostalo', en: 'Other' },
  };
  
  const lowerType = eventType.toLowerCase().trim();
  const translation = translations[lowerType];
  
  if (translation) {
    return translation[language];
  }
  
  // If no translation found, return original with capital first letter
  return eventType.charAt(0).toUpperCase() + eventType.slice(1);
}

/**
 * Get all events (for admin panel)
 */
export async function getAllEvents(): Promise<Item[]> {
  const fetchByStatus = async (status: 'pending' | 'approved' | 'rejected' | 'all'): Promise<Item[]> => {
    const url = `${API_BASE_URL}/events?status=${status}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    const responseText = await response.text();
    let parsed: any = null;
    try {
      parsed = responseText ? JSON.parse(responseText) : null;
    } catch {
      parsed = null;
    }

    console.log(`[eventService.getAllEvents] url=${url} status=${response.status}`);
    console.log('[eventService.getAllEvents] body sample:', responseText.slice(0, 500));

    if (!response.ok) {
      console.error(`❌ HTTP ${response.status} ${response.statusText}:`, responseText);
      return [];
    }

    return parsed?.events || [];
  };

  try {
    console.log('📋 Fetching all events for admin');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const primaryUrl = `${API_BASE_URL}/events?status=all`;
    const response = await fetch(primaryUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await response.text().catch(() => '');
    let data: any = null;
    try {
      data = responseText ? JSON.parse(responseText) : null;
    } catch {
      data = null;
    }

    console.log(`[eventService.getAllEvents] primaryUrl=${primaryUrl} status=${response.status}`);
    console.log('[eventService.getAllEvents] primary body sample:', responseText.slice(0, 500));

    if (response.ok && Array.isArray(data?.events) && data.events.length > 0) {
      console.log(`✅ Fetched ${data.events.length} events for admin via status=all`);
      return data.events;
    }

    // Fallback for backend deployments where status=all is not supported correctly.
    console.warn('⚠️ status=all returned empty/invalid payload, falling back to status-by-status fetch');
    const [approved, pending, rejected] = await Promise.all([
      fetchByStatus('approved'),
      fetchByStatus('pending'),
      fetchByStatus('rejected'),
    ]);

    const mergedMap = new Map<string, Item>();
    [...approved, ...pending, ...rejected].forEach((event) => {
      const key = String((event as any).id || '');
      if (key) mergedMap.set(key, event);
    });
    const merged = Array.from(mergedMap.values());
    console.log(
      `✅ Fallback merged events: total=${merged.length}, approved=${approved.length}, pending=${pending.length}, rejected=${rejected.length}`
    );
    return merged;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('❌ Request timeout - server took too long to respond');
    } else {
      console.error('❌ Error fetching all events:', error);
    }
    return [];
  }
}

/**
 * Approve event
 */
export async function approveEvent(id: string): Promise<boolean> {
  try {
    const url = `${API_BASE_URL}/submissions/${id}/approve`;
    
    console.log('✅ Approving event:', id);
    let accessToken: string | null = null;
    try {
      const { data } = await supabase.auth.getSession();
      accessToken = data.session?.access_token || null;
    } catch {
      accessToken = null;
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(accessToken ? { 'x-auth-token': accessToken } : {}),
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseBody = await response.text().catch(() => '');
    console.log('[approveEvent] request', {
      url,
      method: 'PUT',
      hasAuthHeader: true,
      hasUserToken: !!accessToken,
      status: response.status,
      body: responseBody,
    });

    if (!response.ok) {
      console.error(`❌ HTTP ${response.status} ${response.statusText}:`, responseBody);
      return false;
    }

    console.log('✅ Event approved successfully');
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('❌ Request timeout - server took too long to respond');
    } else {
      console.error('❌ Error approving event:', error);
    }
    return false;
  }
}

/**
 * Reject event
 */
export async function rejectEvent(id: string): Promise<boolean> {
  try {
    const url = `${API_BASE_URL}/submissions/${id}/reject`;
    
    console.log('❌ Rejecting event:', id);
    let accessToken: string | null = null;
    try {
      const { data } = await supabase.auth.getSession();
      accessToken = data.session?.access_token || null;
    } catch {
      accessToken = null;
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(accessToken ? { 'x-auth-token': accessToken } : {}),
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseBody = await response.text().catch(() => '');
    console.log('[rejectEvent] request', {
      url,
      method: 'PUT',
      hasAuthHeader: true,
      hasUserToken: !!accessToken,
      status: response.status,
      body: responseBody,
    });

    if (!response.ok) {
      console.error(`❌ HTTP ${response.status} ${response.statusText}:`, responseBody);
      return false;
    }

    console.log('✅ Event rejected successfully');
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('❌ Request timeout - server took too long to respond');
    } else {
      console.error('❌ Error rejecting event:', error);
    }
    return false;
  }
}

/**
 * Delete event
 */
export async function deleteEvent(id: string): Promise<boolean> {
  try {
    const url = `${API_BASE_URL}/events/${id}`;
    let accessToken: string | null = null;
    try {
      const { data } = await supabase.auth.getSession();
      accessToken = data.session?.access_token || null;
    } catch {
      accessToken = null;
    }
    
    console.log('🗑️ Deleting event:', id);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(accessToken ? { 'x-auth-token': accessToken } : {}),
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`❌ HTTP ${response.status} ${response.statusText}:`, errorText);
      return false;
    }

    console.log('✅ Event deleted successfully');
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('❌ Request timeout - server took too long to respond');
    } else {
      console.error('❌ Error deleting event:', error);
    }
    return false;
  }
}

/**
 * Get interest count for an event
 */
export async function getInterestCount(eventId: string): Promise<number> {
  try {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}/interest`, {
      headers: { 'Authorization': `Bearer ${publicAnonKey}` },
    });
    const data = await response.json();
    return data.count || 0;
  } catch (error) {
    console.error('❌ Error getting interest count:', error);
    return 0;
  }
}

/**
 * Increment interest count for an event
 */
export async function incrementInterest(eventId: string): Promise<number> {
  try {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}/interest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json();
    return data.count || 0;
  } catch (error) {
    console.error('❌ Error incrementing interest:', error);
    return 0;
  }
}

/**
 * Decrement interest count for an event
 */
export async function decrementInterest(eventId: string): Promise<number> {
  try {
    const response = await fetch(`${API_BASE_URL}/events/${eventId}/interest`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json();
    return data.count || 0;
  } catch (error) {
    console.error('❌ Error decrementing interest:', error);
    return 0;
  }
}

/**
 * Batch get interest counts for multiple events
 */
export async function batchGetInterestCounts(eventIds: string[]): Promise<Record<string, number>> {
  try {
    if (eventIds.length === 0) return {};
    const response = await fetch(`${API_BASE_URL}/events/interest/batch`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ event_ids: eventIds }),
    });
    const data = await response.json();
    return data.counts || {};
  } catch (error) {
    console.error('❌ Error batch getting interest counts:', error);
    return {};
  }
}