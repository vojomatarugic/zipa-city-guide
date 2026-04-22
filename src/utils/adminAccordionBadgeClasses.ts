/**
 * Count pills in admin accordion headers (users, venues, events).
 * - Height: fixed (`h-8`).
 * - Width: at least `min-w-[2.75rem]` (same footprint for 0–99-ish), then grows with content
 *   (e.g. 1000+) — no max-width cap; `whitespace-nowrap` keeps digits on one line.
 */
export function adminAccordionCountBadgeClass(tone: 'blue' | 'red'): string {
  const base =
    'inline-flex items-center justify-center h-8 w-auto min-w-[2.75rem] max-w-none whitespace-nowrap px-2.5 text-sm font-semibold tabular-nums leading-none rounded-full shrink-0 border box-border';
  return tone === 'blue'
    ? `${base} bg-blue-50 text-blue-700 border-blue-100`
    : `${base} bg-red-50 text-red-700 border-red-100`;
}
