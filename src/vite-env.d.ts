/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Full URL or `/functions/v1/<function-name>` path for the Edge Function root (see `src/config/apiBase.ts`). */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
