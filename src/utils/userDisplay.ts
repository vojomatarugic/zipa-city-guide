/**
 * Display helpers for identity: email is the base; name is optional.
 * Legacy accounts may have generic placeholder "User" in metadata — treat as no name.
 */

export function normalizeUserChosenName(name: string | undefined | null): string | undefined {
  const t = String(name ?? '').trim();
  if (!t) return undefined;
  if (/^user$/i.test(t)) return undefined;
  return t;
}

export function emailLocalPart(email: string): string {
  const e = String(email ?? '').trim();
  const i = e.indexOf('@');
  if (i <= 0) return e || '';
  return e.slice(0, i) || e;
}

/**
 * App hydration / profile merge: app-chosen `user_metadata.display_name` wins over provider `name` / `full_name`, then email local-part.
 * Same priority should be used anywhere session + profile name fields are combined.
 */
export function resolvedDisplayNameFromSources(src: {
  display_name?: string | null;
  name?: string | null;
  full_name?: string | null;
  email: string;
}): string {
  const d = normalizeUserChosenName(src.display_name);
  if (d) return d;
  const n = normalizeUserChosenName(src.name);
  if (n) return n;
  const f = normalizeUserChosenName(src.full_name);
  if (f) return f;
  /** Last resort: raw local-part / email (do not treat as a “chosen” name — no User-placeholder filter). */
  return emailLocalPart(src.email) || String(src.email ?? '').trim() || '';
}

/** Header blue button: first word of real name, else email local part (never generic "User"). */
export function headerProfileButtonLabel(user: { name?: string; email: string }): string {
  const real = normalizeUserChosenName(user.name);
  if (real) {
    const first = real.split(/\s+/)[0];
    return first || real;
  }
  return emailLocalPart(user.email) || user.email;
}

/** My Panel / profile card subtitle: full real name from context, else same email-based fallback as header. */
export function panelProfileDisplayName(user: { name?: string; email: string }): string {
  const real = normalizeUserChosenName(user.name);
  if (real) return real;
  return emailLocalPart(user.email) || String(user.email ?? '').trim();
}
