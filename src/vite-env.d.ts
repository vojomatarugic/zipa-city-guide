/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Full URL or `/functions/v1/<function-name>` path for the Edge Function root (see `src/config/apiBase.ts`). */
  readonly VITE_API_BASE?: string;
  /** Optional public site URL for auth redirects; must not be localhost in production builds. */
  readonly VITE_PUBLIC_APP_URL?: string;
  readonly VITE_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
