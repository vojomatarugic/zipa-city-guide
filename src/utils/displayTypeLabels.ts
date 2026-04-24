import type { translations } from "./translations";
import * as eventService from "./eventService";

export type TranslationFn = (key: keyof typeof translations) => string;

/** Normalize DB slug / `page_slug` fragments for `venueTypeFooBar` translation keys. */
function normalizeVenueTypeToken(raw: string): string {
  return raw.trim().toLowerCase().replace(/-/g, "_");
}

/**
 * Localized venue type for badges and cards (value only — no "Venue type:" prefix).
 * Resolves `venueType` + PascalCase from snake_case / kebab-case, then bare keys, then title case.
 */
export function formatVenueTypeForBadge(
  venueTypeRaw: string | null | undefined,
  translate: TranslationFn,
): string {
  const normalized = normalizeVenueTypeToken(venueTypeRaw || "");
  if (!normalized) return "";
  const suffix = normalized
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
  const venueTypeKey = `venueType${suffix}` as keyof typeof translations;
  const fromVenueTypePrefix = translate(venueTypeKey);
  if (fromVenueTypePrefix !== (venueTypeKey as string)) return fromVenueTypePrefix;

  const fromBare = translate(normalized as keyof typeof translations);
  if (fromBare !== normalized) return fromBare;

  return normalized
    .split("_")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

/** Localized event type for badges (value only). */
export function formatEventTypeForBadge(
  eventTypeRaw: string | null | undefined,
  lang: "sr" | "en",
  pageSlugFallback?: string | null,
): string {
  const raw = (eventTypeRaw || pageSlugFallback || "").trim();
  if (!raw) return "";
  return eventService.translateEventType(raw, lang);
}
