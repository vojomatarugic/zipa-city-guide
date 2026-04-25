/**
 * Canonical React Router path for venue detail (`<Link>`, `navigate`, `href`).
 * `page_slug` is required in normal operation and is derived from `venue_type`; only these values are supported:
 *
 * - `clubs` → `/clubs/:id`
 * - `food-and-drink`, `restaurants`, `cafes` (legacy) → `/food-and-drink/:id`
 *
 * REST/API URLs stay separate from this helper.
 */
const CLUB_SLUGS = new Set(["clubs"]);
const FOOD_SLUGS = new Set(["food-and-drink", "restaurants", "cafes"]);

export function venueDetailPath(venue: {
  id: string;
  page_slug?: string | null;
}): string {
  const slug = String(venue.page_slug ?? "").toLowerCase().trim();

  if (CLUB_SLUGS.has(slug)) {
    return `/clubs/${venue.id}`;
  }
  if (FOOD_SLUGS.has(slug)) {
    return `/food-and-drink/${venue.id}`;
  }

  throw new Error(
    `[venueDetailPath] unsupported page_slug "${slug}" — expected clubs, food-and-drink, restaurants, or cafes.`,
  );
}
