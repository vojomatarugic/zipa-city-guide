/**
 * Event Service - Events with datetime filtering
 */

import { projectId, publicAnonKey } from './supabase/info';
import { Item } from './dataService';
import { supabase } from './supabaseClient';

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
  try {
    const date = new Date(startAt);
    
    if (language === 'sr') {
      const day = date.getDate();
      const month = date.toLocaleDateString('sr-Latn', { month: 'long' });
      const year = date.getFullYear();
      return `${day}. ${month} ${year}.`;
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      });
    }
  } catch (error) {
    console.error('Error formatting date:', error);
    return startAt;
  }
}

/**
 * Format event time for display
 */
export function formatEventTime(startAt: string, endAt?: string | null): string {
  try {
    const start = new Date(startAt);
    const startTime = start.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
    
    if (endAt) {
      const end = new Date(endAt);
      const endTime = end.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
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
  try {
    const url = `${API_BASE_URL}/events?filter=all`;
    
    console.log('📋 Fetching all events from:', url);
    
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
    console.log(`✅ Fetched ${data.events?.length || 0} events for admin`);
    return data.events || [];
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
    const url = `${API_BASE_URL}/events/${id}/approve`;
    
    console.log('✅ Approving event:', id);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'PATCH',
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
    const url = `${API_BASE_URL}/events/${id}/reject`;
    
    console.log('❌ Rejecting event:', id);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'PATCH',
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
    
    console.log('🗑️ Deleting event:', id);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'DELETE',
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