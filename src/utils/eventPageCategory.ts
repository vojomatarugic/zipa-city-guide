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
  const t = (eventType || "").toLowerCase().trim();
  if (t === "concert") return "concerts";
  if (t === "cinema") return "cinema";
  if (t === "theatre") return "theatre";
  if (t) return "events";

  const slug = (rawPageSlug || "").toLowerCase().trim();
  if (slug === "concerts") return "concerts";
  if (slug === "cinema") return "cinema";
  if (slug === "theatre") return "theatre";
  return "events";
}

/**
 * Maps an event to the English page slug used for listings and detail theming.
 * Raw `event_type` (e.g. festival, standup, exhibition) is unchanged on the item.
 */
export function getTopLevelPageCategory(event: Item): TopLevelPageCategory {
  return getCanonicalEventPageSlug(event.event_type, event.page_slug);
}
