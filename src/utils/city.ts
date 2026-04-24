export function normalizeCityForCompare(city?: string | null): string {
  return String(city ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    // Canonical rule: map đ/Đ to "dj" before stripping remaining diacritics.
    .replace(/đ/g, "dj")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function cityEquals(a?: string | null, b?: string | null): boolean {
  return normalizeCityForCompare(a) === normalizeCityForCompare(b);
}

export function formatCityLabel(city?: string | null): string {
  return String(city ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFC");
}

export type CityLike = { city?: string | null };

export interface CityOption {
  key: string;
  label: string;
}

export interface TopCityOption extends CityOption {
  count: number;
}

/** š, č, ć, đ, ž (and uppercase) — prefer originals that keep these in UI. */
const BALKAN_LATIN_DIACRITIC_RE = /[ščćđžŠČĆĐŽ]/;

function hasBalkanLatinDiacritics(s: string): boolean {
  return BALKAN_LATIN_DIACRITIC_RE.test(s);
}

/** Each word: first character uppercase, remaining letters lowercase (Unicode-aware). */
function isTitleCasedLabel(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  for (const word of t.split(/\s+/)) {
    if (!word.length) return false;
    const first = word[0]!;
    const rest = word.slice(1);
    if (first !== first.toUpperCase()) return false;
    if (rest && rest !== rest.toLowerCase()) return false;
  }
  return true;
}

/**
 * Negative if `a` is a better display label than `b`, positive if `b` is better, 0 if tie.
 * Lexicographic rank (smaller = better for city proper names, not language-dependent):
 * 1. Prefer NFC text containing Balkan Latin diacritics (š č ć đ ž).
 * 2. Prefer clean title case on that NFC form.
 * 3. Stable `localeCompare` on NFC trimmed text.
 *
 * Always compare NFC forms so NFD spellings compete fairly after composition.
 */
function compareDisplayLabels(a: string, b: string): number {
  const ta = a.normalize("NFC").trim();
  const tb = b.normalize("NFC").trim();
  if (!ta) return tb ? 1 : 0;
  if (!tb) return -1;

  const da = hasBalkanLatinDiacritics(ta) ? 0 : 1;
  const db = hasBalkanLatinDiacritics(tb) ? 0 : 1;
  if (da !== db) return da - db;

  const ca = isTitleCasedLabel(ta) ? 0 : 1;
  const cb = isTitleCasedLabel(tb) ? 0 : 1;
  if (ca !== cb) return ca - cb;

  return ta.localeCompare(tb);
}

export function getAvailableCities(events: CityLike[]): CityOption[] {
  const byKey = new Map<string, CityOption>();

  for (const event of events) {
    const label = formatCityLabel(event.city);
    if (!label) continue;
    const key = normalizeCityForCompare(label);
    if (!key) continue;

    const existing = byKey.get(key);
    if (!existing || compareDisplayLabels(label, existing.label) < 0) {
      byKey.set(key, { key, label });
    }
  }

  return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function getTopCities(events: CityLike[], limit = 6): TopCityOption[] {
  const buckets = new Map<string, TopCityOption>();

  for (const event of events) {
    const label = formatCityLabel(event.city);
    if (!label) continue;
    const key = normalizeCityForCompare(label);
    if (!key) continue;

    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, { key, label, count: 1 });
      continue;
    }

    existing.count += 1;
    if (compareDisplayLabels(label, existing.label) < 0) {
      existing.label = label;
    }
  }

  return [...buckets.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, Math.max(0, limit));
}

/** Event counts per normalized city key (same bucketing as getAvailableCities). */
export function getCityCountsByKey(events: CityLike[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const event of events) {
    const label = formatCityLabel(event.city);
    if (!label) continue;
    const key = normalizeCityForCompare(label);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * Search match strength for ordering (lower = stronger).
 * 0 = visible label contains the raw query (case-insensitive, diacritics preserved).
 * 1 = normalized substring match only.
 * 2 = no match (should not appear in a pre-filtered list).
 */
export function citySearchMatchTier(label: string, rawQuery: string): number {
  const q = rawQuery.trim();
  if (!q) return 0;
  const labelNfc = label.normalize("NFC");
  const literal = labelNfc.toLowerCase();
  const needle = q.toLowerCase();
  if (literal.includes(needle)) return 0;

  const nq = normalizeCityForCompare(rawQuery);
  if (nq && normalizeCityForCompare(labelNfc).includes(nq)) return 1;
  return 2;
}

/** Sort filtered city options: stronger literal match first, then count desc, then label asc. */
export function sortCitiesForSearchQuery(
  cities: CityOption[],
  rawQuery: string,
  countByKey?: ReadonlyMap<string, number>,
): CityOption[] {
  const q = rawQuery.trim();
  if (!q) return cities;

  return [...cities].sort((a, b) => {
    const tierDiff =
      citySearchMatchTier(a.label, rawQuery) -
      citySearchMatchTier(b.label, rawQuery);
    if (tierDiff !== 0) return tierDiff;

    const ca = countByKey?.get(a.key) ?? 0;
    const cb = countByKey?.get(b.key) ?? 0;
    if (ca !== cb) return cb - ca;

    return a.label.localeCompare(b.label);
  });
}
