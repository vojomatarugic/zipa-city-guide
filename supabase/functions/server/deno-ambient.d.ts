/**
 * Minimal `Deno` typings for editor / tsserver when Deno LSP is not active.
 * Supabase Edge Functions run on real Deno at deploy time — this file does not affect runtime.
 */
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (
    fetchHandler: (request: Request, info?: unknown) => Response | Promise<Response>,
  ) => void;
};

/** Editor-only: tsserver does not resolve Deno `npm:` / `jsr:` specifiers. Not used at runtime. */
declare module "npm:hono" {
  export const Hono: any;
}
declare module "npm:hono/cors" {
  export const cors: any;
}
declare module "npm:hono/logger" {
  export const logger: any;
}
declare module "jsr:@supabase/supabase-js@2" {
  export function createClient(
    supabaseUrl: string | undefined,
    supabaseKey: string | undefined,
    options?: unknown,
  ): any;
}
