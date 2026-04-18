/**
 * Base URL passed to Supabase as `redirectTo` (OAuth return, password recovery).
 * Prefer the live browser origin when the app is served from a real host so a mistaken
 * build-time `VITE_PUBLIC_APP_URL` / `VITE_SITE_URL` pointing at localhost cannot override production.
 */
function isLocalHostOrigin(origin: string): boolean {
  try {
    const h = new URL(origin).hostname;
    return h === "localhost" || h === "127.0.0.1";
  } catch {
    return false;
  }
}

export function getSupabaseAuthRedirectTo(): string {
  const live =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "";

  const raw = (
    (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined) ??
    (import.meta.env.VITE_SITE_URL as string | undefined)
  )
    ?.trim();

  if (!raw || (!raw.startsWith("http://") && !raw.startsWith("https://"))) {
    return live;
  }

  try {
    const envOrigin = new URL(raw).origin;
    if (live && !isLocalHostOrigin(live) && isLocalHostOrigin(envOrigin)) {
      return live;
    }
    return envOrigin || live;
  } catch {
    return live;
  }
}
