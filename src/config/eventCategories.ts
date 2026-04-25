type EventCategoryLanguage = "sr" | "en";

type EventCategoryOption = {
  key: string;
  label: Record<EventCategoryLanguage, string>;
};

type EventCategoryGroup = {
  label: Record<EventCategoryLanguage, string>;
  placeholder: Record<EventCategoryLanguage, string>;
  options: EventCategoryOption[];
};

export const EVENT_CATEGORY_CONFIG = {
  cinema: {
    label: { sr: "Žanr", en: "Genre" },
    placeholder: { sr: "Odaberite žanr", en: "Select genre" },
    options: [
      { key: "action", label: { sr: "Akcija", en: "Action" } },
      { key: "comedy", label: { sr: "Komedija", en: "Comedy" } },
      { key: "drama", label: { sr: "Drama", en: "Drama" } },
      { key: "horror", label: { sr: "Horor", en: "Horror" } },
      { key: "thriller", label: { sr: "Triler", en: "Thriller" } },
      { key: "romance", label: { sr: "Romansa", en: "Romance" } },
      { key: "animation", label: { sr: "Animirani", en: "Animation" } },
      { key: "documentary", label: { sr: "Dokumentarni", en: "Documentary" } },
      { key: "sci_fi", label: { sr: "Sci-Fi", en: "Sci-Fi" } },
    ],
  },
  theatre: {
    label: { sr: "Tip predstave", en: "Performance type" },
    placeholder: { sr: "Odaberite tip predstave", en: "Select performance type" },
    options: [
      { key: "drama", label: { sr: "Drama", en: "Drama" } },
      { key: "comedy", label: { sr: "Komedija", en: "Comedy" } },
      { key: "monodrama", label: { sr: "Monodrama", en: "Monodrama" } },
      { key: "musical", label: { sr: "Mjuzikl", en: "Musical" } },
      { key: "opera", label: { sr: "Opera", en: "Opera" } },
      { key: "ballet", label: { sr: "Balet", en: "Ballet" } },
      {
        key: "children_play",
        label: { sr: "Dječija predstava", en: "Children play" },
      },
      {
        key: "experimental",
        label: { sr: "Eksperimentalno", en: "Experimental" },
      },
    ],
  },
  concert: {
    label: { sr: "Vrsta muzike", en: "Music type" },
    placeholder: { sr: "Odaberite vrstu muzike", en: "Select music type" },
    options: [
      { key: "rock", label: { sr: "Rock", en: "Rock" } },
      { key: "pop", label: { sr: "Pop", en: "Pop" } },
      { key: "electronic", label: { sr: "Elektronska", en: "Electronic" } },
      { key: "hip_hop", label: { sr: "Hip-Hop", en: "Hip-Hop" } },
      { key: "jazz", label: { sr: "Jazz", en: "Jazz" } },
      { key: "classical", label: { sr: "Klasika", en: "Classical" } },
      { key: "folk", label: { sr: "Folk", en: "Folk" } },
      { key: "live_band", label: { sr: "Live band", en: "Live band" } },
      { key: "dj_set", label: { sr: "DJ set", en: "DJ set" } },
      { key: "festival", label: { sr: "Festival", en: "Festival" } },
    ],
  },
} as const satisfies Record<string, EventCategoryGroup>;

export type EventCategoryEventType = keyof typeof EVENT_CATEGORY_CONFIG;

function getEventCategoryRawConfig(
  eventType: string,
): (typeof EVENT_CATEGORY_CONFIG)[EventCategoryEventType] | undefined {
  if (eventType in EVENT_CATEGORY_CONFIG) {
    return EVENT_CATEGORY_CONFIG[eventType as EventCategoryEventType];
  }
  return undefined;
}

function normalizeLanguage(language: string): EventCategoryLanguage {
  return language === "en" ? "en" : "sr";
}

/** Translated config for form UI (label, placeholder, option labels). */
export function getEventCategoryConfig(eventType: string, language: string) {
  const config = getEventCategoryRawConfig(eventType);
  if (!config) return undefined;
  const lang = normalizeLanguage(language);
  return {
    label: config.label[lang],
    placeholder: config.placeholder[lang],
    options: config.options.map((option) => ({
      key: option.key,
      label: option.label[lang],
    })),
  };
}

/** Backward-compatible alias used by existing form code. */
export function getEventCategoryUiConfig(eventType: string, language = "sr") {
  return getEventCategoryConfig(eventType, language);
}

/** Normalize raw DB/form value (legacy SR/EN label or key) into persisted key. */
export function normalizeEventCategory(
  eventType: string,
  value: unknown,
): string | null {
  const config = getEventCategoryRawConfig(eventType);
  if (!config) return null;
  if (value === undefined || value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const normalizedRaw = raw.toLowerCase();
  const match = config.options.find((option) => {
    return (
      option.key.toLowerCase() === normalizedRaw ||
      option.label.sr.toLowerCase() === normalizedRaw ||
      option.label.en.toLowerCase() === normalizedRaw
    );
  });
  return match ? match.key : null;
}

/** Persisted value: non-config types -> null; config types -> normalized key or null. */
export function resolveEventCategoryForPayload(
  eventType: string,
  category: string,
): string | null {
  return normalizeEventCategory(eventType, category);
}

/** Category key -> localized label for rendering. */
export function getEventCategoryLabel(
  eventType: string,
  categoryKey: string,
  language: string,
): string {
  const config = getEventCategoryRawConfig(eventType);
  if (!config) return categoryKey;
  const normalized = normalizeEventCategory(eventType, categoryKey);
  if (!normalized) return categoryKey;
  const lang = normalizeLanguage(language);
  const match = config.options.find((option) => option.key === normalized);
  return match ? match.label[lang] : categoryKey;
}
