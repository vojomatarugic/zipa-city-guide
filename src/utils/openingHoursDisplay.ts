/**
 * Split stored opening hours (segments joined with "; ") into separate display lines.
 * Does not alter segment text — only used for presentation.
 */
export function splitOpeningHoursDisplaySegments(value: string): string[] {
  return value
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}
