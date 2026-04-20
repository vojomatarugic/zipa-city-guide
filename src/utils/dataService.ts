/**
 * DataService - User-Submitted Content Management
 *
 * Sve operacije idu direktno na Supabase backend.
 * Nema localStorage fallbacka — backend je stabilan i uvijek dostupan.
 */

import { publicAnonKey } from './supabase/info';
import { supabase } from './supabaseClient';
import { getApiBase } from '../config/apiBase';

/**
 * Get current user's access token (if logged in).
 * Validates with server and refreshes if needed to avoid stale session_id errors.
 */
async function getAccessToken(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
      console.log('[getAccessToken] No session available');
      return null;
    }

    // Check if token is expired based on exp claim (fast, no network)
    try {
      const payload = JSON.parse(atob(data.session.access_token.split('.')[1]));
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        console.warn('[getAccessToken] Token expired, attempting refresh...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshData.session) {
          console.error('[getAccessToken] Refresh failed, signing out:', refreshError?.message);
          await supabase.auth.signOut();
          return null;
        }
        return refreshData.session.access_token;
      }
    } catch (_) {
      // Could not parse JWT payload — continue
    }

    // Validate with GoTrue (catches stale session_id)
    const { error: userError } = await supabase.auth.getUser(data.session.access_token);
    if (userError) {
      console.warn('[getAccessToken] Session invalid, attempting refresh...', userError.message);
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshData.session) {
        console.error('[getAccessToken] Refresh failed, signing out:', refreshError?.message);
        await supabase.auth.signOut();
        return null;
      }
      return refreshData.session.access_token;
    }

    // Proactive refresh if expiring within 5 minutes
    const expiresAt = data.session.expires_at;
    const now = Math.floor(Date.now() / 1000);
    if (expiresAt && (expiresAt - now) < 5 * 60) {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && refreshData.session) {
        return refreshData.session.access_token;
      }
    }

    return data.session.access_token;
  } catch (error) {
    console.error('[getAccessToken] Error:', error);
    return null;
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

export type ItemStatus = 'pending' | 'approved' | 'rejected';
export type ItemCategory =
  | 'food-and-drink'
  | 'clubs'
  | 'events'
  | 'concerts'
  | 'theatre'
  | 'cinema'
  | 'cafes'
  | 'attractions'
  | 'magazine';

/**
 * Svi dozvoljeni tipovi lokala.
 * ⚠️ Ako dodaješ novi VenueType, MORAS dodati i red u VENUE_TYPE_TO_CATEGORY
 *    u AddVenuePage.tsx — TypeScript compile error će te spriječiti da zaboraviš.
 */
export type VenueType =
  | 'restaurant'
  | 'cafe'
  | 'bar'
  | 'pub'
  | 'brewery'
  | 'kafana'
  | 'fast_food'
  | 'cevabdzinica'
  | 'pizzeria'
  | 'dessert_shop'
  | 'nightclub'
  | 'other';

export interface Item {
  id: string;
  page_slug: ItemCategory;
  title: string;
  title_en?: string;
  description: string;
  description_en?: string;
  date?: string;
  city?: string;
  // location removed — consolidated into address
  image?: string;
  price?: string;
  opening_hours?: string;
  opening_hours_en?: string;
  cuisine?: string;
  cuisine_en?: string;
  status: ItemStatus;
  submitted_by?: string;
  submitted_by_user_id?: string;
  submitted_by_name?: string;
  created_at: string;
  approved_at?: string;
  rejected_at?: string;
  is_custom?: boolean;

  // Event-specific fields
  venue_name?: string;
  ticket_link?: string;
  organizer_name?: string;
  organizer_phone?: string;
  organizer_email?: string;
  event_type?: string;

  // ISO datetime fields for events
  start_at?: string | null;
  end_at?: string | null;
  /**
   * Optional extra screenings / terms (e.g. multiple showtimes).
   * Backend must persist this (JSON column or similar) — see SubmitEventPage payload.
   * First term should mirror `start_at` / `end_at` for listings and legacy clients.
   */
  event_schedules?: { start_at: string; end_at?: string | null }[] | null;

  // Venue-specific fields
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  website?: string;
  phone?: string;
  address?: string;
  map_url?: string;
  venue_type?: string;
  /** Venue oznaka keys (DB `tags`: string[] or comma-separated string from API) */
  tags?: string | string[] | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authHeaders(accessToken?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${publicAnonKey}`,
    /** Supabase Edge gateway often requires apikey for routing (same as admin fetch pattern). */
    'apikey': publicAnonKey,
    'Content-Type': 'application/json',
  };
  if (accessToken) headers['x-auth-token'] = accessToken;
  return headers;
}

function parseJsonSafe(text: string): Record<string, unknown> {
  const t = text?.trim();
  if (!t) return {};
  try {
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get all items (admin endpoint — no auth required but returns all statuses).
 */
export async function getAllItems(status?: ItemStatus, page_slug?: ItemCategory): Promise<Item[]> {
  try {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (page_slug) params.append('page_slug', page_slug);

    const url = `${getApiBase()}/submissions${params.toString() ? '?' + params.toString() : ''}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      method: 'GET',
      headers: authHeaders(),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`[getAllItems] Error ${response.status}:`, errorText);
      return [];
    }

    const data = await response.json();
    return data.submissions || [];
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('[getAllItems] Request timed out');
    } else {
      console.error('[getAllItems] Error:', error);
    }
    return [];
  }
}

/**
 * Get approved venues (public endpoint).
 */
export async function getVenues(page_slug?: string, city?: string): Promise<Item[]> {
  try {
    const params = new URLSearchParams();
    if (page_slug) params.append('page_slug', page_slug);
    if (city) params.append('city', city);

    const url = `${getApiBase()}/venues${params.toString() ? '?' + params.toString() : ''}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'GET',
      headers: authHeaders(),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`[getVenues] Error ${response.status}:`, errorText);
      return [];
    }

    const data = await response.json();
    console.log(`[getVenues] Fetched ${data.venues?.length ?? 0} venues (page_slug: ${page_slug ?? 'all'})`);
    return data.venues || [];
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('[getVenues] Request timed out');
    } else {
      console.error('[getVenues] Error:', error);
    }
    return [];
  }
}

/**
 * Get a single venue by ID.
 */
export async function getVenueById(id: string): Promise<Item | null> {
  async function attempt(timeoutMs: number): Promise<Item | null> {
    const accessToken = await getAccessToken();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${getApiBase()}/venues/${id}`, {
      method: 'GET',
      headers: authHeaders(accessToken),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('[getVenueById] Error response:', response.status);
      return null;
    }

    const data = await response.json();
    return data.venue || null;
  }

  try {
    const venue = await attempt(20000);
    if (venue) return venue;
    // One retry
    return await attempt(20000);
  } catch (error) {
    console.error('[getVenueById] Error:', error);
    return null;
  }
}

/**
 * Get a single event by ID.
 */
export async function getEventById(id: string): Promise<Item | null> {
  async function attempt(timeoutMs: number): Promise<Item | null> {
    const accessToken = await getAccessToken();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${getApiBase()}/events/${id}`, {
      method: 'GET',
      headers: authHeaders(accessToken),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('[getEventById] Error response:', response.status);
      return null;
    }

    const data = await response.json();
    return data.event || null;
  }

  try {
    const event = await attempt(20000);
    if (event) return event;
    return await attempt(20000);
  } catch (error) {
    console.error('[getEventById] Error:', error);
    return null;
  }
}

/**
 * Create a new item (venue or event).
 */
export async function createItem(
  item: Omit<
    Item,
    | 'id'
    | 'created_at'
    | 'is_custom'
    | 'status'
    | 'submitted_by'
    | 'submitted_by_user_id'
    | 'submitted_by_name'
    | 'page_slug'
  > & { page_slug?: ItemCategory } &
    Record<string, unknown>
): Promise<Item | null> {
  try {
    console.log('🌐 [createItem] POST URL:', `${getApiBase()}/submissions`);
    console.log('🌐 [createItem] POST BODY:', JSON.stringify(item, null, 2));

    const accessToken = await getAccessToken();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${getApiBase()}/submissions`, {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify(item),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('[createItem] Error:', response.status, errorData);
      const msg =
        (errorData && typeof errorData.error === 'string' && errorData.error) ||
        (errorData && typeof errorData.details === 'string' && errorData.details) ||
        `Request failed (${response.status})`;
      throw new Error(msg);
    }

    const data = await response.json();
    return data.submission || null;
  } catch (error) {
    console.error('[createItem] Error:', error);
    if (error instanceof Error) throw error;
    return null;
  }
}

/**
 * Update a venue by ID.
 */
export async function updateVenue(
  id: string,
  venueData: Partial<Item> & Record<string, unknown>
): Promise<Item | null> {
  try {
    const accessToken = await getAccessToken();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${getApiBase()}/venues/${id}`, {
      method: 'PUT',
      headers: authHeaders(accessToken),
      body: JSON.stringify(venueData),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('[updateVenue] Error:', response.status, errorData);
      const msg =
        (errorData && typeof errorData.error === 'string' && errorData.error) ||
        (errorData && typeof errorData.details === 'string' && errorData.details) ||
        `Request failed (${response.status})`;
      throw new Error(msg);
    }

    const data = await response.json();
    return data.venue || null;
  } catch (error) {
    console.error('[updateVenue] Error:', error);
    if (error instanceof Error) throw error;
    return null;
  }
}

/**
 * Update an event by ID.
 */
export async function updateEvent(
  id: string,
  eventData: Partial<Item> & Record<string, unknown>
): Promise<Item | null> {
  try {
    const accessToken = await getAccessToken();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const { page_slug: _omitPageSlug, ...eventPayload } = eventData;

    const response = await fetch(`${getApiBase()}/events/${id}`, {
      method: 'PUT',
      headers: authHeaders(accessToken),
      body: JSON.stringify(eventPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('[updateEvent] Error:', response.status, errorData);
      const msg =
        (errorData && typeof errorData.error === 'string' && errorData.error) ||
        (errorData && typeof errorData.details === 'string' && errorData.details) ||
        `Request failed (${response.status})`;
      throw new Error(msg);
    }

    const data = await response.json();
    return data.event || null;
  } catch (error) {
    console.error('[updateEvent] Error:', error);
    if (error instanceof Error) throw error;
    return null;
  }
}

/**
 * Approve an item (admin only).
 */
export async function approveItem(id: string): Promise<boolean> {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) { console.error('[approveItem] No access token'); return false; }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${getApiBase()}/submissions/${id}/approve`, {
      method: 'PUT',
      headers: authHeaders(accessToken),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('[approveItem] Error:', response.status, await response.json().catch(() => null));
      return false;
    }

    return true;
  } catch (error) {
    console.error('[approveItem] Error:', error);
    return false;
  }
}

/**
 * Reject an item (admin only).
 */
export async function rejectItem(id: string): Promise<boolean> {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) { console.error('[rejectItem] No access token'); return false; }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${getApiBase()}/submissions/${id}/reject`, {
      method: 'PUT',
      headers: authHeaders(accessToken),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('[rejectItem] Error:', response.status, await response.json().catch(() => null));
      return false;
    }

    return true;
  } catch (error) {
    console.error('[rejectItem] Error:', error);
    return false;
  }
}

/**
 * Delete an item (admin only).
 */
export async function deleteItem(id: string): Promise<boolean> {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) { console.error('[deleteItem] No access token'); return false; }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${getApiBase()}/submissions/${id}`, {
      method: 'DELETE',
      headers: authHeaders(accessToken),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('[deleteItem] Error:', response.status, await response.json().catch(() => null));
      return false;
    }

    return true;
  } catch (error) {
    console.error('[deleteItem] Error:', error);
    return false;
  }
}

/**
 * Delete a venue by ID (owner or admin).
 */
export async function deleteVenue(id: string): Promise<boolean> {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) { console.error('[deleteVenue] No access token'); return false; }
    const attemptUrls = [
      `${getApiBase()}/venues/${id}`,
      `${getApiBase()}/submissions/${id}`, // fallback for older backend route layouts
    ];

    for (let i = 0; i < attemptUrls.length; i++) {
      const url = attemptUrls[i];
      const isLastAttempt = i === attemptUrls.length - 1;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      try {
        console.log('[deleteVenue] Request start', { id, url, hasToken: !!accessToken, tokenPrefix: accessToken.slice(0, 16) });
        const response = await fetch(url, {
          method: 'DELETE',
          headers: authHeaders(accessToken),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const responseBody = await response.text().catch(() => '');

        if (response.ok) {
          console.log('[deleteVenue] Success response', { id, url, status: response.status, body: responseBody });
          return true;
        }

        console.error('[deleteVenue] Failed response', {
          id,
          url,
          status: response.status,
          statusText: response.statusText,
          body: responseBody
        });

        // Retry with fallback route unless request is clearly unauthorized.
        if (!isLastAttempt && response.status !== 401) {
          console.warn('[deleteVenue] Trying fallback route after failed primary', { id, failedUrl: url, status: response.status });
          continue;
        }
        if (isLastAttempt || response.status === 401) {
          return false;
        }
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('[deleteVenue] Attempt error', { id, url, error });
      }
    }

    return false;
  } catch (error) {
    console.error('[deleteVenue] Error:', error);
    return false;
  }
}

/**
 * Delete an event by ID (owner or admin).
 */
export async function deleteEvent(id: string): Promise<boolean> {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) { console.error('[deleteEvent] No access token'); return false; }
    const attemptUrls = [
      `${getApiBase()}/events/${id}`,
      `${getApiBase()}/submissions/${id}`, // fallback for older backend route layouts
    ];

    for (let i = 0; i < attemptUrls.length; i++) {
      const url = attemptUrls[i];
      const isLastAttempt = i === attemptUrls.length - 1;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      try {
        console.log('[deleteEvent] Request start', { id, url, hasToken: !!accessToken, tokenPrefix: accessToken.slice(0, 16) });
        const response = await fetch(url, {
          method: 'DELETE',
          headers: authHeaders(accessToken),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const responseBody = await response.text().catch(() => '');

        if (response.ok) {
          console.log('[deleteEvent] Success response', { id, url, status: response.status, body: responseBody });
          return true;
        }

        console.error('[deleteEvent] Failed response', {
          id,
          url,
          status: response.status,
          statusText: response.statusText,
          body: responseBody
        });

        if (!isLastAttempt && [403, 404, 405, 501].includes(response.status)) {
          console.warn('[deleteEvent] Trying fallback route after failed primary', { id, failedUrl: url, status: response.status });
          continue;
        }
        if (isLastAttempt || ![403, 404, 405, 501].includes(response.status)) {
          return false;
        }
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('[deleteEvent] Attempt error', { id, url, error });
      }
    }

    return false;
  } catch (error) {
    console.error('[deleteEvent] Error:', error);
    return false;
  }
}

/**
 * Get current user's venues (authenticated).
 */
export async function getMyVenues(): Promise<Item[]> {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) { console.warn('[getMyVenues] No access token'); return []; }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${getApiBase()}/my-venues`, {
      method: 'GET',
      headers: authHeaders(accessToken),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('[getMyVenues] Error:', response.status);
      if (response.status === 401 || response.status === 403) {
        await supabase.auth.signOut();
      }
      return [];
    }

    const data = await response.json();
    return data.venues || [];
  } catch (error) {
    console.error('[getMyVenues] Error:', error);
    return [];
  }
}

/**
 * Get current user's events (authenticated).
 */
export async function getMyEvents(): Promise<Item[]> {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) { console.warn('[getMyEvents] No access token'); return []; }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${getApiBase()}/my-events`, {
      method: 'GET',
      headers: authHeaders(accessToken),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('[getMyEvents] Error:', response.status);
      if (response.status === 401 || response.status === 403) {
        await supabase.auth.signOut();
      }
      return [];
    }

    const data = await response.json();
    return data.events || [];
  } catch (error) {
    console.error('[getMyEvents] Error:', error);
    return [];
  }
}

/**
 * Delete all of current user's submissions.
 */
export async function deleteAllMySubmissions(): Promise<boolean> {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) { console.error('[deleteAllMySubmissions] No access token'); return false; }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${getApiBase()}/my-submissions/all`, {
      method: 'DELETE',
      headers: authHeaders(accessToken),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('[deleteAllMySubmissions] Error:', response.status);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[deleteAllMySubmissions] Error:', error);
    return false;
  }
}

// ─── Featured Venues ──────────────────────────────────────────────────────────

export async function getFeaturedVenueIds(): Promise<string[]> {
  try {
    const response = await fetch(`${getApiBase()}/featured-venues`, {
      headers: authHeaders(),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.ids || [];
  } catch (error) {
    console.error('[getFeaturedVenueIds] Error:', error);
    return [];
  }
}

export async function getFeaturedVenues(): Promise<Item[]> {
  try {
    const response = await fetch(`${getApiBase()}/featured-venues/full`, {
      headers: authHeaders(),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.venues || [];
  } catch (error) {
    console.error('[getFeaturedVenues] Error:', error);
    return [];
  }
}

export async function toggleFeaturedVenue(
  id: string
): Promise<{ is_featured: boolean; featured_count: number } | null> {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) { console.error('[toggleFeaturedVenue] No access token'); return null; }

    const response = await fetch(`${getApiBase()}/venues/${id}/toggle-featured`, {
      method: 'PATCH',
      headers: authHeaders(accessToken),
    });

    if (!response.ok) {
      console.error('[toggleFeaturedVenue] Error:', response.status);
      return null;
    }

    const data = await response.json();
    return { is_featured: data.is_featured, featured_count: data.featured_count };
  } catch (error) {
    console.error('[toggleFeaturedVenue] Error:', error);
    return null;
  }
}

// ─── Inactive Venues ──────────────────────────────────────────────────────────

export async function getInactiveVenueIds(): Promise<string[]> {
  try {
    const response = await fetch(`${getApiBase()}/inactive-venues`, {
      headers: authHeaders(),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.ids || [];
  } catch (error) {
    console.error('[getInactiveVenueIds] Error:', error);
    return [];
  }
}

export async function toggleVenueActive(
  id: string
): Promise<{ is_active: boolean; inactive_count: number } | null> {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) { console.error('[toggleVenueActive] No access token'); return null; }
    // Prefer /venues/... first: deployed Edge often routes `venues|events` toggles but not `my-*` (404).
    const attemptUrls = [
      `${getApiBase()}/venues/${id}/toggle-active`,
      `${getApiBase()}/my-venues/${id}/toggle-active`,
    ];

    for (let i = 0; i < attemptUrls.length; i++) {
      const url = attemptUrls[i];
      const response = await fetch(url, {
        method: 'PATCH',
        headers: authHeaders(accessToken),
      });
      const responseBody = await response.text().catch(() => '');

      if (!response.ok) {
        console.error('[toggleVenueActive] Failed response', {
          id,
          url,
          method: 'PATCH',
          headers: { hasXAuthToken: true, hasApikey: true },
          status: response.status,
          statusText: response.statusText,
          body: responseBody,
        });
        // If user endpoint returns auth/ownership error, fallback admin route can still work for admin user.
        if (i < attemptUrls.length - 1) continue;
        return null;
      }

      const data = parseJsonSafe(responseBody);
      const isActive = data.is_active;
      if (typeof isActive !== 'boolean') {
        console.error('[toggleVenueActive] Unexpected JSON (missing is_active)', { id, url, body: responseBody, data });
        return null;
      }
      return {
        is_active: isActive,
        inactive_count: typeof data.inactive_count === 'number' ? data.inactive_count : 0,
      };
    }
    return null;
  } catch (error) {
    console.error('[toggleVenueActive] Error:', error);
    return null;
  }
}

// ─── Inactive Events ──────────────────────────────────────────────────────────

export async function getInactiveEventIds(): Promise<string[]> {
  try {
    const response = await fetch(`${getApiBase()}/inactive-events`, {
      headers: authHeaders(),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.ids || [];
  } catch (error) {
    console.error('[getInactiveEventIds] Error:', error);
    return [];
  }
}

export async function toggleEventActive(
  id: string
): Promise<{ is_active: boolean; inactive_count: number } | null> {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) { console.error('[toggleEventActive] No access token'); return null; }
    const attemptUrls = [
      `${getApiBase()}/events/${id}/toggle-active`,
      `${getApiBase()}/my-events/${id}/toggle-active`,
    ];

    for (let i = 0; i < attemptUrls.length; i++) {
      const url = attemptUrls[i];
      const response = await fetch(url, {
        method: 'PATCH',
        headers: authHeaders(accessToken),
      });
      const responseBody = await response.text().catch(() => '');

      if (!response.ok) {
        console.error('[toggleEventActive] Failed response', {
          id,
          url,
          method: 'PATCH',
          headers: { hasXAuthToken: true, hasApikey: true },
          status: response.status,
          statusText: response.statusText,
          body: responseBody,
        });
        if (i < attemptUrls.length - 1) continue;
        return null;
      }

      const data = parseJsonSafe(responseBody);
      const isActive = data.is_active;
      if (typeof isActive !== 'boolean') {
        console.error('[toggleEventActive] Unexpected JSON (missing is_active)', { id, url, body: responseBody, data });
        return null;
      }
      return {
        is_active: isActive,
        inactive_count: typeof data.inactive_count === 'number' ? data.inactive_count : 0,
      };
    }
    return null;
  } catch (error) {
    console.error('[toggleEventActive] Error:', error);
    return null;
  }
}