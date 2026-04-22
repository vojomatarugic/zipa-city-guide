export const EVENT_CATEGORY_CONFIG = {
  cinema: {
    label: "Žanr",
    placeholder: "Odaberite žanr",
    options: [
      "Akcija",
      "Komedija",
      "Drama",
      "Horor",
      "Triler",
      "Romansa",
      "Animirani",
      "Dokumentarni",
      "Sci-Fi",
    ],
  },

  theatre: {
    label: "Tip predstave",
    placeholder: "Odaberite tip predstave",
    options: [
      "Drama",
      "Komedija",
      "Monodrama",
      "Mjuzikl",
      "Opera",
      "Balet",
      "Dječija predstava",
      "Eksperimentalno",
    ],
  },

  concert: {
    label: "Vrsta muzike",
    placeholder: "Odaberite vrstu muzike",
    options: [
      "Rock",
      "Pop",
      "Elektronska",
      "Hip-Hop",
      "Jazz",
      "Klasika",
      "Folk",
      "Live band",
      "DJ set",
      "Festival",
    ],
  },
} as const;

const CATEGORY_TRANSLATIONS: Record<string, string> = {
  Dokumentarni: "Documentary",
  Drama: "Drama",
  Komedija: "Comedy",
  Akcija: "Action",
  Romansa: "Romance",
  Horor: "Horror",
};

export type EventCategoryEventType = keyof typeof EVENT_CATEGORY_CONFIG;

export function getEventCategoryUiConfig(
  eventType: string
): (typeof EVENT_CATEGORY_CONFIG)[EventCategoryEventType] | undefined {
  if (eventType in EVENT_CATEGORY_CONFIG) {
    return EVENT_CATEGORY_CONFIG[eventType as EventCategoryEventType];
  }
  return undefined;
}

/** Persisted value: non-config types -> null; config types -> trimmed string or null. */
export function resolveEventCategoryForPayload(
  eventType: string,
  category: string
): string | null {
  if (!getEventCategoryUiConfig(eventType)) return null;
  const trimmed = category.trim();
  return trimmed || null;
}

export function getLocalizedEventCategory(category: string, language: string): string {
  if (language !== "en") return category;
  return CATEGORY_TRANSLATIONS[category] || category;
}
