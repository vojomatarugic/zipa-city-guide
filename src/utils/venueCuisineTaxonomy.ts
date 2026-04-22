/**
 * Controlled venue cuisine (Kuhinja): SR + EN pairs stored as comma-separated strings in `cuisine` / `cuisine_en`.
 */

import { parseVenueTagKeysFromDb, venueTagLabel } from './venueTagLabels';

export const VENUE_CUISINE_ROWS = [
  { sr: 'Azijska', en: 'Asian' },
  { sr: 'Balkanska', en: 'Balkan' },
  { sr: 'Fast food', en: 'Fast food' },
  { sr: 'Internacionalna', en: 'International' },
  { sr: 'Italijanska', en: 'Italian' },
  { sr: 'Kineska', en: 'Chinese' },
  { sr: 'Mediteranska', en: 'Mediterranean' },
  { sr: 'Morska', en: 'Seafood' },
  { sr: 'Picerija', en: 'Pizzeria' },
  { sr: 'Poslastičarnica', en: 'Dessert' },
  { sr: 'Roštilj', en: 'Grill' },
  { sr: 'Steakhouse', en: 'Steakhouse' },
  { sr: 'Tajlandska', en: 'Thai' },
  { sr: 'Tradicionalna', en: 'Traditional' },
  { sr: 'Vegetarijanska', en: 'Vegetarian' },
  { sr: 'Veganska', en: 'Vegan' },
] as const;

const SR_SET: Set<string> = new Set(VENUE_CUISINE_ROWS.map((r) => r.sr));

const SR_BY_NORMAL = new Map<string, string>();
const EN_BY_NORMAL = new Map<string, string>();

for (const row of VENUE_CUISINE_ROWS) {
  SR_BY_NORMAL.set(normalizeLabel(row.sr), row.sr);
  EN_BY_NORMAL.set(normalizeLabel(row.en), row.sr);
}

/** Map legacy / alternate wording → canonical SR label from {@link VENUE_CUISINE_ROWS}. */
const LEGACY_TO_CANONICAL_SR: Record<string, string> = (() => {
  const pairs: [string, string][] = [
    ['internacionalna', 'Internacionalna'],
    ['international', 'Internacionalna'],
    ['rostilj', 'Roštilj'],
    ['roštilj', 'Roštilj'],
    ['riblja', 'Morska'],
    ['seafood', 'Morska'],
    ['slasticarnica', 'Poslastičarnica'],
    ['slastičarnica', 'Poslastičarnica'],
    ['pastry shop', 'Poslastičarnica'],
    ['deserti', 'Poslastičarnica'],
    ['desserts', 'Poslastičarnica'],
    ['gelato', 'Poslastičarnica'],
    ['picerija', 'Picerija'],
    ['pizzeria', 'Picerija'],
  ];
  const m: Record<string, string> = {};
  for (const [k, sr] of pairs) {
    m[normalizeLabel(k)] = sr;
  }
  return m;
})();

export function normalizeLabel(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/č/g, 'c')
    .replace(/ć/g, 'c')
    .replace(/š/g, 's')
    .replace(/ž/g, 'z')
    .replace(/đ/g, 'dj')
    .replace(/\s+/g, ' ');
}

export function segmentToCanonicalSr(segment: string): string | null {
  const t = segment.trim();
  if (!t) return null;
  if (SR_SET.has(t)) return t;
  const n = normalizeLabel(t);
  if (LEGACY_TO_CANONICAL_SR[n]) return LEGACY_TO_CANONICAL_SR[n];
  if (SR_BY_NORMAL.has(n)) return SR_BY_NORMAL.get(n)!;
  if (EN_BY_NORMAL.has(n)) return EN_BY_NORMAL.get(n)!;
  return null;
}

export function parseCommaSegments(raw: string | undefined | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Load up to 2 canonical SR selections for the form (from DB cuisine / cuisine_en). */
export function parseCuisineSrSelectionsFromDb(
  cuisine: string | undefined | null,
  cuisine_en?: string | undefined | null
): string[] {
  const out: string[] = [];
  for (const seg of parseCommaSegments(cuisine || '')) {
    const c = segmentToCanonicalSr(seg);
    if (c && !out.includes(c)) out.push(c);
    if (out.length >= 2) return out;
  }
  for (const seg of parseCommaSegments(cuisine_en || '')) {
    const c = segmentToCanonicalSr(seg);
    if (c && !out.includes(c)) out.push(c);
    if (out.length >= 2) break;
  }
  return out.slice(0, 2);
}

export function serializeCuisineForDb(srSelected: string[]): { cuisine: string; cuisine_en: string } {
  const srs = srSelected
    .filter((s) => SR_SET.has(s))
    .filter((s, i, a) => a.indexOf(s) === i)
    .slice(0, 2);
  const ens = srs.map((sr) => VENUE_CUISINE_ROWS.find((r) => r.sr === sr)!.en);
  return {
    cuisine: srs.length ? srs.join(', ') : '',
    cuisine_en: ens.length ? ens.join(', ') : '',
  };
}

function cuisineDisplaySegment(segment: string, lang: 'sr' | 'en'): string {
  const canon = segmentToCanonicalSr(segment);
  if (!canon) return segment.trim();
  const row = VENUE_CUISINE_ROWS.find((r) => r.sr === canon);
  if (!row) return segment.trim();
  return lang === 'en' ? row.en : row.sr;
}

/** Hero / listing: cuisine segments (max 2) in the active UI language. */
export function buildCuisineBadgeLabelsForLang(
  cuisine: string | undefined | null,
  cuisine_en: string | undefined | null,
  lang: 'sr' | 'en'
): string[] {
  const source =
    lang === 'en' && cuisine_en?.trim()
      ? parseCommaSegments(cuisine_en)
      : parseCommaSegments(cuisine || '');
  const out: string[] = [];
  for (const seg of source) {
    out.push(cuisineDisplaySegment(seg, lang));
    if (out.length >= 2) break;
  }
  return out;
}

export function buildVenueListingBadgeLabels(params: {
  venue_type?: string | null;
  cuisine?: string | null;
  cuisine_en?: string | null;
  tags?: string | string[] | null;
  lang: 'sr' | 'en';
  tVenueType: (key: string) => string;
}): string[] {
  const { venue_type, cuisine, cuisine_en, tags, lang, tVenueType } = params;
  const out: string[] = [];
  const vt = (venue_type || '').trim();
  if (vt) out.push(tVenueType(vt));
  out.push(...buildCuisineBadgeLabelsForLang(cuisine, cuisine_en, lang).slice(0, 2));
  for (const key of parseVenueTagKeysFromDb(tags).slice(0, 2)) {
    const lab = venueTagLabel(key, lang);
    if (lab) out.push(lab);
  }
  return out;
}

/** Detail hero: cuisine + oznaka only (no venue type). */
export function buildVenueHeroSecondaryBadgeLabels(params: {
  cuisine?: string | null;
  cuisine_en?: string | null;
  tags?: string | string[] | null;
  lang: 'sr' | 'en';
}): string[] {
  const { cuisine, cuisine_en, tags, lang } = params;
  const out: string[] = [...buildCuisineBadgeLabelsForLang(cuisine, cuisine_en, lang).slice(0, 2)];
  for (const key of parseVenueTagKeysFromDb(tags).slice(0, 2)) {
    const lab = venueTagLabel(key, lang);
    if (lab) out.push(lab);
  }
  return out;
}
