import type { ItemCategory, VenueType } from '../utils/dataService';

/**
 * Single source of truth: venue_type -> page_slug routing bucket.
 */
export const VENUE_TYPE_TO_PAGE_SLUG: Record<VenueType, ItemCategory> = {
  restaurant: 'food-and-drink',
  cafe: 'food-and-drink',
  bar: 'food-and-drink',
  pub: 'food-and-drink',
  brewery: 'food-and-drink',
  kafana: 'food-and-drink',
  fast_food: 'food-and-drink',
  cevabdzinica: 'food-and-drink',
  pizzeria: 'food-and-drink',
  dessert_shop: 'food-and-drink',
  nightclub: 'clubs',
  other: 'food-and-drink',
};

export function resolvePageSlugForVenueType(venueType: string | null | undefined): ItemCategory | null {
  if (!venueType) return null;
  const normalized = venueType.trim().toLowerCase() as VenueType;
  return VENUE_TYPE_TO_PAGE_SLUG[normalized] ?? null;
}

