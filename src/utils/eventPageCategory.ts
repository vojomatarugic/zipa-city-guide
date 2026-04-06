import type { Item } from "./dataService";

/**
 * Top-level listing/detail routing for events (separate from raw `event_type`).
 * Used for filters and hero accent colors — not for display labels.
 */
export type TopLevelPageCategory = "theatre" | "cinema" | "concerts" | "events";

/**
 * Maps an event to the English page slug used for listings and detail theming.
 * Raw `event_type` (e.g. festival, standup, exhibition) is unchanged on the item.
 */
export function getTopLevelPageCategory(event: Item): TopLevelPageCategory {
  const t = (event.event_type || "").toLowerCase().trim();

  if (t === "theatre") return "theatre";
  if (t === "cinema") return "cinema";
  if (t === "concert" || t === "music") return "concerts";

  if (!t) {
    const slug = event.page_slug;
    if (slug === "theatre") return "theatre";
    if (slug === "cinema") return "cinema";
    if (slug === "concerts") return "concerts";
  }

  return "events";
}
