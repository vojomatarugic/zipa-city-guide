/**
 * Single source for category accent / hero / CTA colors used across listing and detail pages.
 * Restaurants follow food-and-drink detail; clubs follow ClubsPage; events follow EventsPage / EventsAllPage.
 */

/** RGB components for #D81B60 (Material Pink 600) — matches ClubsPage hero overlay */
export const CLUBS_CATEGORY_RGB = "216, 27, 96" as const;

export const CLUBS_HERO_OVERLAY_GRADIENT =
  `linear-gradient(rgba(${CLUBS_CATEGORY_RGB}, 0.65), rgba(${CLUBS_CATEGORY_RGB}, 0.65))` as const;

/** ClubsAllPage hero: tinted overlay + dark bottom (replaces legacy purple overlay). */
export const CLUBS_LISTING_HERO_OVERLAY =
  `linear-gradient(rgba(${CLUBS_CATEGORY_RGB}, 0.5), rgba(0, 0, 0, 0.7))` as const;

/** Nightlife / clubs — same accent as ClubsPage, ClubsAllPage, ClubDetailPage */
export const CLUBS_CATEGORY_THEME = {
  accentColor: "#D81B60",
  heroGradient: "linear-gradient(135deg, #D81B60, #E91E63)",
  ctaBackground: "#D81B60",
  ctaBorder: "1px solid #6B7280",
} as const;

/** Food & drink venue detail — brown hero + teal accents (reference: FoodAndDrinkDetailPage) */
export const FOOD_VENUE_THEME = {
  accentColor: "#00897B",
  heroGradient: "linear-gradient(135deg, #8B6F47, #A0785A)",
  ctaBackground: "#8B6F47",
  ctaBorder: "1px solid #6B7280",
} as const;

/** RGB for #FB8C00 — events listing accent (EventsPage, EventsAllPage) */
export const EVENTS_CATEGORY_RGB = "251, 140, 0" as const;

export const EVENTS_HERO_OVERLAY_GRADIENT =
  `linear-gradient(rgba(${EVENTS_CATEGORY_RGB}, 0.65), rgba(${EVENTS_CATEGORY_RGB}, 0.65))` as const;

/** Main events listing — matches EventsPage / EventsAllPage */
export const EVENTS_CATEGORY_THEME = {
  accentColor: "#FB8C00",
  heroGradient: "linear-gradient(135deg, #FB8C00, #FF9800)",
  ctaBackground: "#FB8C00",
  ctaBorder: "1px solid #6B7280",
} as const;

export type EventDetailTheme = {
  primary: string;
  gradient: string;
  accent: string;
  buttonBg: string;
};

/** Event detail hero/sidebar — slug-specific; `events` uses EVENTS_CATEGORY_THEME; `clubs` uses CLUBS_CATEGORY_THEME */
export const EVENT_DETAIL_THEMES: Record<string, EventDetailTheme> = {
  concerts: {
    primary: "#C0CA33",
    gradient: "linear-gradient(135deg, #C0CA33, #D4E157)",
    accent: "#C0CA33",
    buttonBg: "#C0CA33",
  },
  theatre: {
    primary: "#8E24AA",
    gradient: "linear-gradient(135deg, #8E24AA, #AB47BC)",
    accent: "#8E24AA",
    buttonBg: "#8E24AA",
  },
  cinema: {
    primary: "#00897B",
    gradient: "linear-gradient(135deg, #00897B, #26A69A)",
    accent: "#00897B",
    buttonBg: "#00897B",
  },
  clubs: {
    primary: CLUBS_CATEGORY_THEME.accentColor,
    gradient: CLUBS_CATEGORY_THEME.heroGradient,
    accent: CLUBS_CATEGORY_THEME.accentColor,
    buttonBg: CLUBS_CATEGORY_THEME.ctaBackground,
  },
  events: {
    primary: EVENTS_CATEGORY_THEME.accentColor,
    gradient: EVENTS_CATEGORY_THEME.heroGradient,
    accent: EVENTS_CATEGORY_THEME.accentColor,
    buttonBg: EVENTS_CATEGORY_THEME.ctaBackground,
  },
};

export const EVENT_DETAIL_DEFAULT_SLUG = "events" as const;

const BADGE_TEXT_COLOR_BY_PAGE_SLUG: Record<string, string> = {
  cinema: "#00897B",
  theatre: "#8E24AA",
  concerts: "#C0CA33",
  "food-and-drink": "#8B6F47",
};

/** Pass top-level category from {@link getTopLevelPageCategory} (theatre | cinema | concerts | events), or legacy keys like `clubs`. */
export function getEventDetailTheme(
  topLevelCategoryOrSlug: string | undefined
): EventDetailTheme {
  if (!topLevelCategoryOrSlug) return EVENT_DETAIL_THEMES[EVENT_DETAIL_DEFAULT_SLUG];
  return (
    EVENT_DETAIL_THEMES[topLevelCategoryOrSlug] ??
    EVENT_DETAIL_THEMES[EVENT_DETAIL_DEFAULT_SLUG]
  );
}

export function getBadgeTextColorForPageSlug(pageSlug?: string): string {
  if (!pageSlug) return "#6B7280";
  return BADGE_TEXT_COLOR_BY_PAGE_SLUG[pageSlug] || "#6B7280";
}
