/**
 * Canonical cuisine slugs (stored comma-separated in Item.cuisine, max 2 values).
 * Legacy Latin labels from DB are mapped to slugs for display/translation.
 */

import type { TranslationKey } from './translations';

export const CUISINE_SLUGS: string[] = [
  'americka',
  'autorska',
  'azijska',
  'balkanska',
  'bosanska',
  'craft_pivo',
  'crnogorska',
  'dalmatinska',
  'delikatese',
  'deserti',
  'fast_food',
  'francuska',
  'fuzija',
  'grcka',
  'hrvatska',
  'internacionalna',
  'irska',
  'italijanska',
  'kafa',
  'kolaci',
  'makedonska',
  'mediteranska',
  'moderna',
  'pub_hrana',
  'riblja',
  'rostilj',
  'sladoled',
  'slasticarnica',
  'slovenska',
  'specialty_kafa',
  'srpska',
  'street_food',
  'tradicionalna',
  'vino',
  'caj',
  'cokolada',
];

/** Normalize user/legacy label for lookup (Latin, lowercase, ASCII-ish). */
export function normalizeCuisineLabel(s: string): string {
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

/** Maps normalized legacy labels (from seed / free text) → canonical slug. */
const LEGACY_LABEL_TO_SLUG: Record<string, string> = (() => {
  const pairs: [string, string][] = [
    ['americka', 'americka'],
    ['autorska', 'autorska'],
    ['azijska', 'azijska'],
    ['balkanska', 'balkanska'],
    ['bosanska', 'bosanska'],
    ['craft pivo', 'craft_pivo'],
    ['crnogorska', 'crnogorska'],
    ['dalmatinska', 'dalmatinska'],
    ['delikatese', 'delikatese'],
    ['deserti', 'deserti'],
    ['fast food', 'fast_food'],
    ['francuska', 'francuska'],
    ['fuzija', 'fuzija'],
    ['grcka', 'grcka'],
    ['grčka', 'grcka'],
    ['hrvatska', 'hrvatska'],
    ['internacionalna', 'internacionalna'],
    ['irska', 'irska'],
    ['italijanska', 'italijanska'],
    ['kafa', 'kafa'],
    ['kolaci', 'kolaci'],
    ['kolači', 'kolaci'],
    ['makedonska', 'makedonska'],
    ['mediteranska', 'mediteranska'],
    ['moderna', 'moderna'],
    ['pub hrana', 'pub_hrana'],
    ['riblja', 'riblja'],
    ['rostilj', 'rostilj'],
    ['roštilj', 'rostilj'],
    ['sladoled', 'sladoled'],
    ['slasticarnica', 'slasticarnica'],
    ['slastičarnica', 'slasticarnica'],
    ['slovenska', 'slovenska'],
    ['specialty kafa', 'specialty_kafa'],
    ['srpska', 'srpska'],
    ['street food', 'street_food'],
    ['tradicionalna', 'tradicionalna'],
    ['vino', 'vino'],
    ['caj', 'caj'],
    ['čaj', 'caj'],
    ['cokolada', 'cokolada'],
    ['čokolada', 'cokolada'],
  ];
  const m: Record<string, string> = {};
  for (const [k, slug] of pairs) {
    m[normalizeCuisineLabel(k)] = slug;
  }
  return m;
})();

const SLUG_SET = new Set(CUISINE_SLUGS);

export function slugToTranslationKey(slug: string): string {
  const pascal = slug
    .split('_')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('');
  return `cuisineOpt${pascal}`;
}

/** One segment (trimmed) from DB → canonical slug, or null if unknown. */
export function segmentToSlug(segment: string): string | null {
  const t = segment.trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  if (/^[a-z]+(_[a-z]+)*$/.test(lower) && SLUG_SET.has(lower)) return lower;
  const mapped = LEGACY_LABEL_TO_SLUG[normalizeCuisineLabel(t)];
  return mapped ?? null;
}

/** Up to 2 comma-separated segments from stored cuisine string. */
export function parseCuisineSegments(raw: string | undefined | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 2);
}

export type CuisineChip = { kind: 'slug'; slug: string } | { kind: 'raw'; text: string };

/** Form state from DB: known slugs + legacy unmapped text (max 2 total). */
export function parseCuisineChips(raw: string | undefined | null): CuisineChip[] {
  const out: CuisineChip[] = [];
  for (const seg of parseCuisineSegments(raw)) {
    const slug = segmentToSlug(seg);
    if (slug) out.push({ kind: 'slug', slug });
    else out.push({ kind: 'raw', text: seg });
    if (out.length >= 2) break;
  }
  return out;
}

export function serializeCuisineChips(chips: CuisineChip[]): string {
  return chips
    .map((c) => (c.kind === 'slug' ? c.slug : c.text))
    .filter(Boolean)
    .join(', ');
}

export function cuisineSlugLabel(slug: string, t: (key: TranslationKey) => string): string {
  const key = slugToTranslationKey(slug) as TranslationKey;
  const label = t(key);
  if (label === key) return slug.replace(/_/g, ' ');
  return label;
}

/** Listing/detail: max 3 badges — venue_type then up to 2 cuisine labels (translated when known). */
export function buildVenueBadgeLabels(
  venue_type: string | undefined | null,
  cuisine: string | undefined | null,
  t: (key: TranslationKey) => string
): string[] {
  const out: string[] = [];
  const vt = (venue_type || '').trim();
  if (vt) out.push(t(vt as TranslationKey));
  for (const seg of parseCuisineSegments(cuisine || '')) {
    if (out.length >= 3) break;
    const slug = segmentToSlug(seg);
    out.push(slug ? cuisineSlugLabel(slug, t) : seg);
  }
  return out.slice(0, 3);
}

/** English cuisine string for DB cuisine_en from stored cuisine (slugs or legacy). */
export function buildCuisineEnString(
  cuisine: string | undefined | null,
  trFn: (key: string, lang: 'sr' | 'en') => string
): string {
  const parts = parseCuisineSegments(cuisine || '');
  if (parts.length === 0) return '';
  return parts
    .map((seg) => {
      const slug = segmentToSlug(seg);
      if (slug) return trFn(slugToTranslationKey(slug), 'en');
      return seg;
    })
    .join(', ');
}
