import { projectId } from '../utils/supabase/info';

/**
 * Default when `VITE_API_BASE` is unset (dev convenience — set env in production).
 * Must stay the only place that encodes the function slug for fallback.
 */
const FALLBACK_API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-a0e1e9cb`;

function trimTrailingSlashes(s: string): string {
  return s.replace(/\/+$/, '');
}

/**
 * Root URL of the Supabase Edge Function (no trailing slash).
 *
 * Configure in `.env`:
 * - Full URL: `VITE_API_BASE=https://<ref>.supabase.co/functions/v1/make-server-a0e1e9cb`
 * - Path only: `VITE_API_BASE=/functions/v1/make-server-a0e1e9cb` → resolved against `https://<projectId>.supabase.co`
 */
export function getApiBase(): string {
  const raw = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();
  if (!raw) {
    return FALLBACK_API_BASE;
  }
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return trimTrailingSlashes(raw);
  }
  if (raw.startsWith('/')) {
    return trimTrailingSlashes(`https://${projectId}.supabase.co${raw}`);
  }
  return trimTrailingSlashes(raw);
}

/** Absolute URL for an API path under the Edge Function (path must start with `/`). */
export function apiUrl(path: string): string {
  const base = getApiBase();
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}
