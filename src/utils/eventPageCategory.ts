import type { Item } from "./dataService";

/**
 * Top-level listing/detail routing for events (separate from raw `event_type`).
 * Used for filters and hero accent colors — not for display labels.
 */
export type TopLevelPageCategory = "theatre" | "cinema" | "concerts" | "events";

export function getCanonicalEventPageSlug(
  eventType?: string | null,
  rawPageSlug?: string | null
): TopLevelPageCategory {
  // Persisted listing bucket (`page_slug`) wins over fine-grained `event_type`, same as
  // TheatrePage `isApprovedTheatreEvent` / CinemaPage `isApprovedCinemaEvent` (e.g. standup
  // with page_slug theatre stays "theatre", not "events").
  const slug = (rawPageSlug || "").toLowerCase().trim();
  if (slug === "concerts") return "concerts";
  if (slug === "cinema") return "cinema";
  if (slug === "theatre") return "theatre";

  const t = (eventType || "").toLowerCase().trim();
  if (t === "concert") return "concerts";
  if (t === "cinema") return "cinema";
  if (t === "theatre") return "theatre";
  if (t) return "events";

  return "events";
}

/**
 * Maps an event to the English page slug used for listings and detail theming.
 * Raw `event_type` (e.g. festival, standup, exhibition) is unchanged on the item.
 */
export function getTopLevelPageCategory(event: Item): TopLevelPageCategory {
  return getCanonicalEventPageSlug(event.event_type, event.page_slug);
}

/**
 * **Single standard** for user-facing event detail links (`<Link>`, `navigate`, `href`).
 * Use this instead of hardcoding `/events/:id`, `/concerts/:id`, etc. Same bucket rules as admin.
 * REST/API URLs (`getApiBase()/events/...`) stay separate — do not route HTTP through this.
 */
export function eventDetailPath(event: {
  id: string;
  event_type?: string | null;
  page_slug?: string | null;
}): string {
  const slug = getCanonicalEventPageSlug(event.event_type, event.page_slug);
  return `/${slug}/${event.id}`;
}
