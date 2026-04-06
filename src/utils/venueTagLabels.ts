/** Controlled venue “Oznaka” keys stored in DB `tags` as Postgres `text[]` (legacy rows may be a comma-separated string). */

export const VENUE_TAG_KEYS = [
  'cocktails',
  'craft-beer',
  'draft-beer',
  'dj',
  'family-friendly',
  'garden',
  'hookah',
  'karaoke',
  'live-music',
  'lounge',
  'rakija',
  'romantic',
  'rooftop',
  'sports-screening',
  'terrace',
  'wine-list',
] as const;

export type VenueTagKey = (typeof VENUE_TAG_KEYS)[number];

const KEY_SET = new Set<string>(VENUE_TAG_KEYS);

const DEFINITIONS: Record<VenueTagKey, { sr: string; en: string }> = {
  'draft-beer': { sr: 'Točeno pivo', en: 'Draft beer' },
  'craft-beer': { sr: 'Craft pivo', en: 'Craft beer' },
  cocktails: { sr: 'Kokteli', en: 'Cocktails' },
  'wine-list': { sr: 'Vinska karta', en: 'Wine list' },
  rakija: { sr: 'Rakija', en: 'Rakija' },
  'live-music': { sr: 'Live muzika', en: 'Live music' },
  dj: { sr: 'DJ', en: 'DJ' },
  karaoke: { sr: 'Karaoke', en: 'Karaoke' },
  hookah: { sr: 'Nargila', en: 'Hookah' },
  lounge: { sr: 'Lounge', en: 'Lounge' },
  rooftop: { sr: 'Rooftop', en: 'Rooftop' },
  garden: { sr: 'Bašta', en: 'Garden' },
  terrace: { sr: 'Terasa', en: 'Terrace' },
  'sports-screening': { sr: 'Sportski prenosi', en: 'Sports screening' },
  romantic: { sr: 'Romantično', en: 'Romantic' },
  'family-friendly': { sr: 'Porodično', en: 'Family-friendly' },
};

export function isVenueTagKey(k: string): k is VenueTagKey {
  return KEY_SET.has(k);
}

export function venueTagLabel(key: string, lang: 'sr' | 'en'): string {
  if (!isVenueTagKey(key)) return '';
  const d = DEFINITIONS[key];
  return lang === 'en' ? d.en : d.sr;
}

export function venueTagOptionsForLang(lang: 'sr' | 'en'): { key: VenueTagKey; label: string }[] {
  return VENUE_TAG_KEYS.map((key) => ({
    key,
    label: venueTagLabel(key, lang),
  }));
}

/** Parse DB/API value into up to 2 known keys (legacy comma-separated string still supported). */
export function parseVenueTagKeysFromDb(raw: string | string[] | null | undefined): VenueTagKey[] {
  const parts =
    typeof raw === 'string'
      ? raw.split(',').map((t) => t.trim()).filter(Boolean)
      : (raw ?? []).map((x) => String(x).trim()).filter(Boolean);
  const out: VenueTagKey[] = [];
  for (const p of parts) {
    if (isVenueTagKey(p) && !out.includes(p)) out.push(p);
    if (out.length >= 2) break;
  }
  return out;
}

/** Listing line under title: resolved oznaka labels, else legacy text, else fallback. */
export function venueTagsFallbackLine(
  tags: string | string[] | null | undefined,
  lang: 'sr' | 'en',
  fallback: string
): string {
  const keys = parseVenueTagKeysFromDb(tags);
  if (keys.length > 0) {
    return keys.map((k) => venueTagLabel(k, lang)).filter(Boolean).join(' · ');
  }
  if (typeof tags === 'string' && tags.trim()) return tags.trim();
  if (Array.isArray(tags)) {
    const raw = tags.map((x) => String(x).trim()).filter(Boolean);
    if (raw.length) return raw.join(' · ');
  }
  return fallback;
}
