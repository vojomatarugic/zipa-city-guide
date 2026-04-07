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
