import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2";
import * as kv from "./kv_correct.tsx";
import {
  normalizeEventResponseRow,
  normalizeEventResponseRows,
  normalizeEventCategoryFromRequest,
  pickEventApiPayload,
  requestSpecifiesCategory,
} from "./eventSchema.ts";

console.log('🚀 Make Server starting... (ylztclwqmfhczklsswrt) - v9.1 CATEGORY_KILLED_v9.1 — ping endpoint live check');

const app = new Hono();

// ===================================
// 🔐 SUPABASE CLIENTS & AUTH HELPERS
// ===================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing Supabase env vars");
}

/**
 * End-user session JWT: prefer `x-auth-token` (gateway-safe). Fallback: `Authorization: Bearer`.
 */
/** Check if a token looks like a valid JWT (3 dot-separated base64 segments). */
function isJwtFormat(token: string): boolean {
  if (!token || token.length < 20) return false;
  const parts = token.split('.');
  return parts.length === 3 && parts.every(p => p.length > 0);
}

/** Anon and service-role keys are JWT-shaped; never treat them as the end-user access token. */
function isProjectApiJwt(token: string): boolean {
  return token === SUPABASE_ANON_KEY || token === SUPABASE_SERVICE_ROLE_KEY;
}

function getTokenFromRequest(c: any): string | null {
  const h = c.req.raw.headers;
  console.log('[AUTH DEBUG]', {
    hasXAuthToken: !!h.get('x-auth-token'),
    hasAuthorization: !!h.get('authorization'),
  });

  const xRaw =
    (c.req.header('x-auth-token') || h.get('x-auth-token') || '').trim();
  if (xRaw) {
    if (isProjectApiJwt(xRaw)) {
      console.warn('[getTokenFromRequest] x-auth-token equals project anon/service key, ignoring; trying Authorization');
    } else {
      return xRaw;
    }
  }

  const auth = (
    c.req.header('Authorization') ||
    c.req.header('authorization') ||
    h.get('Authorization') ||
    h.get('authorization') ||
    ''
  ).trim();
  if (!auth.startsWith('Bearer ')) return null;
  const bearer = auth.slice(7).trim();
  if (!bearer) return null;
  if (isProjectApiJwt(bearer)) {
    console.log('[getTokenFromRequest] Bearer is project anon/service JWT (gateway), ignoring');
    return null;
  }
  if (!isJwtFormat(bearer)) {
    console.log('[getTokenFromRequest] Bearer token is not a JWT shape, ignoring');
    return null;
  }
  return bearer;
}

/**
 * Supabase service role client (server-only privileged access)
 */
function sbService() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { 
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

// Legacy helper for backward compatibility
const getSupabaseClient = sbService;

const VENUE_IMAGES_BUCKET = "make-ee0c365c-venue-images";
const PROFILE_IMAGES_BUCKET = "profile-images-ee0c365c";
type OwnedStorageBucket = typeof VENUE_IMAGES_BUCKET | typeof PROFILE_IMAGES_BUCKET;

const VENUE_TYPE_TO_PAGE_SLUG: Record<string, string> = {
  restaurant: "food-and-drink",
  cafe: "food-and-drink",
  bar: "food-and-drink",
  pub: "food-and-drink",
  brewery: "food-and-drink",
  kafana: "food-and-drink",
  fast_food: "food-and-drink",
  cevabdzinica: "food-and-drink",
  pizzeria: "food-and-drink",
  dessert_shop: "food-and-drink",
  nightclub: "clubs",
  other: "food-and-drink",
};

function deriveVenuePageSlugFromVenueType(rawVenueType: unknown): string | null {
  if (typeof rawVenueType !== "string") return null;
  const normalized = rawVenueType.trim().toLowerCase();
  if (!normalized) return null;
  return VENUE_TYPE_TO_PAGE_SLUG[normalized] ?? null;
}

const normalize = (value: unknown): string =>
  String(value ?? "").trim().toLowerCase();

function resolveOwnedStorageTarget(
  rawValue: unknown,
  allowedBuckets: readonly OwnedStorageBucket[]
): { bucket: OwnedStorageBucket; path: string } | null {
  const value = String(rawValue ?? "").trim();
  if (!value) return null;
  if (value.startsWith("data:")) return null;

  const allowed = new Set(allowedBuckets);
  const normalizePath = (input: string): string => input.replace(/^\/+/, "").trim();
  const asOwnedBucket = (b: string): OwnedStorageBucket | null => (
    allowed.has(b as OwnedStorageBucket) ? (b as OwnedStorageBucket) : null
  );

  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      const url = new URL(value);
      const pathname = decodeURIComponent(url.pathname || "");
      const marker = "/storage/v1/object/";
      const markerIdx = pathname.indexOf(marker);
      if (markerIdx < 0) return null;

      const rest = pathname.slice(markerIdx + marker.length);
      const segs = rest.split("/").filter(Boolean);
      if (segs.length < 3) return null;

      const mode = segs[0]; // public|sign|authenticated|...
      if (mode !== "public" && mode !== "sign" && mode !== "authenticated") return null;
      const bucket = asOwnedBucket(segs[1]);
      if (!bucket) return null;
      const path = normalizePath(segs.slice(2).join("/"));
      if (!path) return null;
      return { bucket, path };
    } catch {
      return null;
    }
  }

  if (value.includes("://")) return null;
  const path = normalizePath(value);
  if (!path) return null;
  const bucket = allowedBuckets[0];
  return bucket ? { bucket, path } : null;
}

function sameOwnedStorageObject(
  currentValue: unknown,
  nextValue: unknown,
  allowedBuckets: readonly OwnedStorageBucket[]
): boolean {
  const current = resolveOwnedStorageTarget(currentValue, allowedBuckets);
  const next = resolveOwnedStorageTarget(nextValue, allowedBuckets);
  if (!current || !next) return false;
  return current.bucket === next.bucket && current.path === next.path;
}

async function bestEffortDeleteOwnedStorageObject(
  supabase: ReturnType<typeof sbService>,
  rawValue: unknown,
  allowedBuckets: readonly OwnedStorageBucket[],
  context: string
): Promise<void> {
  const target = resolveOwnedStorageTarget(rawValue, allowedBuckets);
  if (!target) return;

  const { error } = await supabase.storage.from(target.bucket).remove([target.path]);
  if (error) {
    console.warn(`⚠️ [${context}] Storage cleanup failed`, {
      bucket: target.bucket,
      path: target.path,
      reason: error.message,
    });
  } else {
    console.log(`🧹 [${context}] Deleted storage object`, {
      bucket: target.bucket,
      path: target.path,
    });
  }
}

type EventScheduleRow = { start_at: string; end_at?: string | null };

type EventScheduleParseResult = {
  ok: boolean;
  value: EventScheduleRow[] | null;
  error: string | null;
};

/**
 * Strict write validator for `event_schedules`.
 * Accepts ONLY canonical shape: [{ start_at: ISO, end_at?: ISO|null }]
 */
function parseCanonicalEventSchedulesInput(raw: unknown): EventScheduleParseResult {
  if (raw === undefined || raw === null) return { ok: true, value: null, error: null };

  let parsed: unknown = raw;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return { ok: true, value: null, error: null };
    try {
      parsed = JSON.parse(t);
    } catch {
      return { ok: false, value: null, error: "event_schedules must be valid JSON array." };
    }
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, value: null, error: "event_schedules must be an array." };
  }

  const out: EventScheduleRow[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const row = parsed[i];
    if (!row || typeof row !== "object") {
      return { ok: false, value: null, error: `event_schedules[${i}] must be an object.` };
    }

    const o = row as Record<string, unknown>;

    if ("date" in o || "startTime" in o || "endTime" in o || "startAt" in o || "endAt" in o) {
      return {
        ok: false,
        value: null,
        error:
          `event_schedules[${i}] uses legacy keys. Use only {start_at,end_at}.`,
      };
    }

    const startRaw = o.start_at;
    if (typeof startRaw !== "string" || !startRaw.trim()) {
      return { ok: false, value: null, error: `event_schedules[${i}].start_at is required.` };
    }
    const start_at = startRaw.trim();
    if (isNaN(new Date(start_at).getTime())) {
      return { ok: false, value: null, error: `event_schedules[${i}].start_at must be valid ISO datetime.` };
    }

    let end_at: string | null = null;
    if ("end_at" in o && o.end_at !== null && o.end_at !== undefined) {
      if (typeof o.end_at !== "string" || !o.end_at.trim()) {
        return { ok: false, value: null, error: `event_schedules[${i}].end_at must be string or null.` };
      }
      end_at = o.end_at.trim();
      if (isNaN(new Date(end_at).getTime())) {
        return { ok: false, value: null, error: `event_schedules[${i}].end_at must be valid ISO datetime.` };
      }
    }

    out.push({ start_at, end_at });
  }

  return { ok: true, value: out.length ? out : null, error: null };
}

/** Canonical email from Supabase Auth if registered; otherwise null. Paginates listUsers. */
async function resolveRegisteredSubmitterEmail(
  serviceClient: ReturnType<typeof sbService>,
  email: string
): Promise<string | null> {
  const want = (email || '').trim().toLowerCase();
  if (!want) return null;
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error('❌ [resolveRegisteredSubmitterEmail] listUsers:', error.message);
      return null;
    }
    const users = data?.users ?? [];
    const hit = users.find((u) => (u.email || '').toLowerCase() === want);
    if (hit?.email) return hit.email.trim();
    if (users.length < perPage) break;
    page += 1;
  }
  return null;
}

function extractDisplayNameFromAuthUser(user: { user_metadata?: Record<string, unknown> } | null | undefined): string | null {
  if (!user?.user_metadata) return null;
  const meta = user.user_metadata;
  const fromName = typeof meta.name === 'string' ? meta.name.trim() : '';
  if (fromName) return fromName;
  const fromFullName = typeof meta.full_name === 'string' ? meta.full_name.trim() : '';
  if (fromFullName) return fromFullName;
  return null;
}

/** Allowed normalized keys for venue `tags` (Oznaka); max 2. */
const VENUE_OZNAKA_KEYS = new Set([
  'draft-beer',
  'craft-beer',
  'cocktails',
  'wine-list',
  'rakija',
  'live-music',
  'dj',
  'karaoke',
  'hookah',
  'lounge',
  'rooftop',
  'garden',
  'terrace',
  'sports-screening',
  'romantic',
  'family-friendly',
]);

/**
 * Accepts JSON array string, comma-separated keys, or string[] from the client.
 * Returns up to 2 allowed keys as a Postgres `text[]` value (never a joined string).
 */
function normalizeVenueTagsInput(raw: unknown): string[] | null {
  if (raw === undefined || raw === null) return null;
  let parts: string[] = [];
  if (Array.isArray(raw)) {
    parts = raw.map((x) => String(x).trim()).filter(Boolean);
  } else {
    const s = String(raw).trim();
    if (!s) return null;
    if (s.startsWith('[')) {
      try {
        const j = JSON.parse(s) as unknown;
        if (Array.isArray(j)) {
          parts = j.map((x) => String(x).trim()).filter(Boolean);
        } else {
          parts = s.split(',').map((x) => x.trim()).filter(Boolean);
        }
      } catch {
        parts = s.split(',').map((x) => x.trim()).filter(Boolean);
      }
    } else {
      parts = s.split(',').map((x) => x.trim()).filter(Boolean);
    }
  }
  const out = parts.filter((k) => VENUE_OZNAKA_KEYS.has(k)).slice(0, 2);
  return out.length ? out : null;
}

/**
 * Resolves the current user by asking GoTrue only — no local JWT verify/decode.
 * First argument is ignored (backward compat); do not pass a user-scoped client to avoid
 * supabase-js parsing the access token (e.g. ES256) on the Edge runtime.
 */
async function safeGetUser(_supabaseClient: any, userToken: string) {
  const t = typeof userToken === "string" ? userToken.trim() : "";
  if (!t) {
    console.warn("🔐 [safeGetUser] Missing token, skipping /auth/v1/user");
    return { data: { user: null }, error: new Error("Missing token") };
  }
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${t}`,
        apikey: SUPABASE_ANON_KEY,
      },
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
      console.error('🔐 [safeGetUser] GoTrue /user error:', response.status, errorBody);
      return {
        data: { user: null },
        error: new Error(errorBody?.message || errorBody?.msg || `Auth error ${response.status}`)
      };
    }
    const user = await response.json();
    return { data: { user }, error: null };
  } catch (err: any) {
    console.error('🔐 [safeGetUser] fetch threw exception:', err?.name, err?.message);
    return { data: { user: null }, error: err };
  }
}

// ===================================
// 🔐 SECURITY HELPERS
// ===================================

/**
 * Merge user metadata without overwriting existing fields
 * 🚨 CRITICAL: Prevents accidental deletion of role/blocked/phone/etc
 */
async function mergeUserMetadata(supabase: any, userId: string, patch: Record<string, any>) {
  const { data: existing, error: readErr } = await supabase.auth.admin.getUserById(userId);
  if (readErr) throw new Error(`Failed to read user metadata: ${readErr.message}`);
  
  const current = existing?.user?.user_metadata || {};
  return { ...current, ...patch };
}

type AppProfileRole = "user" | "admin" | "master_admin";

function normalizeAppProfileRole(value: unknown): AppProfileRole {
  const s = String(value ?? "").trim().toLowerCase();
  if (s === "admin" || s === "master_admin" || s === "user") return s;
  return "user";
}

async function getProfileRoleById(supabase: any, userId: string): Promise<AppProfileRole> {
  const { data, error } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (error || !data) return "user";
  return normalizeAppProfileRole((data as { role?: unknown }).role);
}

async function profileHasAdminAccess(supabase: any, userId: string): Promise<boolean> {
  const r = await getProfileRoleById(supabase, userId);
  return r === "admin" || r === "master_admin";
}

/** Log profiles.role vs auth user_metadata when investigating master-admin protection (remove after debugging). */
async function logProfileVsAuthMetadata(
  supabase: any,
  userId: string,
  label: string,
  profilesRoleRaw: unknown
) {
  try {
    const { data: authRow, error } = await supabase.auth.admin.getUserById(userId);
    const um = authRow?.user?.user_metadata ?? {};
    console.log(`[ROLE_AUDIT:${label}]`, {
      userId,
      email: authRow?.user?.email ?? null,
      profiles_role_raw: profilesRoleRaw,
      profiles_role_norm: normalizeAppProfileRole(profilesRoleRaw),
      user_metadata_role: um.role,
      user_metadata_is_master_admin: um.is_master_admin,
      auth_read_error: error?.message,
    });
  } catch (e) {
    console.warn(`[ROLE_AUDIT:${label}] failed`, e);
  }
}

async function fetchProfilesRoleMapByUserId(supabase: any): Promise<Map<string, AppProfileRole>> {
  const { data, error } = await supabase.from("profiles").select("id, role");
  const m = new Map<string, AppProfileRole>();
  if (error || !data) return m;
  for (const row of data as { id: string; role?: unknown }[]) {
    m.set(row.id, normalizeAppProfileRole(row.role));
  }
  return m;
}

/** Display label for admin user list — name lives in GoTrue `user_metadata`, not `public.profiles`. */
function displayNameFromAuthUser(user: { email?: string | null; user_metadata?: Record<string, unknown> | null }): string {
  const um = user.user_metadata ?? {};
  const fromDisplay = String(um.display_name ?? "").trim();
  if (fromDisplay) return fromDisplay;
  const fromName = String(um.name ?? "").trim();
  if (fromName) return fromName;
  const fromFull = String(um.full_name ?? "").trim();
  if (fromFull) return fromFull;
  const em = String(user.email ?? "").trim();
  const at = em.indexOf("@");
  if (at > 0) return em.slice(0, at) || em;
  return em;
}

/**
 * Admin-only middleware — session via GoTrue /auth/v1/user (safeGetUser), then profiles.role.
 * 🚨 CRITICAL: Protects admin endpoints from unauthorized access
 * ✅ Uses x-auth-token fallback for Figma environment compatibility
 */
const requireAdmin = async (c: any, next: any) => {
  console.log('🔐 [AUTH] ========================================');
  console.log('🔐 [AUTH] Checking admin authorization...');
  console.log('🔐 [AUTH] NEW MIDDLEWARE VERSION v5.0 - FIX JWT VALIDATION');
  
  const token = getTokenFromRequest(c);
  
  console.log('🔐 [AUTH] Token found:', !!token);
  console.log('🔐 [AUTH] Token length:', token?.length);
  console.log('🔐 [AUTH] Token preview:', token ? token.slice(0, 50) + '...' : 'NULL');
  
  if (!token) {
    console.warn('⚠️  [AUTH] Missing token (checked Authorization and x-auth-token)');
    return c.json({ code: 401, message: "Missing token" }, 401);
  }
  
  // 🔧 DEBUG: Check env vars
  console.log("🔧 [AUTH] SUPABASE_URL:", SUPABASE_URL);
  console.log("🔧 [AUTH] ANON_KEY len:", (SUPABASE_ANON_KEY || "").length);
  console.log("🔧 [AUTH] SERVICE_ROLE len:", (SUPABASE_SERVICE_ROLE_KEY || "").length);
  console.log("🔧 [AUTH] token len:", token.length);
  console.log("🔧 [AUTH] token prefix:", token.slice(0, 20));
  
  try {
    const { data: { user }, error } = await safeGetUser(null, token);

    console.log('🔐 [AUTH] safeGetUser (/auth/v1/user) result:');
    console.log('  - user exists:', !!user);
    console.log('  - user email:', user?.email);
    console.log('  - user id:', user?.id);
    console.log('  - error:', error?.message);
    console.log('  - error details:', JSON.stringify(error, null, 2));

    if (error || !user) {
      console.warn('⚠️  [AUTH] Invalid JWT:', error?.message);
      return c.json({ code: 401, message: error?.message || "Invalid JWT" }, 401);
    }

    const supabase = getSupabaseClient();
    const isAdmin = await profileHasAdminAccess(supabase, user.id);
    
    console.log('🔐 [AUTH] User id:', user.id);
    console.log('🔐 [AUTH] Is admin (profiles):', isAdmin);
    
    if (!isAdmin) {
      console.warn(`⚠️  [AUTH] Non-admin user attempted admin action: ${user.email}`);
      return c.json({ code: 403, message: "Forbidden - admin only" }, 403);
    }

    // Store user in context for handler
    c.set("token", token);
    c.set("user", user);
    console.log(`✅ [AUTH] Admin access granted: ${user.email}`);
    console.log('🔐 [AUTH] ========================================');
    await next();
  } catch (err) {
    console.error('❌ [AUTH] Auth error:', err);
    console.error('❌ [AUTH] Error stack:', err instanceof Error ? err.stack : 'No stack');
    return c.json({ code: 401, message: String(err) }, 401);
  }
};

// =================================== 
// CREATE PROFILE IMAGES BUCKET (NON-BLOCKING)
// ===================================
async function createProfileImagesBucket() {
  try {
    console.log('🪣 [STORAGE] Checking profile images bucket...');
    
    const supabase = getSupabaseClient();
    const bucketName = 'profile-images-ee0c365c';
    
    // Check if bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
    
    if (bucketExists) {
      console.log('✅ [STORAGE] Profile images bucket already exists');
      return;
    }
    
    // Create bucket (public for easy access to profile images)
    const { data, error } = await supabase.storage.createBucket(bucketName, {
      public: true, // Public so we can easily display profile images
      fileSizeLimit: 5242880, // 5MB limit
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
    });
    
    if (error) {
      console.warn('⚠️  [STORAGE] Could not create profile images bucket:', error.message);
      return;
    }
    
    console.log('✅ [STORAGE] Profile images bucket created successfully!');
  } catch (error) {
    console.warn('⚠️  [STORAGE] Error creating profile images bucket:', error instanceof Error ? error.message : String(error));
  }
}

// =================================== 
// CREATE VENUE IMAGES BUCKET (NON-BLOCKING)
// ===================================
async function createVenueImagesBucket() {
  try {
    console.log('🪣 [STORAGE] Checking venue images bucket...');
    
    const supabase = getSupabaseClient();
    const bucketName = 'make-ee0c365c-venue-images';
    
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
    
    if (bucketExists) {
      console.log('✅ [STORAGE] Venue images bucket already exists');
      return;
    }
    
    const { data, error } = await supabase.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: 10485760, // 10MB limit for venue images
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
    });
    
    if (error) {
      console.warn('⚠️  [STORAGE] Could not create venue images bucket:', error.message);
      return;
    }
    
    console.log('✅ [STORAGE] Venue images bucket created successfully!');
  } catch (error) {
    console.warn('⚠️  [STORAGE] Error creating venue images bucket:', error instanceof Error ? error.message : String(error));
  }
}

// ===================================
// ONE-TIME MIGRATION: venues __config__ rows → kv_store
// ===================================
async function migrateConfigToKvStore() {
  try {
    console.log('🔄 [MIGRATION] Checking if config data needs migration from venues to kv_store...');
    const supabase = getSupabaseClient();
    
    const CONFIG_UUIDS = {
      featured: '00000000-0000-0000-0000-000000000001',
      inactiveVenues: '00000000-0000-0000-0000-000000000002',
      inactiveEvents: '00000000-0000-0000-0000-000000000003',
    };
    
    const KV_KEYS = {
      featured: KV_FEATURED_KEY,
      inactiveVenues: KV_INACTIVE_VENUES_KEY,
      inactiveEvents: KV_INACTIVE_EVENTS_KEY,
    };
    
    for (const [label, uuid] of Object.entries(CONFIG_UUIDS)) {
      const kvKey = KV_KEYS[label as keyof typeof KV_KEYS];
      
      // Check if already exists in kv_store
      const existing = await kv.get(kvKey);
      if (existing && Array.isArray(existing) && existing.length > 0) {
        console.log(`🔄 [MIGRATION] ${label}: already in kv_store (${existing.length} items), skipping`);
        continue;
      }
      
      // Try to read from old venues config row
      const { data, error } = await supabase
        .from('venues_ee0c365c')
        .select('description')
        .eq('id', uuid)
        .maybeSingle();
      
      if (!error && data?.description) {
        try {
          const ids = JSON.parse(data.description);
          if (Array.isArray(ids) && ids.length > 0) {
            await kv.set(kvKey, ids);
            console.log(`✅ [MIGRATION] ${label}: migrated ${ids.length} IDs to kv_store`);
            
            // Clean up old config row (best-effort)
            await supabase.from('venues_ee0c365c').delete().eq('id', uuid);
            console.log(`🗑️ [MIGRATION] ${label}: deleted old config row`);
          }
        } catch (parseErr) {
          console.warn(`⚠️ [MIGRATION] ${label}: could not parse description JSON:`, parseErr);
        }
      } else {
        console.log(`🔄 [MIGRATION] ${label}: no old config row found, nothing to migrate`);
      }
    }
    
    console.log('✅ [MIGRATION] Config migration check complete');
  } catch (error) {
    console.warn('⚠️ [MIGRATION] Config migration failed (non-critical):', error instanceof Error ? error.message : String(error));
  }
}

console.log('✅ Server initialization complete - ready to handle requests');

// 🔥 RUN STARTUP TASKS IN BACKGROUND (non-blocking, won't crash server if they fail)
setTimeout(() => {
  createProfileImagesBucket().catch(err => {
    console.warn('⚠️  [STARTUP] Storage setup failed (non-critical):', err instanceof Error ? err.message : String(err));
  });
  createVenueImagesBucket().catch(err => {
    console.warn('⚠️  [STARTUP] Venue storage setup failed (non-critical):', err instanceof Error ? err.message : String(err));
  });
  migrateConfigToKvStore().catch(err => {
    console.warn('⚠️  [STARTUP] Config migration failed (non-critical):', err instanceof Error ? err.message : String(err));
  });
}, 100);

// CORS headers for all responses
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-auth-token",
};

// Enable logger
app.use('*', logger(console.log));

// Handle OPTIONS preflight requests
app.options('*', (c) => {
  return c.body(null, 204, corsHeaders); // ✅ 204 must have null body
});

// Enable CORS for all routes
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "apikey", "x-client-info", "x-auth-token"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: false, // ✅ FIXED: credentials must be false with origin: "*"
  }),
);

// Health check endpoint
app.get("/make-server-a0e1e9cb/health", (c) => {
  console.log('🏥 Health check called');
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ===================================
// AUTH ENDPOINTS
// ===================================

// Sign up new user
app.post("/make-server-a0e1e9cb/auth/signup", async (c) => {
  try {
    const body = await c.req.json();
    
    const { email, password, name, phone, role, adminSecret } = body;
    // Required: email + password only. Name is optional (set later in Edit Profile).
    const emailStr = typeof email === "string" ? email.trim() : "";
    const passwordStr = typeof password === "string" ? password : "";
    if (!emailStr || !passwordStr) {
      return c.json({ error: 'Missing required fields: email, password' }, 400);
    }
    
    // Determine user role
    let userRole = 'user'; // Default to regular user
    
    // Allow admin creation ONLY if adminSecret matches
    if (role === 'admin') {
      const ADMIN_SECRET = Deno.env.get('ADMIN_SECRET') || 'BL_ADMIN_2025_SECRET';
      
      if (adminSecret === ADMIN_SECRET) {
        userRole = 'admin';
        console.log(`🛡️  Creating admin user: ${emailStr}`);
      } else {
        console.warn(`⚠️  Attempted admin creation without valid secret: ${emailStr}`);
        return c.json({ error: 'Invalid admin secret' }, 403);
      }
    }
    
    const supabase = getSupabaseClient();
    
    const trimmedSignupName = typeof name === "string" ? name.trim() : "";
    const userMetadata: Record<string, unknown> = {
      role: userRole,
    };
    if (trimmedSignupName) {
      userMetadata.name = trimmedSignupName;
    }
    if (phone != null && String(phone).trim() !== "") {
      userMetadata.phone = String(phone).trim();
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: emailStr,
      password: passwordStr,
      user_metadata: userMetadata,
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });
    
    if (error) {
      console.error('❌ Error creating user:', error);
      return c.json({ error: 'Failed to create user', details: error.message }, 400);
    }

    const createdId = data.user.id;
    const createdEmail = (data.user.email ?? emailStr).trim();
    const phoneNorm =
      phone != null && String(phone).trim() !== "" ? String(phone).trim() : null;
    const { error: profileUpsertErr } = await supabase.from("profiles").upsert(
      {
        id: createdId,
        email: createdEmail,
        role: userRole,
        phone: phoneNorm,
      },
      { onConflict: "id" },
    );
    if (profileUpsertErr) {
      console.error("❌ Error upserting profiles on signup:", profileUpsertErr);
      return c.json({ error: "Failed to create profile row", details: profileUpsertErr.message }, 500);
    }
    
    console.log(`✅ User created: ${data.user.id} (${emailStr}) - Role: ${userRole}`);
    
    return c.json({ 
      success: true, 
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name,
        phone: data.user.user_metadata?.phone,
        role: data.user.user_metadata?.role
      }
    });
  } catch (error) {
    console.error('❌ Error in signup:', error);
    return c.json({ error: 'Failed to sign up', details: String(error) }, 500);
  }
});

// Get all users (admin only)
app.get("/make-server-a0e1e9cb/users", requireAdmin, async (c) => {
  try {
    const supabase = getSupabaseClient();
    
    // Get all users from auth
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return c.json({ error: 'Failed to fetch users', details: usersError.message }, 500);
    }
    
    const profileRoleById = await fetchProfilesRoleMapByUserId(supabase);
    
    // For each user, count their submissions (venues + events)
    const usersWithStats = await Promise.all(
      users.map(async (user: any) => {
        const userEmail = user.email || 'unknown';
        
        // Count venues
        const { count: venuesCount } = await supabase
          .from('venues_ee0c365c')
          .select('*', { count: 'exact', head: true })
          .eq('submitted_by', userEmail);
        
        // Count events
        const { count: eventsCount } = await supabase
          .from('events_ee0c365c')
          .select('*', { count: 'exact', head: true })
          .eq('submitted_by', userEmail);
        
        const role = profileRoleById.get(user.id) ?? 'user';
        const displayName = displayNameFromAuthUser(user);
        
        return {
          id: user.id,
          email: user.email,
          name: displayName,
          role,
          blocked: user.user_metadata?.blocked || false,
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at || null,
          venues_count: venuesCount || 0,
          events_count: eventsCount || 0,
          total_submissions: (venuesCount || 0) + (eventsCount || 0),
        };
      })
    );
    
    // Sort by total submissions (most active first)
    usersWithStats.sort((a, b) => b.total_submissions - a.total_submissions);
    
    return c.json({ users: usersWithStats });
  } catch (error) {
    console.error('❌ Error fetching users:', error);
    return c.json({ error: 'Failed to fetch users', details: String(error) }, 500);
  }
});

// Search users by email (admin only) - for autosuggest in venue/event forms
app.get("/make-server-a0e1e9cb/users/search", requireAdmin, async (c) => {
  try {
    const query = c.req.query('q') || '';
    
    if (!query || query.length < 2) {
      return c.json({ users: [] });
    }
    
    const supabase = getSupabaseClient();
    
    // Get all users from auth
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('❌ Error searching users:', usersError);
      return c.json({ error: 'Failed to search users', details: usersError.message }, 500);
    }
    
    // Filter users by email match (case-insensitive)
    const queryLower = query.toLowerCase();
    const filtered = users
      .filter(user => {
        const email = (user.email || '').toLowerCase();
        const name = (user.user_metadata?.name || '').toLowerCase();
        return email.includes(queryLower) || name.includes(queryLower);
      })
      .slice(0, 10);
    
    if (filtered.length === 0) {
      return c.json({ users: [] });
    }
    
    const ids = filtered.map((u: any) => u.id);
    const { data: profRows } = await supabase.from('profiles').select('id, role').in('id', ids);
    const roleById = new Map<string, AppProfileRole>();
    for (const row of (profRows || []) as { id: string; role?: unknown }[]) {
      roleById.set(row.id, normalizeAppProfileRole(row.role));
    }
    
    const matchedUsers = filtered.map((user: any) => ({
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || '',
      phone: user.user_metadata?.phone || '',
      role: roleById.get(user.id) ?? 'user',
    }));
    
    console.log(`🔍 User search for "${query}": found ${matchedUsers.length} matches`);
    return c.json({ users: matchedUsers });
  } catch (error) {
    console.error('❌ Error searching users:', error);
    return c.json({ error: 'Failed to search users', details: String(error) }, 500);
  }
});

/**
 * Authenticated read of the caller's `public.profiles` row (service role).
 * Browser PostgREST + user JWT is often blocked by RLS; the app must hydrate role/phone from here.
 * Must be registered before `/users/:email/...` so `me` is not captured as a param.
 */
app.get("/make-server-a0e1e9cb/users/me/profile", async (c) => {
  try {
    const token = getTokenFromRequest(c);
    if (!token) {
      return c.json({ error: "Missing token", code: 401 }, 401);
    }
    const { data: userData, error: userError } = await safeGetUser(null, token);
    if (userError || !userData?.user?.id) {
      return c.json({ error: userError?.message || "Invalid token", code: 401 }, 401);
    }
    const uid = userData.user.id;
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, role, phone, avatar_url")
      .eq("id", uid)
      .maybeSingle();
    if (error) {
      console.error("[users/me/profile] profiles select:", error.message);
      return c.json({ error: error.message, code: 500 }, 500);
    }
    const um = (userData.user.user_metadata ?? {}) as Record<string, unknown>;
    const displayFromAuth = String(um.display_name ?? "").trim();
    const nameFromAuth = String(um.name ?? "").trim();
    const fullFromAuth = String(um.full_name ?? "").trim();
    /** Display name is not stored on `profiles` in this schema; hydrate from GoTrue metadata when present. */
    const profile =
      data === null
        ? null
        : {
            ...(data as Record<string, unknown>),
            display_name: displayFromAuth || null,
            name: nameFromAuth || null,
            full_name: fullFromAuth || null,
          };
    console.log("[users/me/profile] ok", { userId: uid, hasRow: !!data, role: (data as { role?: unknown } | null)?.role });
    return c.json({ profile });
  } catch (e) {
    console.error("[users/me/profile] exception:", e);
    return c.json({ error: "Failed to load profile", details: String(e) }, 500);
  }
});

// Get submissions by user email (admin only)
app.get("/make-server-a0e1e9cb/users/:email/submissions", requireAdmin, async (c) => {
  try {
    const email = c.req.param('email');
    
    if (!email) {
      return c.json({ error: 'Email parameter is required' }, 400);
    }
    
    const supabase = getSupabaseClient();
    
    // Get venues by this user
    const { data: venues, error: venuesError } = await supabase
      .from('venues_ee0c365c')
      .select('*')
      .eq('submitted_by', email)
      .order('created_at', { ascending: false });
    
    if (venuesError) {
      console.error('❌ Error fetching user venues:', venuesError);
      return c.json({ error: 'Failed to fetch venues', details: venuesError.message }, 500);
    }
    
    // Get events by this user
    const { data: events, error: eventsError } = await supabase
      .from('events_ee0c365c')
      .select('*')
      .eq('submitted_by', email)
      .order('created_at', { ascending: false });
    
    if (eventsError) {
      console.error('❌ Error fetching user events:', eventsError);
      return c.json({ error: 'Failed to fetch events', details: eventsError.message }, 500);
    }
    
    return c.json({ 
      venues: venues || [],
      events: events || [],
      total: (venues?.length || 0) + (events?.length || 0)
    });
  } catch (error) {
    console.error('❌ Error fetching user submissions:', error);
    return c.json({ error: 'Failed to fetch user submissions', details: String(error) }, 500);
  }
});

// Block user (admin only)
app.patch("/make-server-a0e1e9cb/users/:userId/block", requireAdmin, async (c) => {
  try {
    const userId = c.req.param('userId');
    const supabase = getSupabaseClient();
    
    // ✅ Master admin protection (`profiles.role` only)
    const blockTargetRole = await getProfileRoleById(supabase, userId);
    if (blockTargetRole === 'master_admin') {
      await logProfileVsAuthMetadata(supabase, userId, 'block:MASTER_ADMIN_PROTECTED', blockTargetRole);
      return c.json({ error: 'Cannot block master admin', code: 'MASTER_ADMIN_PROTECTED' }, 403);
    }
    
    // ✅ FIXED: Merge metadata to prevent overwriting role/name/phone
    const newMetadata = await mergeUserMetadata(supabase, userId, { blocked: true });
    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: newMetadata
    });
    
    if (error) {
      console.error('❌ Error blocking user:', error);
      return c.json({ error: 'Failed to block user', details: error.message }, 500);
    }
    
    console.log(`✅ User blocked: ${userId}`);
    return c.json({ success: true, user: data });
  } catch (error) {
    console.error('❌ Error blocking user:', error);
    return c.json({ error: 'Failed to block user', details: String(error) }, 500);
  }
});

// Unblock user (admin only)
app.patch("/make-server-a0e1e9cb/users/:userId/unblock", requireAdmin, async (c) => {
  try {
    const userId = c.req.param('userId');
    const supabase = getSupabaseClient();
    
    // ✅ FIXED: Merge metadata to prevent overwriting role/name/phone
    const newMetadata = await mergeUserMetadata(supabase, userId, { blocked: false });
    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: newMetadata
    });
    
    if (error) {
      console.error('❌ Error unblocking user:', error);
      return c.json({ error: 'Failed to unblock user', details: error.message }, 500);
    }
    
    console.log(`✅ User unblocked: ${userId}`);
    return c.json({ success: true, user: data });
  } catch (error) {
    console.error('❌ Error unblocking user:', error);
    return c.json({ error: 'Failed to unblock user', details: String(error) }, 500);
  }
});

// Set user role (admin only) - promote/demote admin
app.patch("/make-server-a0e1e9cb/users/:userId/set-role", requireAdmin, async (c) => {
  try {
    const rawUserId = c.req.param("userId");
    const userId = decodeURIComponent(String(rawUserId ?? "").trim());
    console.log('[DEBUG:set-role] targetUserId:', userId);
    const debugProfile = await getSupabaseClient()
      .from('profiles')
      .select('id, email, role')
      .eq('id', userId)
      .single();

    console.log('[DEBUG:set-role] profile_from_db:', debugProfile);
    const body = await c.req.json();
    const { role } = body;
    const newRole = role;
    
    if (!role || !['admin', 'user'].includes(role)) {
      return c.json({ error: 'Invalid role. Must be "admin" or "user".' }, 400);
    }
    
    const supabase = getSupabaseClient();
    const currentAuthUser = c.get("user");

    const { data: currentUser, error: currentUserErr } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('id', currentAuthUser?.id)
      .single();

    if (currentUserErr || !currentUser) {
      console.error('❌ Error fetching current user profile:', currentUserErr);
      return c.json({ error: 'Failed to fetch current user profile' }, 500);
    }

    const { data: targetUser, error: targetUserErr } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('id', userId)
      .single();

    if (targetUserErr || !targetUser) {
      console.error('❌ Error fetching target user profile:', targetUserErr);
      return c.json({ error: 'Failed to fetch target user profile' }, 500);
    }

    const currentRole = normalizeAppProfileRole(currentUser.role);
    const targetRole = normalizeAppProfileRole(targetUser.role);

    console.log("[set-role] route param (raw):", rawUserId, "resolved userId:", userId);
    console.log("[set-role] target profile (profiles table):", {
      id: targetUser.id,
      email: targetUser.email,
      role_raw: targetUser.role,
      role_normalized: targetRole,
    });
    await logProfileVsAuthMetadata(supabase, userId, "set-role:target-auth-metadata", targetUser.role);

    // Prevent self role change
    if (currentUser.id === targetUser.id) {
      return c.json({ error: 'You cannot change your own role' }, 403);
    }

    // Only master_admin can change roles
    if (currentRole !== 'master_admin') {
      return c.json({ error: 'Not authorized' }, 403);
    }

    // Prevent removing last master_admin
    if (targetRole === 'master_admin') {
      const { count, error: countErr } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'master_admin');

      if (countErr) {
        console.error('❌ Error counting master admins:', countErr);
        return c.json({ error: 'Failed to verify master admin count' }, 500);
      }

      if ((count ?? 0) <= 1) {
        return c.json({ error: 'At least one master admin must exist' }, 403);
      }
    }
    
    // Cannot demote master_admin to regular user — decision uses profiles.role only (targetRole), never auth metadata
    if (role === "user" && targetRole === "master_admin") {
      console.warn("[set-role] MASTER_ADMIN_PROTECTED (profiles.role === master_admin)", {
        userId,
        profileEmail: targetUser.email,
      });
      await logProfileVsAuthMetadata(supabase, userId, "set-role:MASTER_ADMIN_PROTECTED", targetUser.role);
      return c.json({ error: "Cannot remove admin rights from master admin", code: "MASTER_ADMIN_PROTECTED" }, 403);
    }
    
    // If removing admin privileges, ensure at least one admin or master_admin remains
    if (role === 'user') {
      const { count, error: privCountErr } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .in('role', ['admin', 'master_admin']);
      if (privCountErr) {
        console.error('❌ Error counting privileged profiles:', privCountErr);
        return c.json({ error: 'Failed to verify admin count', details: privCountErr.message }, 500);
      }
      const privileged = count ?? 0;
      const targetPrivileged = targetRole === 'admin' || targetRole === 'master_admin';
      if (targetPrivileged && privileged <= 1) {
        console.warn('⚠️ Cannot remove the last admin-capable user');
        return c.json({ error: 'Cannot remove the only admin user', code: 'LAST_ADMIN' }, 400);
      }
    }

    if (targetRole === newRole) {
      return c.json({ message: "No changes needed" }, 200);
    }
    
    const { error: profileRoleErr } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);
    if (profileRoleErr) {
      console.error('❌ Error updating profiles.role:', profileRoleErr);
      return c.json({ error: 'Failed to update role in profiles', details: profileRoleErr.message }, 500);
    }
    
    // ✅ Merge metadata for legacy clients — never use these fields for server authorization
    const metaPatch: Record<string, any> = { role: newRole };
    if (newRole !== 'master_admin') {
      metaPatch.is_master_admin = false;
    } else {
      metaPatch.is_master_admin = true;
    }
    const newMetadata = await mergeUserMetadata(supabase, userId, metaPatch);
    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: newMetadata
    });
    
    if (error) {
      console.error(`❌ Error setting role to ${role}:`, error);
      return c.json({ error: `Failed to set role to ${role}`, details: error.message }, 500);
    }
    
    console.log(`✅ User ${userId} role set to: ${role}`);
    return c.json({ success: true, user: data });
  } catch (error) {
    console.error('❌ Error setting user role:', error);
    return c.json({ error: 'Failed to set user role', details: String(error) }, 500);
  }
});

// Delete user (admin only)
app.delete("/make-server-a0e1e9cb/users/:userId", requireAdmin, async (c) => {
  try {
    const userId = c.req.param('userId');
    const supabase = getSupabaseClient();
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", userId)
      .maybeSingle();
    const oldProfileImage = (profileRow as { avatar_url?: string | null } | null)?.avatar_url ?? null;
    
    // ✅ Master admin protection (`profiles.role` only)
    const deleteTargetRole = await getProfileRoleById(supabase, userId);
    if (deleteTargetRole === 'master_admin') {
      await logProfileVsAuthMetadata(supabase, userId, 'delete-user:MASTER_ADMIN_PROTECTED', deleteTargetRole);
      return c.json({ error: 'Cannot delete master admin account', code: 'MASTER_ADMIN_PROTECTED' }, 403);
    }
    
    // Delete user from auth system
    const { error } = await supabase.auth.admin.deleteUser(userId);
    
    if (error) {
      console.error('❌ Error deleting user:', error);
      return c.json({ error: 'Failed to delete user', details: error.message }, 500);
    }

    await bestEffortDeleteOwnedStorageObject(
      supabase,
      oldProfileImage,
      [PROFILE_IMAGES_BUCKET],
      "delete-user-profile-image"
    );
    
    console.log(`✅ User deleted: ${userId}`);
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting user:', error);
    return c.json({ error: 'Failed to delete user', details: String(error) }, 500);
  }
});

// Update user profile (name and email)
app.patch("/make-server-a0e1e9cb/users/profile", async (c) => {
  try {
    const body = await c.req.json();
    const { userId, name, email, oldEmail, phone, profileImage, display_name } = body;
    
    if (!userId) {
      return c.json({ error: 'Missing required field: userId' }, 400);
    }
    
    const supabase = getSupabaseClient();
    const { data: existingProfileRow } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", userId)
      .maybeSingle();
    const previousProfileImage = (existingProfileRow as { avatar_url?: string | null } | null)?.avatar_url ?? null;
    
    // Source of truth for role is `profiles` — sync into auth metadata only for legacy clients
    const profileRole = await getProfileRoleById(supabase, userId);
    const isMaster = profileRole === 'master_admin';
    
    // Prepare update data
    const updateData: any = {};
    
    // ✅ FIXED: Merge user metadata to preserve blocked/etc — never take role from the request body
    const metadataPatch: Record<string, any> = {
      role: profileRole,
      is_master_admin: isMaster,
    };
    if (name !== undefined) {
      metadataPatch.name = name;
    }
    if (display_name !== undefined) {
      metadataPatch.display_name =
        display_name === null || display_name === ""
          ? ""
          : String(display_name).trim();
    }
    // Phone lives only in `public.profiles.phone` — do not sync to auth user_metadata
    if (profileImage !== undefined) {
      metadataPatch.profileImage = profileImage;
    }
    
    // Only merge if there are metadata updates
    if (Object.keys(metadataPatch).length > 0) {
      updateData.user_metadata = await mergeUserMetadata(supabase, userId, metadataPatch);
    }
    
    // Update email — only if valid format and non-empty
    if (email && typeof email === 'string' && email.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(email.trim())) {
        updateData.email = email.trim();
      } else {
        console.warn('⚠️ Invalid email format, skipping email update:', email);
      }
    }
    
    // Update user
    const { data, error } = await supabase.auth.admin.updateUserById(userId, updateData);
    
    if (error) {
      console.error('❌ Error updating user profile:', error);
      return c.json({ error: 'Failed to update profile', details: error.message }, 500);
    }

    const authEmail = String(data.user?.email ?? "").trim();
    const fallbackEmail = typeof email === "string" ? email.trim() : "";
    const resolvedEmail = authEmail || fallbackEmail;
    const profilePayload: Record<string, unknown> = {
      id: userId,
      role: profileRole,
    };
    if (resolvedEmail) {
      profilePayload.email = resolvedEmail;
    }
    if (phone !== undefined) {
      profilePayload.phone =
        phone === null || phone === "" ? null : String(phone).trim();
    }
    if (profileImage !== undefined) {
      profilePayload.avatar_url =
        profileImage === null || profileImage === ""
          ? null
          : String(profileImage).trim();
    }

    const { error: profilesSyncErr } = await supabase
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" });
    if (profilesSyncErr) {
      console.error("❌ Error syncing profiles after profile PATCH:", profilesSyncErr);
      return c.json(
        { error: "Failed to sync profile table", details: profilesSyncErr.message },
        500,
      );
    }

    const { data: syncedProfile } = await supabase
      .from("profiles")
      .select("phone, avatar_url")
      .eq("id", userId)
      .maybeSingle();
    const synced = (syncedProfile ?? {}) as { phone?: string | null; avatar_url?: string | null };
    
    // ✅ IF EMAIL CHANGED - Update all venues and events submitted_by field
    if (updateData.email && oldEmail && updateData.email !== oldEmail) {
      console.log(`🔄 Email changed from ${oldEmail} to ${email}. Updating all submissions...`);
      
      // Update venues
      const { data: venuesData, error: venuesUpdateError } = await supabase
        .from('venues_ee0c365c')
        .update({ submitted_by: email })
        .eq('submitted_by', oldEmail)
        .select();
      
      if (venuesUpdateError) {
        console.warn('⚠️  Failed to update venues submitted_by:', venuesUpdateError.message);
      } else {
        console.log(`✅ Updated ${venuesData?.length || 0} venues submitted_by from ${oldEmail} to ${email}`);
      }
      
      // Update events
      const { data: eventsData, error: eventsUpdateError } = await supabase
        .from('events_ee0c365c')
        .update({ submitted_by: email })
        .eq('submitted_by', oldEmail)
        .select();
      
      if (eventsUpdateError) {
        console.warn('⚠️  Failed to update events submitted_by:', eventsUpdateError.message);
      } else {
        console.log(`�� Updated ${eventsData?.length || 0} events submitted_by from ${oldEmail} to ${email}`);
      }
    } else {
      console.log('ℹ️  Email not changed or oldEmail not provided. Skipping submissions update.');
      console.log({ email, oldEmail, emailChanged: email !== oldEmail });
    }

    if (
      profileImage !== undefined &&
      previousProfileImage &&
      !sameOwnedStorageObject(previousProfileImage, profileImage, [PROFILE_IMAGES_BUCKET])
    ) {
      await bestEffortDeleteOwnedStorageObject(
        supabase,
        previousProfileImage,
        [PROFILE_IMAGES_BUCKET],
        "replace-profile-image"
      );
    }
    
    console.log(`✅ User profile updated: ${userId}`);
    const umOut = (data.user.user_metadata ?? {}) as Record<string, unknown>;
    const resolvedOutName = displayNameFromAuthUser({
      email: data.user.email,
      user_metadata: umOut,
    });
    return c.json({ 
      success: true, 
      user: {
        id: data.user.id,
        email: data.user.email,
        name: resolvedOutName,
        role: profileRole,
        phone: synced.phone ?? null,
        profileImage: synced.avatar_url ?? data.user.user_metadata?.profileImage ?? null,
      }
    });
  } catch (error) {
    console.error('❌ Error updating user profile:', error);
    return c.json({ error: 'Failed to update profile', details: String(error) }, 500);
  }
});

// Upload profile image
app.post("/make-server-a0e1e9cb/upload/profile-image", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;
    
    if (!file || !userId) {
      return c.json({ error: 'Missing file or userId' }, 400);
    }
    
    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ error: 'Invalid file type. Only PNG, JPEG, JPG, WEBP, and GIF are allowed.' }, 400);
    }
    
    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return c.json({ error: 'File too large. Maximum size is 5MB.' }, 400);
    }
    
    const supabase = getSupabaseClient();
    const bucketName = 'profile-images-ee0c365c';
    
    // Generate unique filename: userId_timestamp.extension
    const ext = file.name.split('.').pop();
    const filename = `${userId}_${Date.now()}.${ext}`;
    
    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filename, fileBuffer, {
        contentType: file.type,
        upsert: true, // Replace if exists
      });
    
    if (error) {
      console.error('❌ Error uploading file to storage:', error);
      return c.json({ error: 'Failed to upload image', details: error.message }, 500);
    }
    
    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filename);
    
    const publicUrl = publicUrlData.publicUrl;
    
    console.log(`✅ Profile image uploaded: ${filename} -> ${publicUrl}`);
    
    return c.json({ 
      success: true, 
      url: publicUrl,
      filename: filename
    });
  } catch (error) {
    console.error('❌ Error uploading profile image:', error);
    return c.json({ error: 'Failed to upload profile image', details: String(error) }, 500);
  }
});

// Upload venue/event image
app.post("/make-server-a0e1e9cb/upload/venue-image", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return c.json({ error: 'Missing file' }, 400);
    }
    
    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ error: 'Invalid file type. Only PNG, JPEG, JPG, WEBP, and GIF are allowed.' }, 400);
    }
    
    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return c.json({ error: 'File too large. Maximum size is 10MB.' }, 400);
    }
    
    const supabase = getSupabaseClient();
    const bucketName = 'make-ee0c365c-venue-images';
    
    // Generate unique filename
    const ext = file.name.split('.').pop();
    const filename = `venue_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);
    
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filename, fileBuffer, {
        contentType: file.type,
        upsert: true,
      });
    
    if (error) {
      console.error('❌ Error uploading venue image:', error);
      return c.json({ error: 'Failed to upload image', details: error.message }, 500);
    }
    
    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filename);
    
    const publicUrl = publicUrlData.publicUrl;
    
    console.log(`✅ Venue image uploaded: ${filename} -> ${publicUrl}`);
    
    return c.json({ 
      success: true, 
      url: publicUrl,
      filename: filename
    });
  } catch (error) {
    console.error('❌ Error uploading venue image:', error);
    return c.json({ error: 'Failed to upload venue image', details: String(error) }, 500);
  }
});

// ===================================
// SUBMISSIONS ENDPOINTS
// ===================================

/** Row merged from `events_ee0c365c` / `venues_ee0c365c` in submissions list (select('*')). */
type AdminSubmissionListRow = Record<string, unknown> & {
  created_at: string;
  submitted_by?: string | null;
  submitted_by_name?: string | null;
};

// Get all submissions (with optional filter by status or page_slug)
app.get("/make-server-a0e1e9cb/submissions", async (c) => {
  try {
    const status = c.req.query('status'); // pending, approved, rejected
    const page_slug = c.req.query('page_slug'); // food-and-drink, clubs, events, etc.
    
    const supabase = getSupabaseClient();
    
    // Determine which table to query based on page_slug
    let allSubmissions: AdminSubmissionListRow[] = [];
    
    // Query events table - ONLY when explicitly requesting events
    if (page_slug === 'event' || page_slug === 'events') {
      let eventQuery = supabase.from('events_ee0c365c').select('*');
      
      if (status) {
        eventQuery = eventQuery.eq('status', status);
      }
      
      eventQuery = eventQuery.order('created_at', { ascending: false });
      
      const { data: events, error: eventsError } = await eventQuery;
      
      if (eventsError) {
        console.error('❌ Database error fetching events:', eventsError);
        return c.json({ error: 'Failed to fetch events', details: eventsError.message }, 500);
      }
      
      allSubmissions = [...allSubmissions, ...((events ?? []) as AdminSubmissionListRow[])];
    }
    
    // Query venues table - when no page_slug (all venues) or specific venue page_slug
    if (!page_slug || (page_slug !== 'event' && page_slug !== 'events')) {
      let venueQuery = supabase.from('venues_ee0c365c').select('*');
      
      if (status) {
        venueQuery = venueQuery.eq('status', status);
      }
      
      if (page_slug) {
        venueQuery = venueQuery.eq('page_slug', page_slug);
      }
      
      venueQuery = venueQuery.order('created_at', { ascending: false });
      
      const { data: venues, error: venuesError } = await venueQuery;
      
      if (venuesError) {
        console.error('❌ Database error fetching venues:', venuesError);
        return c.json({ error: 'Failed to fetch venues', details: venuesError.message }, 500);
      }
      
      allSubmissions = [...allSubmissions, ...((venues ?? []) as AdminSubmissionListRow[])];
    }
    
    // Sort combined results by created_at
    allSubmissions.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA; // Descending
    });
    
    // Enrich submissions with submitted_by_name from auth users (resolve submitted_by email → name)
    // ✅ FIXED: Use separate submitted_by_name field — don't overwrite contact_name!
    // contact_name = kontakt osoba venue-a (npr. "Petar Petrović")
    // submitted_by_name = ime korisnika koji je kreirao unos (npr. "Vojo")
    try {
      const uniqueEmails = [
        ...new Set(
          allSubmissions.map((s) => s.submitted_by).filter((e): e is string => Boolean(e)),
        ),
      ];
      if (uniqueEmails.length > 0) {
        const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        if (authData?.users) {
          const emailToName: Record<string, string> = {};
          for (const user of authData.users) {
            if (user.email) {
              const name = user.user_metadata?.name || user.user_metadata?.full_name;
              if (name) {
                emailToName[user.email] = name;
              }
            }
          }
          allSubmissions = allSubmissions.map((item) => ({
            ...item,
            submitted_by_name: item.submitted_by
              ? emailToName[item.submitted_by] ?? null
              : null,
          }));
        }
      }
    } catch (enrichErr) {
      console.warn('⚠️ Could not enrich submissions with user names:', enrichErr);
    }
    
    const normalizedSubmissions = allSubmissions.map((item) => {
      const candidate = item as Record<string, unknown>;
      const looksLikeEvent =
        'start_at' in candidate ||
        'event_type' in candidate ||
        'category' in candidate ||
        'Category' in candidate;
      return looksLikeEvent ? normalizeEventResponseRow(candidate) : item;
    });
    return c.json({ submissions: normalizedSubmissions });
  } catch (error) {
    console.error('❌ Error fetching submissions:', error);
    return c.json({ error: 'Failed to fetch submissions', details: String(error) }, 500);
  }
});

// Get single submission by ID
app.get("/make-server-a0e1e9cb/submissions/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const supabase = getSupabaseClient();
    
    // Try events table first
    const { data: event, error: eventError } = await supabase
      .from('events_ee0c365c')
      .select('*')
      .eq('id', id)
      .single();
    
    if (event) {
      return c.json({ submission: normalizeEventResponseRow(event as Record<string, unknown>) });
    }
    
    // Try venues table
    const { data: venue, error: venueError } = await supabase
      .from('venues_ee0c365c')
      .select('*')
      .eq('id', id)
      .single();
    
    if (venue) {
      return c.json({ submission: venue });
    }
    
    console.error('❌ Submission not found:', id);
    return c.json({ error: 'Submission not found' }, 404);
  } catch (error) {
    console.error('❌ Error fetching submission:', error);
    return c.json({ error: 'Failed to fetch submission', details: String(error) }, 500);
  }
});

// Create new submission
app.post("/make-server-a0e1e9cb/submissions", async (c) => {
  try {
    // 🔐 AUTH CHECK — only authenticated users can submit venues/events
    const token = getTokenFromRequest(c);
    if (!token) {
      console.warn('⚠️ [submissions] Unauthenticated submission attempt — no token');
      return c.json({ error: 'Authentication required to submit. Please log in.' }, 401);
    }
    const { data: { user: authUser }, error: authError } = await safeGetUser(null, token);
    if (authError || !authUser) {
      console.warn('⚠️ [submissions] Invalid JWT on submission attempt:', authError?.message);
      return c.json({ error: 'Invalid or expired session. Please log in again.' }, 401);
    }
    console.log(`✅ [submissions] Authenticated user: ${authUser.email} (${authUser.id})`);

    const body = await c.req.json();
    const eventBody = pickEventApiPayload(body);

    // ✅ SVA polja su snake_case — nema camelCase fallbackova
    // Events: start_at / event_type, or legacy routing via page_slug (never persisted on event rows).
    const EVENT_PAGE_SLUGS = ['events', 'event', 'concerts', 'theatre', 'cinema'];
    const submittedPageSlug = String(eventBody.page_slug ?? '').toLowerCase().trim();
    const derivedVenuePageSlug = deriveVenuePageSlugFromVenueType(body.venue_type);
    const isEvent =
      !!eventBody.start_at ||
      !!eventBody.event_type ||
      EVENT_PAGE_SLUGS.includes(submittedPageSlug);
    if (!isEvent && !derivedVenuePageSlug && !body.page_slug) {
      return c.json({ error: 'Missing required field: venue_type (or page_slug fallback)' }, 400);
    }
    if (!body.title) {
      return c.json({ error: 'Missing required field: title' }, 400);
    }
    if (!body.description) {
      return c.json({ error: 'Missing required field: description' }, 400);
    }
    const assignUserIdRaw = typeof eventBody.assign_user_id === 'string' ? eventBody.assign_user_id.trim() : '';
    // ✅ Use sbService() to bypass broken RLS policy
    const supabase = sbService();

    const authEmail = (authUser.email || '').trim();
    if (!authEmail) {
      return c.json({ error: 'Authenticated session has no email address.' }, 401);
    }
    const isAdminSubmitter = await profileHasAdminAccess(supabase, authUser.id);

    let ownerUserId = authUser.id;
    let finalSubmittedBy = authEmail;
    let finalSubmittedByName = extractDisplayNameFromAuthUser(authUser);

    if (isAdminSubmitter && assignUserIdRaw) {
      const { data: assignedData, error: assignedErr } = await supabase.auth.admin.getUserById(assignUserIdRaw);
      const assignedUser = assignedData?.user;
      if (assignedErr || !assignedUser?.id || !assignedUser?.email) {
        return c.json({ error: 'Invalid assign_user_id.' }, 400);
      }
      ownerUserId = assignedUser.id;
      finalSubmittedBy = assignedUser.email.trim();
      finalSubmittedByName = extractDisplayNameFromAuthUser(assignedUser);
    }
    
    // ✅ Check if submitter is admin/master_admin (profiles.role) → auto-approve
    const isSubmitterAdmin = await profileHasAdminAccess(supabase, authUser.id);
    if (isSubmitterAdmin) {
      console.log('👑 Privileged user (profiles.role) — submission will be auto-approved where applicable');
    }
    
    // Determine which table to use
    // ⚠️ 'clubs' is shared by nightclub VENUES (venue_type='nightclub') and club EVENTS — use start_at/event_type for events.
    const tableName = isEvent ? 'events_ee0c365c' : 'venues_ee0c365c';
    
    if (isEvent) {
      // ── EVENT CREATION ── snake_case only
      if (!eventBody.start_at) {
        return c.json({ error: 'Missing required field: start_at (ISO datetime)' }, 400);
      }
      const startDate = new Date(eventBody.start_at);
      if (isNaN(startDate.getTime())) {
        return c.json({ error: 'Invalid start_at datetime format. Use ISO 8601.', received: eventBody.start_at }, 400);
      }
      if (eventBody.end_at) {
        const endDate = new Date(eventBody.end_at);
        if (isNaN(endDate.getTime())) {
          return c.json({ error: 'Invalid end_at datetime format. Use ISO 8601.', received: eventBody.end_at }, 400);
        }
      }
      const parsedSchedules = parseCanonicalEventSchedulesInput(eventBody.event_schedules);
      const parsedSchedulesError = parsedSchedules.ok ? null : parsedSchedules.error;
      if (parsedSchedulesError) {
        return c.json(
          {
            error:
              'Invalid event_schedules format. Expected array of {start_at,end_at?} with ISO datetime strings.',
            details: parsedSchedulesError,
          },
          400
        );
      }

      const eventType = eventBody.event_type || null;
      const categoryInsert = normalizeEventCategoryFromRequest(body, eventBody);
      const event = {
        page_slug: eventBody.page_slug || null,
        event_type: eventType,
        title: eventBody.title,
        title_en: eventBody.title_en || eventBody.title,
        description: eventBody.description,
        description_en: eventBody.description_en || eventBody.description,
        city: eventBody.city || 'Banja Luka',
        venue_name: eventBody.venue_name || null,
        address: eventBody.address || null,
        image: eventBody.image || null,
        price: eventBody.price || null,
        date: eventBody.date || null,
        map_url: eventBody.map_url || null,
        start_at: eventBody.start_at,
        end_at: eventBody.end_at || null,
        event_schedules: parsedSchedules.value,
        ticket_link: eventBody.ticket_link || null,
        organizer_name: eventBody.organizer_name || null,
        organizer_phone: eventBody.organizer_phone || null,
        organizer_email: eventBody.organizer_email || null,
        category: categoryInsert,
        status: isSubmitterAdmin ? 'approved' : 'pending',
        submitted_by_user_id: ownerUserId,
        submitted_by: finalSubmittedBy,
        submitted_by_name: finalSubmittedByName,
      };
      
      console.log(`📋 [CREATE EVENT] table=${tableName} status=${event.status} admin=${isSubmitterAdmin} start_at=${event.start_at}`);
      
      const { data, error } = await supabase
        .from(tableName)
        .insert([event])
        .select()
        .single();
      
      if (error) {
        console.error('❌ Database error creating event:', error);
        return c.json({ error: 'Failed to create event', details: error.message }, 500);
      }
      
      console.log(`✅ New event created: ${data.id} (status: ${data.status})`);
      return c.json({ success: true, submission: normalizeEventResponseRow(data as Record<string, unknown>) }, 201);
      
    } else {
      // ── VENUE CREATION ── snake_case only
      if (body.venue_type !== undefined && !derivedVenuePageSlug) {
        return c.json({ error: `Invalid venue_type: ${String(body.venue_type)}` }, 400);
      }
      const venue = {
        page_slug: derivedVenuePageSlug || body.page_slug || null,
        venue_type: body.venue_type || null,
        title: body.title,
        title_en: body.title_en || body.title,
        description: body.description,
        description_en: body.description_en || body.description,
        city: body.city || 'Banja Luka',
        address: body.address || null,
        image: body.image || null,
        price: body.price || null,
        opening_hours: body.opening_hours || null,
        opening_hours_en: body.opening_hours_en || null,
        cuisine: body.cuisine || null,
        cuisine_en: body.cuisine_en || null,
        website: body.website || null,
        phone: body.phone || null,
        contact_name: body.contact_name || null,
        contact_phone: body.contact_phone || null,
        contact_email: body.contact_email || null,
        tags: normalizeVenueTagsInput(body.tags),
        status: isSubmitterAdmin ? 'approved' : 'pending',
        submitted_by_user_id: ownerUserId,
        submitted_by: finalSubmittedBy,
        submitted_by_name: finalSubmittedByName,
        is_custom: true,
      };
      
      console.log(`📋 [CREATE VENUE] table=${tableName} status=${venue.status} admin=${isSubmitterAdmin}`);
      
      const { data, error } = await supabase
        .from(tableName)
        .insert([venue])
        .select()
        .single();
      
      if (error) {
        console.error('❌ Database error creating venue:', error);
        return c.json({ error: 'Failed to create venue', details: error.message }, 500);
      }
      
      console.log(`✅ New venue created: ${data.id} (${venue.page_slug}, status: ${data.status})`);
      return c.json({ success: true, submission: data }, 201);
    }
  } catch (error) {
    console.error('❌ Error creating submission:', error);
    return c.json({ error: 'Failed to create submission', details: String(error) }, 500);
  }
});

// Update submission by ID (event/venue edit flow)
app.put("/make-server-a0e1e9cb/submissions/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const eventBody = pickEventApiPayload(body);
    console.log("UPDATE BODY:", body);
    console.log('🟪 [PUT /submissions/:id] START', { id });
    console.log('🟪 [PUT /submissions/:id] params', { id });
    console.log('🟪 [PUT /submissions/:id] request body', body);

    if (!id) {
      return c.json({ error: 'Submission ID is required' }, 400);
    }

    const supabase = sbService();

    let resolvedSubmittedBy: string | undefined = undefined;
    let resolvedSubmittedByUserId: string | undefined = undefined;
    let resolvedSubmittedByName: string | null | undefined = undefined;

    if (typeof eventBody.assign_user_id === 'string' && eventBody.assign_user_id.trim()) {
      const assignUserId = eventBody.assign_user_id.trim();
      const { data: uidData, error: uidErr } = await supabase.auth.admin.getUserById(assignUserId);
      if (uidErr || !uidData?.user?.id || !uidData.user.email) {
        return c.json({ error: 'Invalid assign_user_id.' }, 400);
      }
      resolvedSubmittedBy = uidData.user.email.trim();
      resolvedSubmittedByUserId = uidData.user.id;
      resolvedSubmittedByName = extractDisplayNameFromAuthUser(uidData.user);
    } else if (eventBody.submitted_by !== undefined) {
      const rawSb = String(eventBody.submitted_by ?? '').trim();
      if (rawSb) {
        const resolvedSb = await resolveRegisteredSubmitterEmail(supabase, rawSb);
        if (resolvedSb) resolvedSubmittedBy = resolvedSb;
      }
    }

    const eventPayload: Record<string, unknown> = {
      title: eventBody.title,
      title_en: eventBody.title_en,
      description: eventBody.description,
      description_en: eventBody.description_en,
      event_type: eventBody.event_type,
      city: eventBody.city,
      venue_name: eventBody.venue_name,
      address: eventBody.address,
      image: eventBody.image,
      price: eventBody.price,
      start_at: eventBody.start_at,
      end_at: eventBody.end_at,
      ticket_link: eventBody.ticket_link,
      organizer_name: eventBody.organizer_name,
      organizer_phone: eventBody.organizer_phone,
      organizer_email: eventBody.organizer_email,
      ...(resolvedSubmittedByUserId !== undefined ? { submitted_by_user_id: resolvedSubmittedByUserId } : {}),
      ...(resolvedSubmittedBy !== undefined ? { submitted_by: resolvedSubmittedBy } : {}),
      ...(resolvedSubmittedByName !== undefined ? { submitted_by_name: resolvedSubmittedByName } : {}),
      updated_at: new Date().toISOString(),
    };
    if (eventBody.page_slug !== undefined) eventPayload.page_slug = eventBody.page_slug ?? null;
    if (eventBody.date !== undefined) eventPayload.date = eventBody.date ?? null;
    if (eventBody.map_url !== undefined) eventPayload.map_url = eventBody.map_url ?? null;
    if (eventBody.event_schedules !== undefined) {
      const parsedSchedules = parseCanonicalEventSchedulesInput(eventBody.event_schedules);
      const parsedSchedulesError = parsedSchedules.ok ? null : parsedSchedules.error;
      if (parsedSchedulesError) {
        return c.json(
          {
            error:
              'Invalid event_schedules format. Expected array of {start_at,end_at?} with ISO datetime strings.',
            details: parsedSchedulesError,
          },
          400
        );
      }
      eventPayload.event_schedules = parsedSchedules.value;
    }
    if (requestSpecifiesCategory(body, eventBody)) {
      eventPayload.category = normalizeEventCategoryFromRequest(body, eventBody);
    }

    const { data: updatedEventRow, error: eventError } = await supabase
      .from('events_ee0c365c')
      .update(eventPayload)
      .eq('id', id)
      .select('*')
      .single();

    if (!eventError && updatedEventRow) {
      return c.json({
        success: true,
        submission: normalizeEventResponseRow(updatedEventRow as Record<string, unknown>),
        entity: 'event',
      });
    }

    const venuePayload: Record<string, unknown> = {
      title: body.title,
      title_en: body.title_en,
      description: body.description,
      description_en: body.description_en,
      city: body.city,
      address: body.address,
      image: body.image,
      price: body.price,
      ...(resolvedSubmittedByUserId !== undefined ? { submitted_by_user_id: resolvedSubmittedByUserId } : {}),
      ...(resolvedSubmittedBy !== undefined ? { submitted_by: resolvedSubmittedBy } : {}),
      ...(resolvedSubmittedByName !== undefined ? { submitted_by_name: resolvedSubmittedByName } : {}),
      updated_at: new Date().toISOString(),
    };
    const derivedVenuePageSlugForUpdate = deriveVenuePageSlugFromVenueType(body.venue_type);
    if (body.venue_type !== undefined && !derivedVenuePageSlugForUpdate) {
      return c.json({ error: `Invalid venue_type: ${String(body.venue_type)}` }, 400);
    }
    if (derivedVenuePageSlugForUpdate) {
      venuePayload.page_slug = derivedVenuePageSlugForUpdate;
    } else if (body.page_slug !== undefined) {
      venuePayload.page_slug = body.page_slug;
    }
    if (body.venue_type !== undefined) venuePayload.venue_type = body.venue_type;
    if (body.website !== undefined) venuePayload.website = body.website;
    if (body.phone !== undefined) venuePayload.phone = body.phone;
    if (body.contact_name !== undefined) venuePayload.contact_name = body.contact_name;
    if (body.contact_phone !== undefined) venuePayload.contact_phone = body.contact_phone;
    if (body.contact_email !== undefined) venuePayload.contact_email = body.contact_email;
    if (body.opening_hours !== undefined) venuePayload.opening_hours = body.opening_hours;
    if (body.opening_hours_en !== undefined) venuePayload.opening_hours_en = body.opening_hours_en;
    if (body.cuisine !== undefined) venuePayload.cuisine = body.cuisine;
    if (body.cuisine_en !== undefined) venuePayload.cuisine_en = body.cuisine_en;
    if (body.tags !== undefined) venuePayload.tags = normalizeVenueTagsInput(body.tags);

    const { data: updatedVenueRows, error: venueError } = await supabase
      .from('venues_ee0c365c')
      .update(venuePayload)
      .eq('id', id)
      .select();

    if (!venueError && updatedVenueRows && updatedVenueRows.length > 0) {
      return c.json({ success: true, submission: updatedVenueRows[0], entity: 'venue' });
    }

    console.error(`❌ Submission ${id} not found in events or venues table`, { eventError, venueError });
    return c.json({ error: 'Submission not found', details: `No submission with id ${id} in events or venues table` }, 404);
  } catch (error) {
    console.error('❌ Error updating submission:', error);
    return c.json({ error: 'Failed to update submission', details: String(error) }, 500);
  }
});

// Approve submission (admin only)
app.put("/make-server-a0e1e9cb/submissions/:id/approve", requireAdmin, async (c) => {
  try {
    const id = c.req.param('id');
    const supabase = getSupabaseClient();
    
    // Try events table first
    const { data: event, error: eventError } = await supabase
      .from('events_ee0c365c')
      .update({ 
        status: 'approved',
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (event) {
      console.log(`✅ Event approved: ${id}`);
      return c.json({ success: true, submission: event });
    }
    
    // Try venues table
    const { data: venue, error: venueError } = await supabase
      .from('venues_ee0c365c')
      .update({ 
        status: 'approved',
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (venue) {
      console.log(`✅ Venue approved: ${id}`);
      return c.json({ success: true, submission: venue });
    }
    
    console.error('❌ Submission not found:', id);
    return c.json({ error: 'Submission not found' }, 404);
  } catch (error) {
    console.error('❌ Error approving submission:', error);
    return c.json({ error: 'Failed to approve submission', details: String(error) }, 500);
  }
});

// Reject submission (admin only)
app.put("/make-server-a0e1e9cb/submissions/:id/reject", requireAdmin, async (c) => {
  try {
    const id = c.req.param('id');
    const supabase = getSupabaseClient();
    
    // Try events table first
    const { data: event, error: eventError } = await supabase
      .from('events_ee0c365c')
      .update({ 
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (event) {
      console.log(`✅ Event rejected: ${id}`);
      return c.json({ success: true, submission: event });
    }
    
    // Try venues table
    const { data: venue, error: venueError } = await supabase
      .from('venues_ee0c365c')
      .update({ 
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (venue) {
      console.log(`✅ Venue rejected: ${id}`);
      return c.json({ success: true, submission: venue });
    }
    
    console.error('❌ Submission not found:', id);
    return c.json({ error: 'Submission not found' }, 404);
  } catch (error) {
    console.error('❌ Error rejecting submission:', error);
    return c.json({ error: 'Failed to reject submission', details: String(error) }, 500);
  }
});

// Delete submission (owner or admin)
app.delete("/make-server-a0e1e9cb/submissions/:id", async (c) => {
  try {
    const id = c.req.param('id');
    console.log('🗑️ [DELETE /submissions/:id] Hit route', { id });
    const token = getTokenFromRequest(c);
    if (!token) {
      return c.json({ error: 'Unauthorized - please log in' }, 401);
    }

    const { data: { user }, error: authError } = await safeGetUser(null, token);
    if (authError || !user || !user.email) {
      console.error('🗑️ [DELETE /submissions/:id] Auth failed', { id, authError: authError?.message });
      return c.json({ error: 'Unauthorized - invalid token' }, 401);
    }

    const normalize = (value: unknown): string => String(value ?? '').trim().toLowerCase();
    const userEmail = normalize(user.email);
    const supabase = sbService();
    const isAdmin = await profileHasAdminAccess(supabase, user.id);
    console.log('🗑️ [DELETE /submissions/:id] Resolved user', { id, userEmail, isAdmin });

    
    // Try deleting from events table first
    const { data: eventToDelete, error: eventFetchError } = await supabase
      .from('events_ee0c365c')
      .select('id, submitted_by_user_id, submitted_by, organizer_email, image')
      .eq('id', id)
      .maybeSingle();

    if (eventFetchError) {
      return c.json({ error: 'Failed to fetch event', details: eventFetchError.message }, 500);
    }

    if (eventToDelete) {
      const isOwner =
        normalize((eventToDelete as Record<string, unknown>).submitted_by_user_id) === normalize(user.id) ||
        normalize(eventToDelete.submitted_by) === userEmail ||
        normalize(eventToDelete.organizer_email) === userEmail;
      if (!isAdmin && !isOwner) {
        return c.json({ error: 'Forbidden - not your event' }, 403);
      }

      const { data: deletedEventRows, error: eventError } = await supabase
        .from('events_ee0c365c')
        .delete()
        .eq('id', id)
        .select('id');

      if (eventError) {
        return c.json({ error: 'Failed to delete event', details: eventError.message }, 500);
      }
      if (!deletedEventRows || deletedEventRows.length === 0) {
        return c.json({ error: 'Event not found' }, 404);
      }

      await bestEffortDeleteOwnedStorageObject(
        supabase,
        (eventToDelete as Record<string, unknown>).image,
        [VENUE_IMAGES_BUCKET],
        "delete-submission-event-image"
      );

      console.log(`✅ Event deleted via /submissions route: ${id}`);
      return c.json({ success: true, entity: 'event', deleted_id: id });
    }
    
    // Fallback: try deleting from venues table (legacy + venues)
    const { data: venueToDelete, error: venueFetchError } = await supabase
      .from('venues_ee0c365c')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (venueFetchError) {
      return c.json({ error: 'Failed to fetch venue', details: venueFetchError.message }, 500);
    }
    if (!venueToDelete) {
      return c.json({ error: 'Submission not found' }, 404);
    }

    const isVenueOwner =
      normalize((venueToDelete as Record<string, unknown>).submitted_by_user_id) === normalize(user.id) ||
      normalize(venueToDelete.submitted_by) === userEmail ||
      normalize(venueToDelete.contact_email) === userEmail ||
      normalize((venueToDelete as any).organizer_email) === userEmail;
    console.log('🗑️ [DELETE /submissions/:id] Venue ownership check', {
      id,
      submitted_by: normalize(venueToDelete.submitted_by),
      contact_email: normalize(venueToDelete.contact_email),
      organizer_email: normalize((venueToDelete as any).organizer_email),
      userEmail,
      isVenueOwner,
      isAdmin,
    });
    if (!isAdmin && !isVenueOwner) {
      return c.json({ error: 'Forbidden - not your venue' }, 403);
    }

    const { data: deletedVenueRows, error: venueError } = await supabase
      .from('venues_ee0c365c')
      .delete()
      .eq('id', id)
      .select('id');

    if (venueError) {
      return c.json({ error: 'Failed to delete venue', details: venueError.message }, 500);
    }
    if (!deletedVenueRows || deletedVenueRows.length === 0) {
      return c.json({ error: 'Submission not found' }, 404);
    }

    await bestEffortDeleteOwnedStorageObject(
      supabase,
      (venueToDelete as Record<string, unknown>).image,
      [VENUE_IMAGES_BUCKET],
      "delete-submission-venue-image"
    );

    console.log(`✅ Venue deleted via /submissions route: ${id}`);
    return c.json({ success: true, entity: 'venue', deleted_id: id });
  } catch (error) {
    console.error('❌ Error deleting submission:', error);
    return c.json({ error: 'Failed to delete submission', details: String(error) }, 500);
  }
});

// ===================================
// EVENTS ENDPOINTS (with datetime filtering)
// ===================================

// Get user's own events (authenticated)
app.get("/make-server-a0e1e9cb/my-events", async (c) => {
  try {
    const accessToken = getTokenFromRequest(c);
    
    if (!accessToken) {
      return c.json({ error: 'Unauthorized - please log in' }, 401);
    }
    
    // Session via safeGetUser → GoTrue /auth/v1/user
    const { data: { user }, error: authError } = await safeGetUser(null, accessToken);
    
    if (authError || !user || !user.email) {
      return c.json({ error: 'Unauthorized - invalid token' }, 401);
    }
    
    const userEmail = user.email;
    const userId = user.id;
    console.log(`🔍 Fetching events for user: ${userEmail} (${userId})`);
    
    // Get ALL events submitted by this user (any status)
    const supabase = sbService();
    const { data: events, error } = await supabase
      .from('events_ee0c365c')
      .select('*')
      .or(`submitted_by_user_id.eq.${userId},submitted_by.eq.${userEmail},organizer_email.eq.${userEmail}`)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Database error fetching user events:', error);
      return c.json({ error: 'Failed to fetch events', details: error.message }, 500);
    }
    
    // 🔄 Also check venues table for legacy events stuck there
    const { data: venueEvents } = await supabase
      .from('venues_ee0c365c')
      .select('*')
      .or(`submitted_by_user_id.eq.${userId},submitted_by.eq.${userEmail},organizer_email.eq.${userEmail}`)
      .not('start_at', 'is', null)
      .order('created_at', { ascending: false });
    
    const allEvents = [
      ...(events || []),
      ...(venueEvents || []).map((v: any) => ({ ...v, _legacy_venue: true })),
    ];
    
    console.log(`✅ Found ${events?.length || 0} events + ${venueEvents?.length || 0} legacy venue-events for ${userEmail}`);
    return c.json({ events: normalizeEventResponseRows(allEvents as Record<string, unknown>[]) });
  } catch (error) {
    console.error('❌ Error fetching user events:', error);
    return c.json({ error: 'Failed to fetch events', details: String(error) }, 500);
  }
});

// DELETE ALL USER SUBMISSIONS (venues + events)
app.delete("/make-server-a0e1e9cb/my-submissions/all", async (c) => {
  try {
    const accessToken = getTokenFromRequest(c);
    
    if (!accessToken) {
      return c.json({ error: 'Unauthorized - please log in' }, 401);
    }
    
    // Session via safeGetUser → GoTrue /auth/v1/user
    const { data: { user }, error: authError } = await safeGetUser(null, accessToken);
    
    if (authError || !user || !user.email) {
      return c.json({ error: 'Unauthorized - invalid token' }, 401);
    }
    
    // Use service role for DB operations
    const supabase = sbService();
    const userEmail = user.email;
    const userId = user.id;
    console.log(`🗑️ DELETING ALL SUBMISSIONS for user: ${userEmail}`);
    
    // ✅ FIXED: Use select() to get deleted records for accurate count
    const { data: deletedVenues, error: venuesError } = await supabase
      .from('venues_ee0c365c')
      .delete()
      .or(`submitted_by_user_id.eq.${userId},submitted_by.eq.${userEmail},contact_email.eq.${userEmail}`)
      .select('id, image');
    
    if (venuesError) {
      console.error('❌ Error deleting venues:', venuesError);
      return c.json({ error: 'Failed to delete venues', details: venuesError.message }, 500);
    }
    
    const venuesCount = deletedVenues?.length || 0;
    
    // Delete all events
    const { data: deletedEvents, error: eventsError } = await supabase
      .from('events_ee0c365c')
      .delete()
      .or(`submitted_by_user_id.eq.${userId},submitted_by.eq.${userEmail},organizer_email.eq.${userEmail}`)
      .select('id, image');
    
    if (eventsError) {
      console.error('❌ Error deleting events:', eventsError);
      return c.json({ error: 'Failed to delete events', details: eventsError.message }, 500);
    }
    
    const eventsCount = deletedEvents?.length || 0;

    for (const row of (deletedVenues || []) as Array<Record<string, unknown>>) {
      await bestEffortDeleteOwnedStorageObject(
        supabase,
        row.image,
        [VENUE_IMAGES_BUCKET],
        "delete-my-submissions-venue-image"
      );
    }
    for (const row of (deletedEvents || []) as Array<Record<string, unknown>>) {
      await bestEffortDeleteOwnedStorageObject(
        supabase,
        row.image,
        [VENUE_IMAGES_BUCKET],
        "delete-my-submissions-event-image"
      );
    }
    
    console.log(`✅ DELETED ${venuesCount || 0} venues and ${eventsCount || 0} events for ${userEmail}`);
    return c.json({ 
      success: true, 
      deleted: {
        venues: venuesCount || 0,
        events: eventsCount || 0,
        total: (venuesCount || 0) + (eventsCount || 0)
      }
    });
  } catch (error) {
    console.error('❌ Error deleting submissions:', error);
    return c.json({ error: 'Failed to delete submissions', details: String(error) }, 500);
  }
});

// Get events with advanced filtering
app.get("/make-server-a0e1e9cb/events", async (c) => {
  try {
    const rawStatus = c.req.query('status');
    const rawFilter = c.req.query('filter');
    const status = (rawStatus || '').trim().toLowerCase(); // pending, approved, rejected, all
    const filter = (rawFilter || '').trim().toLowerCase(); // upcoming, today, tomorrow, weekend, past, all
    const city = c.req.query('city');
    const type = c.req.query('type');
    const page_slug = c.req.query('page_slug'); // concerts, theatre, cinema, events, etc.
    const knownStatuses = new Set(['pending', 'approved', 'rejected', 'all', '']);
    const knownFilters = new Set(['upcoming', 'today', 'tomorrow', 'weekend', 'past', 'all', '']);

    console.log(
      `📨 [GET /events] status="${rawStatus ?? ''}" normalized="${status || '(empty)'}" filter="${rawFilter ?? ''}" normalized="${filter || '(empty)'}" city="${city ?? ''}" type="${type ?? ''}" page_slug="${page_slug ?? ''}"`
    );

    if (!knownStatuses.has(status)) {
      console.warn(`⚠️ [GET /events] Unknown status "${status}" - query may return empty set`);
    }
    if (!knownFilters.has(filter)) {
      console.warn(`⚠️ [GET /events] Unknown filter "${filter}" - date filter will be skipped`);
    }
    
    const supabase = getSupabaseClient();
    
    // Build base query - use events table
    let query = supabase
      .from('events_ee0c365c')
      .select('*');
    
    // Filter by status (default: only approved)
    // status=all means do not constrain by status.
    if (status && status !== 'all') {
      query = query.eq('status', status);
    } else {
      // Keep public default behavior (approved only) unless caller explicitly asks for all.
      if (!status) {
        query = query.eq('status', 'approved');
      }
    }
    
    // Filter by page_slug (which page this event belongs to)
    if (page_slug) {
      // Treat "events" as the general bucket and include legacy "event"/"exhibition" slugs.
      if (page_slug === 'events') {
        query = query.in('page_slug', ['events', 'event', 'exhibition']);
      } else {
        query = query.eq('page_slug', page_slug);
      }
    }
    
    // Filter by city
    if (city) {
      query = query.eq('city', city);
    }
    
    // Filter by type
    if (type) {
      query = query.eq('event_type', type);
    }
    
    // Get all matching events first
    const { data: allEvents, error } = await query;
    
    if (error) {
      console.error('❌ Database error fetching events:', error);
      return c.json({ error: 'Failed to fetch events', details: error.message }, 500);
    }
    
    let events = allEvents || [];
    
    // Filter by date/time (client-side filtering for complex date logic)
    // IMPORTANT: use full event_schedules (all slots), not just legacy start_at.
    const getEventSlots = (item: any): Array<{ start: Date; end: Date | null }> => {
      const slots: Array<{ start: Date; end: Date | null }> = [];
      const rawSchedules = item?.event_schedules;
      if (Array.isArray(rawSchedules)) {
        for (const row of rawSchedules) {
          if (!row || typeof row !== 'object') continue;
          const startRaw = (row as Record<string, unknown>).start_at;
          const endRaw = (row as Record<string, unknown>).end_at;
          if (typeof startRaw !== 'string' || !startRaw.trim()) continue;
          const start = new Date(startRaw);
          if (isNaN(start.getTime())) continue;
          let end: Date | null = null;
          if (typeof endRaw === 'string' && endRaw.trim()) {
            const parsedEnd = new Date(endRaw);
            if (!isNaN(parsedEnd.getTime())) end = parsedEnd;
          }
          slots.push({ start, end });
        }
      }
      if (slots.length === 0 && item?.start_at) {
        const start = new Date(item.start_at);
        if (!isNaN(start.getTime())) {
          let end: Date | null = null;
          if (item?.end_at) {
            const parsedEnd = new Date(item.end_at);
            if (!isNaN(parsedEnd.getTime())) end = parsedEnd;
          }
          slots.push({ start, end });
        }
      }
      slots.sort((a, b) => a.start.getTime() - b.start.getTime());
      return slots;
    };
    const getNextUpcomingStart = (item: any, nowRef: Date): Date | null => {
      const slots = getEventSlots(item);
      const next = slots.find((s) => s.start >= nowRef);
      return next ? next.start : null;
    };
    const getLastEffectiveDate = (item: any): Date | null => {
      const slots = getEventSlots(item);
      if (slots.length === 0) return null;
      return slots.reduce((max, s) => {
        const effective = s.end ?? s.start;
        return effective > max ? effective : max;
      }, slots[0].end ?? slots[0].start);
    };

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    
    const tomorrowStart = new Date(todayEnd);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
    
    if (filter === 'upcoming') {
      events = events.filter((item) => {
        return getNextUpcomingStart(item, now) !== null;
      });
    } else if (filter === 'today') {
      events = events.filter((item) => {
        const slots = getEventSlots(item);
        return slots.some((s) => s.start >= todayStart && s.start < todayEnd);
      });
    } else if (filter === 'tomorrow') {
      events = events.filter((item) => {
        const slots = getEventSlots(item);
        return slots.some((s) => s.start >= tomorrowStart && s.start < tomorrowEnd);
      });
    } else if (filter === 'weekend') {
      // Get next weekend (Saturday + Sunday)
      const daysUntilSaturday = (6 - now.getDay() + 7) % 7;
      const saturdayStart = new Date(todayStart);
      saturdayStart.setDate(saturdayStart.getDate() + daysUntilSaturday);
      const sundayEnd = new Date(saturdayStart);
      sundayEnd.setDate(sundayEnd.getDate() + 2);
      
      events = events.filter((item) => {
        const slots = getEventSlots(item);
        return slots.some((s) => s.start >= saturdayStart && s.start < sundayEnd);
      });
    } else if (filter === 'past') {
      events = events.filter((item) => {
        const slots = getEventSlots(item);
        if (slots.length === 0) return false;
        return slots.every((s) => (s.end ?? s.start) < now);
      });
    }
    
    // Sort by relevant schedule point (next upcoming for current/future lists).
    events.sort((a, b) => {
      const dateA =
        filter === 'past'
          ? (getLastEffectiveDate(a)?.getTime() ?? 0)
          : (getNextUpcomingStart(a, now)?.getTime() ??
            getEventSlots(a)[0]?.start.getTime() ??
            0);
      const dateB =
        filter === 'past'
          ? (getLastEffectiveDate(b)?.getTime() ?? 0)
          : (getNextUpcomingStart(b, now)?.getTime() ??
            getEventSlots(b)[0]?.start.getTime() ??
            0);
      return dateA - dateB;
    });
    
    // Enrich events with submitted_by_name from auth users (resolve submitted_by email → name)
    // ✅ FIXED: Use separate submitted_by_name — don't overwrite contact_name!
    try {
      const uniqueEmails = [...new Set(events.map((e: any) => e.submitted_by).filter(Boolean))];
      if (uniqueEmails.length > 0) {
        const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        if (authData?.users) {
          const emailToName: Record<string, string> = {};
          for (const user of authData.users) {
            if (user.email) {
              const name = user.user_metadata?.name || user.user_metadata?.full_name;
              if (name) {
                emailToName[user.email] = name;
              }
            }
          }
          events = events.map((event: any) => ({
            ...event,
            submitted_by_name: emailToName[event.submitted_by] || null,
          }));
        }
      }
    } catch (enrichErr) {
      console.warn('⚠️ Could not enrich events with user names:', enrichErr);
    }
    
    // Filter out inactive events for public requests
    if (!status || status === 'approved') {
      const inactiveEventIds = await loadInactiveEventIds();
      if (inactiveEventIds.length > 0) {
        const inactiveSet = new Set(inactiveEventIds);
        const before = events.length;
        events = events.filter((e: any) => !inactiveSet.has(e.id));
        console.log(`🔴 Filtered out ${before - events.length} inactive events`);
      }
    }
    
    return c.json({ events: normalizeEventResponseRows(events as Record<string, unknown>[]) });
  } catch (error) {
    console.error('❌ Error fetching events:', error);
    return c.json({ error: 'Failed to fetch events', details: String(error) }, 500);
  }
});

// Get single event by ID
app.get("/make-server-a0e1e9cb/events/:id", async (c) => {
  try {
    const id = c.req.param('id');
    
    console.log('🔍🔍🔍 [GET EVENT BY ID] ===========================');
    console.log('🔍 Event ID:', id);
    
    if (!id) {
      return c.json({ error: 'Event ID is required' }, 400);
    }
    
    const supabase = getSupabaseClient();
    
    // 🔥 First, try to fetch the event without status filter
    const { data: event, error } = await supabase
      .from('events_ee0c365c')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    console.log('🔍 Database query result:');
    console.log('🔍 Event found:', !!event);
    console.log('🔍 Event status:', event?.status);
    console.log('🔍 Event submitted_by:', event?.submitted_by);
    console.log('🔍 Event organizer_email:', event?.organizer_email);
    console.log('🔍 Error:', error);
    
    if (error) {
      console.error('❌ Database error fetching event:', error);
      return c.json({ error: 'Event not found', details: error.message }, 404);
    }
    
    if (!event) {
      // 🔄 Fallback: check venues table (legacy bug — events stuck in venues)
      console.log(`⚠️ Event ${id} not in events table, checking venues table (legacy fallback)...`);
      const { data: venueEvent } = await supabase
        .from('venues_ee0c365c')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (venueEvent) {
        console.log(`🔄 Found legacy event "${venueEvent.title}" in venues table`);
        return c.json({ event: normalizeEventResponseRow(venueEvent as Record<string, unknown>), legacy_venue: true });
      }
      
      console.log('❌ Event not found in events or venues table');
      return c.json({ error: 'Event not found' }, 404);
    }
    
    // ✅ If event is approved, return it (public access)
    if (event.status === 'approved') {
      console.log('✅ Event is approved - returning to everyone');
      return c.json({ event: normalizeEventResponseRow(event as Record<string, unknown>) });
    }
    
    // If event is NOT approved, check if user is the owner
    const accessToken = getTokenFromRequest(c);
    
    // Only try to validate if we have a token
    if (accessToken) {
      try {
        // Session via safeGetUser → GoTrue /auth/v1/user
        const { data: { user }, error: authError } = await safeGetUser(null, accessToken);
        
        console.log('🔍 Auth check result:');
        console.log('🔍 User email:', user?.email);
        console.log('🔍 User role:', user?.user_metadata?.role);
        console.log('🔍 Auth error:', authError);
        
        if (!authError && user) {
          const userEmail = user.email;
          const isPrivileged = await profileHasAdminAccess(supabase, user.id);
          
          console.log('🔍 Ownership check:');
          console.log('🔍 User email:', `"${userEmail}"`);
          console.log('🔍 Event submitted_by:', `"${event.submitted_by}"`);
          console.log('🔍 Event organizer_email:', `"${event.organizer_email}"`);
          console.log('🔍 Email match (submitted_by):', event.submitted_by === userEmail);
          console.log('🔍 Email match (organizer):', event.organizer_email === userEmail);
          console.log('🔍 Is admin/master (profiles.role):', isPrivileged);
          
          // 🔥 ADMIN / MASTER_ADMIN can access ALL events
          if (isPrivileged) {
            console.log('✅ Privileged user (profiles.role) - granting access to all events');
            return c.json({ event: normalizeEventResponseRow(event as Record<string, unknown>) });
          }
          
          // Check if user owns this event
          if (
            normalize((event as Record<string, unknown>).submitted_by_user_id) === normalize(user.id) ||
            event.submitted_by === userEmail ||
            event.organizer_email === userEmail
          ) {
            console.log(`✅ User ${userEmail} has access to their own event (status: ${event.status})`);
            return c.json({ event: normalizeEventResponseRow(event as Record<string, unknown>) });
          }
          
          console.log('❌ User does not own this event');
        } else if (authError) {
          console.error('❌ JWT validation failed:', authError?.message);
        }
      } catch (authError) {
        console.error('❌ Auth check failed:', authError);
      }
    } else {
      console.log('❌ No valid access token provided (either missing or anon key)');
    }
    
    // ❌ User is not authorized to view this non-approved event
    console.log(`⚠️ Unauthorized access to event ${id} (status: ${event.status})`);
    console.log('🔍🔍🔍 [GET EVENT BY ID END] ===========================');
    return c.json({ error: 'Event not found' }, 404);
  } catch (error) {
    console.error('❌ Error fetching event by ID:', error);
    return c.json({ error: 'Failed to fetch event', details: String(error) }, 500);
  }
});

// Update event by ID
app.put("/make-server-a0e1e9cb/events/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const eventBody = pickEventApiPayload(body);
    console.log("UPDATE BODY:", body);
    console.log('🟪 [PUT /events/:id] START', { id });
    console.log('🟪 [PUT /events/:id] params', { id });
    console.log('🟪 [PUT /events/:id] request body', body);
    
    if (!id) {
      return c.json({ error: 'Event ID is required' }, 400);
    }
    
    // ✅ Use sbService() to bypass broken RLS policy
    const supabase = sbService();
    const { data: existingEventRow } = await supabase
      .from('events_ee0c365c')
      .select('id, image')
      .eq('id', id)
      .maybeSingle();
    const previousEventImage = (existingEventRow as { image?: string | null } | null)?.image ?? null;

    let resolvedEventSubmittedBy: string | undefined = undefined;
    let resolvedEventSubmittedByUserId: string | undefined = undefined;
    let resolvedEventSubmittedByName: string | null | undefined = undefined;
    if (typeof eventBody.assign_user_id === 'string' && eventBody.assign_user_id.trim()) {
      const assignUserId = eventBody.assign_user_id.trim();
      const { data: uidData, error: uidErr } = await supabase.auth.admin.getUserById(assignUserId);
      if (uidErr || !uidData?.user?.id || !uidData.user.email) {
        return c.json({ error: 'Invalid assign_user_id.' }, 400);
      }
      resolvedEventSubmittedBy = uidData.user.email.trim();
      resolvedEventSubmittedByUserId = uidData.user.id;
      resolvedEventSubmittedByName = extractDisplayNameFromAuthUser(uidData.user);
      console.log(`🔗 Auto-assigning event to user: ${resolvedEventSubmittedBy} (userId: ${assignUserId})`);
    } else if (eventBody.submitted_by !== undefined) {
      const rawSb = String(eventBody.submitted_by ?? '').trim();
      if (rawSb) {
        const resolvedSb = await resolveRegisteredSubmitterEmail(supabase, rawSb);
        if (resolvedSb) {
          resolvedEventSubmittedBy = resolvedSb;
        }
      }
    }
    
    // ✅ snake_case only — nema camelCase fallbackova
    const updatePayload: Record<string, unknown> = {
      title: eventBody.title,
      title_en: eventBody.title_en,
      description: eventBody.description,
      description_en: eventBody.description_en,
      event_type: eventBody.event_type,
      city: eventBody.city,
      venue_name: eventBody.venue_name,
      address: eventBody.address,
      image: eventBody.image,
      price: eventBody.price,
      start_at: eventBody.start_at,
      end_at: eventBody.end_at,
      ticket_link: eventBody.ticket_link,
      organizer_name: eventBody.organizer_name,
      organizer_phone: eventBody.organizer_phone,
      organizer_email: eventBody.organizer_email,
      ...(resolvedEventSubmittedByUserId !== undefined ? { submitted_by_user_id: resolvedEventSubmittedByUserId } : {}),
      ...(resolvedEventSubmittedBy !== undefined ? { submitted_by: resolvedEventSubmittedBy } : {}),
      ...(resolvedEventSubmittedByName !== undefined ? { submitted_by_name: resolvedEventSubmittedByName } : {}),
      updated_at: new Date().toISOString(),
    };
    if (eventBody.page_slug !== undefined) updatePayload.page_slug = eventBody.page_slug ?? null;
    if (eventBody.date !== undefined) updatePayload.date = eventBody.date ?? null;
    if (eventBody.map_url !== undefined) updatePayload.map_url = eventBody.map_url ?? null;
    if (eventBody.event_schedules !== undefined) {
      const parsedSchedules = parseCanonicalEventSchedulesInput(eventBody.event_schedules);
      const parsedSchedulesError = parsedSchedules.ok ? null : parsedSchedules.error;
      if (parsedSchedulesError) {
        return c.json(
          {
            error:
              'Invalid event_schedules format. Expected array of {start_at,end_at?} with ISO datetime strings.',
            details: parsedSchedulesError,
          },
          400
        );
      }
      updatePayload.event_schedules = parsedSchedules.value;
    }
    if (requestSpecifiesCategory(body, eventBody)) {
      updatePayload.category = normalizeEventCategoryFromRequest(body, eventBody);
    }

    // 1️⃣ Try events table first
    const { data: eventsRow, error: eventsError } = await supabase
      .from('events_ee0c365c')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();
    
    if (!eventsError && eventsRow) {
      if (
        body.image !== undefined &&
        previousEventImage &&
        !sameOwnedStorageObject(previousEventImage, body.image, [VENUE_IMAGES_BUCKET])
      ) {
        await bestEffortDeleteOwnedStorageObject(
          supabase,
          previousEventImage,
          [VENUE_IMAGES_BUCKET],
          "replace-event-image"
        );
      }
      console.log(`✅ Updated event in events table: ${eventsRow.id}`);
      return c.json({ event: normalizeEventResponseRow(eventsRow as Record<string, unknown>) });
    }

    // 2️⃣ Fallback: event might be stuck in venues table (legacy bug)
    console.log(`⚠�� Event ${id} not found in events table, checking venues table (legacy fallback)...`);
    
    const { data: venueCheck } = await supabase
      .from('venues_ee0c365c')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (venueCheck) {
      console.log(`🔄 Found legacy event "${venueCheck.title}" in venues table — migrating to events table...`);
      
      // Build clean event object for events table (no venue-only columns)
      const migratedEvent: Record<string, any> = {
        id: venueCheck.id,
        page_slug: updatePayload.page_slug ?? venueCheck.page_slug ?? null,
        title: updatePayload.title ?? venueCheck.title,
        title_en: updatePayload.title_en ?? venueCheck.title_en,
        description: updatePayload.description ?? venueCheck.description,
        description_en: updatePayload.description_en ?? venueCheck.description_en,
        event_type: updatePayload.event_type || venueCheck.event_type || 'other',
        city: updatePayload.city ?? venueCheck.city,
        venue_name: updatePayload.venue_name ?? venueCheck.venue_name,
        address: updatePayload.address ?? venueCheck.address,
        image: updatePayload.image ?? venueCheck.image,
        price: updatePayload.price ?? venueCheck.price,
        date: updatePayload.date ?? venueCheck.date ?? null,
        map_url: updatePayload.map_url ?? venueCheck.map_url ?? null,
        start_at: updatePayload.start_at || venueCheck.start_at,
        end_at: updatePayload.end_at || venueCheck.end_at,
        event_schedules:
          eventBody.event_schedules !== undefined
            ? updatePayload.event_schedules
            : (venueCheck as { event_schedules?: unknown }).event_schedules ?? null,
        ticket_link: updatePayload.ticket_link ?? venueCheck.ticket_link,
        organizer_name: updatePayload.organizer_name ?? venueCheck.organizer_name,
        organizer_phone: updatePayload.organizer_phone ?? venueCheck.organizer_phone,
        organizer_email: updatePayload.organizer_email ?? venueCheck.organizer_email,
        category: requestSpecifiesCategory(body, eventBody)
          ? normalizeEventCategoryFromRequest(body, eventBody)
          : null,
        status: venueCheck.status || 'approved',
        submitted_by:
          resolvedEventSubmittedBy !== undefined ? resolvedEventSubmittedBy : venueCheck.submitted_by,
        submitted_by_user_id:
          resolvedEventSubmittedByUserId !== undefined
            ? resolvedEventSubmittedByUserId
            : (venueCheck as { submitted_by_user_id?: string | null }).submitted_by_user_id ?? null,
        submitted_by_name:
          resolvedEventSubmittedByName !== undefined
            ? resolvedEventSubmittedByName
            : (venueCheck as { submitted_by_name?: string | null }).submitted_by_name ?? null,
        source: venueCheck.source,
        created_at: venueCheck.created_at,
        updated_at: new Date().toISOString(),
      };
      
      // Insert into events table
      const { data: insertedEvent, error: insertError } = await supabase
        .from('events_ee0c365c')
        .insert(migratedEvent)
        .select()
        .single();
      
      if (insertError) {
        console.error('❌ Failed to migrate event to events table:', insertError);
        return c.json({ error: 'Failed to migrate legacy event', details: insertError.message }, 500);
      }
      
      // Delete from venues table
      const { error: deleteError } = await supabase
        .from('venues_ee0c365c')
        .delete()
        .eq('id', id);
      
      if (deleteError) {
        console.warn('⚠️ Event migrated but failed to delete from venues:', deleteError.message);
      }
      
      console.log(`✅ Successfully migrated event "${insertedEvent.title}" from venues → events table`);
      if (
        body.image !== undefined &&
        (venueCheck as Record<string, unknown>).image &&
        !sameOwnedStorageObject((venueCheck as Record<string, unknown>).image, body.image, [VENUE_IMAGES_BUCKET])
      ) {
        await bestEffortDeleteOwnedStorageObject(
          supabase,
          (venueCheck as Record<string, unknown>).image,
          [VENUE_IMAGES_BUCKET],
          "replace-legacy-event-image"
        );
      }
      return c.json({ event: normalizeEventResponseRow(insertedEvent as Record<string, unknown>), migrated: true });
    }
    
    // 3️⃣ Not found anywhere
    console.error(`❌ Event ${id} not found in events or venues table`);
    return c.json({ error: 'Event not found', details: `No event with id ${id} in events or venues table` }, 404);
  } catch (error) {
    console.error('❌ Error updating event:', error);
    return c.json({ error: 'Failed to update event', details: String(error) }, 500);
  }
});

// Delete event by ID (owner or admin)
app.delete("/make-server-a0e1e9cb/events/:id", async (c) => {
  try {
    const id = c.req.param('id');
    console.log('🗑️ [DELETE /events/:id] Hit route', { id });
    if (!id) {
      return c.json({ error: 'Event ID is required' }, 400);
    }

    const accessToken = getTokenFromRequest(c);
    if (!accessToken) {
      return c.json({ error: 'Unauthorized - please log in' }, 401);
    }

    const { data: { user }, error: authError } = await safeGetUser(null, accessToken);
    if (authError || !user || !user.email) {
      console.error('🗑️ [DELETE /events/:id] Auth failed', { id, authError: authError?.message });
      return c.json({ error: 'Unauthorized - invalid token' }, 401);
    }

    const normalize = (value: unknown): string => String(value ?? '').trim().toLowerCase();
    const userEmail = normalize(user.email);
    const supabase = sbService();
    const isAdmin = await profileHasAdminAccess(supabase, user.id);
    console.log('🗑️ [DELETE /events/:id] Resolved user', { id, userEmail, isAdmin });

    // Primary source: events table
    const { data: event, error: eventFetchError } = await supabase
      .from('events_ee0c365c')
      .select('id, submitted_by_user_id, submitted_by, organizer_email, image')
      .eq('id', id)
      .maybeSingle();

    if (eventFetchError) {
      console.error('🗑️ [DELETE /events/:id] Failed to fetch event', { id, error: eventFetchError.message });
      return c.json({ error: 'Failed to fetch event', details: eventFetchError.message }, 500);
    }

    if (event) {
      const isOwner =
        normalize((event as Record<string, unknown>).submitted_by_user_id) === normalize(user.id) ||
        normalize(event.submitted_by) === userEmail ||
        normalize(event.organizer_email) === userEmail;
      console.log('🗑️ [DELETE /events/:id] Ownership check (events table)', {
        id,
        submitted_by: normalize(event.submitted_by),
        organizer_email: normalize(event.organizer_email),
        userEmail,
        isOwner,
        isAdmin,
      });
      if (!isAdmin && !isOwner) {
        console.warn('🗑️ [DELETE /events/:id] Authorization denied (events table)', { id, userEmail });
        return c.json({ error: 'Forbidden - not your event' }, 403);
      }

      const { data: deletedEvents, error: deleteError } = await supabase
        .from('events_ee0c365c')
        .delete()
        .eq('id', id)
        .select('id');

      if (deleteError) {
        console.error('🗑️ [DELETE /events/:id] Delete failed (events table)', { id, error: deleteError.message });
        return c.json({ error: 'Failed to delete event', details: deleteError.message }, 500);
      }
      console.log('🗑️ [DELETE /events/:id] Delete result (events table)', { id, deletedCount: deletedEvents?.length || 0 });
      if (!deletedEvents || deletedEvents.length === 0) {
        return c.json({ error: 'Event not found' }, 404);
      }

      await bestEffortDeleteOwnedStorageObject(
        supabase,
        (event as Record<string, unknown>).image,
        [VENUE_IMAGES_BUCKET],
        "delete-event-image"
      );

      return c.json({ success: true, deleted_id: id, entity: 'event' });
    }

    // Legacy fallback: some events were historically stored in venues table
    const { data: legacyEvent, error: legacyFetchError } = await supabase
      .from('venues_ee0c365c')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (legacyFetchError) {
      console.error('🗑️ [DELETE /events/:id] Failed to fetch legacy event', { id, error: legacyFetchError.message });
      return c.json({ error: 'Failed to fetch legacy event', details: legacyFetchError.message }, 500);
    }
    if (!legacyEvent) {
      return c.json({ error: 'Event not found' }, 404);
    }

    const isLegacyOwner =
      normalize((legacyEvent as Record<string, unknown>).submitted_by_user_id) === normalize(user.id) ||
      normalize(legacyEvent.submitted_by) === userEmail ||
      normalize(legacyEvent.contact_email) === userEmail ||
      normalize((legacyEvent as any).organizer_email) === userEmail;
    console.log('🗑️ [DELETE /events/:id] Ownership check (legacy table)', {
      id,
      submitted_by: normalize(legacyEvent.submitted_by),
      contact_email: normalize(legacyEvent.contact_email),
      organizer_email: normalize((legacyEvent as any).organizer_email),
      userEmail,
      isLegacyOwner,
      isAdmin,
    });
    if (!isAdmin && !isLegacyOwner) {
      console.warn('🗑️ [DELETE /events/:id] Authorization denied (legacy table)', { id, userEmail });
      return c.json({ error: 'Forbidden - not your event' }, 403);
    }

    const { data: deletedLegacyRows, error: deleteLegacyError } = await supabase
      .from('venues_ee0c365c')
      .delete()
      .eq('id', id)
      .select('id');

    if (deleteLegacyError) {
      console.error('🗑️ [DELETE /events/:id] Delete failed (legacy table)', { id, error: deleteLegacyError.message });
      return c.json({ error: 'Failed to delete legacy event', details: deleteLegacyError.message }, 500);
    }
    console.log('🗑️ [DELETE /events/:id] Delete result (legacy table)', { id, deletedCount: deletedLegacyRows?.length || 0 });
    if (!deletedLegacyRows || deletedLegacyRows.length === 0) {
      return c.json({ error: 'Event not found' }, 404);
    }

    await bestEffortDeleteOwnedStorageObject(
      supabase,
      (legacyEvent as Record<string, unknown>).image,
      [VENUE_IMAGES_BUCKET],
      "delete-legacy-event-image"
    );

    return c.json({ success: true, deleted_id: id, entity: 'event', legacy_venue: true });
  } catch (error) {
    console.error('❌ Error deleting event:', error);
    return c.json({ error: 'Failed to delete event', details: String(error) }, 500);
  }
});

// ===================================
// VENUES ENDPOINTS (Restaurants, Clubs, Cafes, etc.)
// ===================================

// Get user's own venues (authenticated)
app.get("/make-server-a0e1e9cb/my-venues", async (c) => {
  try {
    const accessToken = getTokenFromRequest(c);
    
    console.log('[MY-VENUES] Request received');
    
    if (!accessToken) {
      console.error('[MY-VENUES] No access token provided');
      return c.json({ error: 'Unauthorized - please log in' }, 401);
    }
    
    // Session via safeGetUser → GoTrue /auth/v1/user
    const { data: { user }, error: authError } = await safeGetUser(null, accessToken);
    
    console.log('🔍 [MY-VENUES] Auth result:', { user: user?.email, error: authError?.message });
    
    if (authError || !user || !user.email) {
      console.error('❌ [MY-VENUES] Auth failed:', authError);
      return c.json({ error: 'Unauthorized - invalid token' }, 401);
    }
    
    // Use service role for DB queries
    const supabase = sbService();
    const userEmail = user.email;
    const userId = user.id;
    console.log(`🔍 [MY-VENUES] Fetching venues for user: "${userEmail}" (${userId})`);
    console.log(`🔍 [MY-VENUES] User email length: ${userEmail.length}`);
    console.log(`🔍 [MY-VENUES] User email bytes: ${JSON.stringify([...userEmail].map(c => c.charCodeAt(0)))}`);
    
    // Get ALL venues submitted by this user (any status)
    const { data: venues, error, count } = await supabase
      .from('venues_ee0c365c')
      .select('*', { count: 'exact' })
      .or(`submitted_by_user_id.eq.${userId},submitted_by.eq.${userEmail}`)
      .order('created_at', { ascending: false });
    
    console.log(`🔍 [MY-VENUES] Query executed`);
    console.log(`🔍 [MY-VENUES] Error:`, error);
    console.log(`🔍 [MY-VENUES] Count:`, count);
    console.log(`🔍 [MY-VENUES] Venues length:`, venues?.length);
    console.log(`🔍 [MY-VENUES] First 3 venues:`, JSON.stringify(venues?.slice(0, 3), null, 2));
    
    if (error) {
      console.error('❌ [MY-VENUES] Database error fetching user venues:', error);
      return c.json({ error: 'Failed to fetch venues', details: error.message }, 500);
    }
    
    console.log(`✅ [MY-VENUES] Found ${venues?.length || 0} venues for ${userEmail}`);
    return c.json({ venues: venues || [] });
  } catch (error) {
    console.error('❌ [MY-VENUES] Error fetching user venues:', error);
    return c.json({ error: 'Failed to fetch venues', details: String(error) }, 500);
  }
});

// Get venues with filtering
app.get("/make-server-a0e1e9cb/venues", async (c) => {
  try {
    const status = c.req.query('status'); // pending, approved, rejected
    const page_slug = c.req.query('page_slug'); // food-and-drink, clubs, cafes
    const city = c.req.query('city');
    const cuisine = c.req.query('cuisine');
    
    const supabase = getSupabaseClient();
    
    // Build base query - use venues table
    let query = supabase
      .from('venues_ee0c365c')
      .select('*');
    
    // Filter by status (default: only approved)
    if (status) {
      query = query.eq('status', status);
    } else {
      query = query.eq('status', 'approved');
    }
    
    // Filter by page_slug (backward compat: accept both 'food-and-drink' and old 'restaurants')
    if (page_slug) {
      if (page_slug === 'food-and-drink') {
        // Match both new 'food-and-drink' and legacy 'restaurants' slugs
        query = query.in('page_slug', ['food-and-drink', 'restaurants']);
      } else {
        query = query.eq('page_slug', page_slug);
      }
    }
    
    // Filter by city
    if (city) {
      query = query.eq('city', city);
    }
    
    // Filter by cuisine (for restaurants)
    if (cuisine) {
      query = query.eq('cuisine', cuisine);
    }
    
    // Sort by created_at descending (newest first)
    query = query.order('created_at', { ascending: false });
    
    const { data: venues, error } = await query;
    
    if (error) {
      console.error('❌ Database error fetching venues:', error);
      return c.json({ error: 'Failed to fetch venues', details: error.message }, 500);
    }
    
    // Filter out inactive venues for public requests (when no explicit status filter = public)
    let filteredVenues = venues || [];
    if (!status || status === 'approved') {
      const inactiveIds = await loadInactiveIds();
      if (inactiveIds.length > 0) {
        const inactiveSet = new Set(inactiveIds);
        filteredVenues = filteredVenues.filter((v: any) => !inactiveSet.has(v.id));
        console.log(`🔴 Filtered out ${(venues?.length || 0) - filteredVenues.length} inactive venues`);
      }
    }
    
    console.log(`✅ Fetched ${filteredVenues.length} venues (page_slug: ${page_slug || 'all'})`);
    return c.json({ venues: filteredVenues });
  } catch (error) {
    console.error('❌ Error fetching venues:', error);
    return c.json({ error: 'Failed to fetch venues', details: String(error) }, 500);
  }
});

// Get single venue by ID
app.get("/make-server-a0e1e9cb/venues/:id", async (c) => {
  try {
    const id = c.req.param('id');
    
    if (!id) {
      return c.json({ error: 'Venue ID is required' }, 400);
    }
    
    const supabase = getSupabaseClient();
    
    // 🔥 First, try to fetch the venue without status filter
    const { data: venue, error } = await supabase
      .from('venues_ee0c365c')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (error) {
      console.error('❌ Database error fetching venue:', error);
      return c.json({ error: 'Database error', details: error.message }, 500);
    }
    
    if (!venue) {
      console.log(`⚠️ Venue not found: ${id}`);
      return c.json({ error: 'Venue not found' }, 404);
    }
    
    // ✅ If venue is approved, return it (public access)
    if (venue.status === 'approved') {
      return c.json({ venue });
    }
    
    // If venue is NOT approved, check if user is the owner
    const accessToken = getTokenFromRequest(c);
    
    // Only try to validate if we have a token
    if (accessToken) {
      try {
        // Session via safeGetUser → GoTrue /auth/v1/user
        const { data: { user }, error: authError } = await safeGetUser(null, accessToken);
        
        if (!authError && user) {
          const userEmail = user.email;
          const isPrivileged = await profileHasAdminAccess(supabase, user.id);
          
          // 🔥 ADMIN / MASTER_ADMIN can access ALL venues
          if (isPrivileged) {
            console.log('✅ Privileged user (profiles.role) - granting access to all venues');
            return c.json({ venue });
          }
          
          // Check if user owns this venue
          if (
            normalize((venue as Record<string, unknown>).submitted_by_user_id) === normalize(user.id) ||
            venue.submitted_by === userEmail ||
            venue.contact_email === userEmail
          ) {
            console.log(`✅ User ${userEmail} has access to their own venue (status: ${venue.status})`);
            return c.json({ venue });
          }
        } else if (authError) {
          console.error('❌ JWT validation failed:', authError?.message);
        }
      } catch (authError) {
        console.error('❌ Auth check failed:', authError);
      }
    }
    
    // ❌ User is not authorized to view this non-approved venue
    console.log(`⚠️ Unauthorized access to venue ${id} (status: ${venue.status})`);
    return c.json({ error: 'Venue not found' }, 404);
  } catch (error) {
    console.error('❌ Error fetching venue by ID:', error);
    return c.json({ error: 'Failed to fetch venue', details: String(error) }, 500);
  }
});

// Update venue by ID
app.put("/make-server-a0e1e9cb/venues/:id", async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    
    if (!id) {
      return c.json({ error: 'Venue ID is required' }, 400);
    }
    
    const supabase = getSupabaseClient();
    const { data: existingVenueRow } = await supabase
      .from('venues_ee0c365c')
      .select('id, image')
      .eq('id', id)
      .maybeSingle();
    const previousVenueImage = (existingVenueRow as { image?: string | null } | null)?.image ?? null;
    
    // ✅ FIXED: Use ?? instead of || so empty strings "" are preserved (not treated as falsy)
    // || treats "" as falsy → field update skipped → old value stays in DB forever
    // ?? treats "" as defined → saves empty string → field is properly cleared
    const contactEmail = body.contact_email ?? null;
    
    // ✅ FIXED: Auto-assign submitted_by when admin selects a registered user
    // ✅ snake_case only
    const assignUserId = typeof body.assign_user_id === 'string' ? body.assign_user_id.trim() : '';
    let submittedByUpdate: Record<string, unknown> = {};
    if (assignUserId) {
      const { data: uidData, error: uidErr } = await supabase.auth.admin.getUserById(assignUserId);
      if (uidErr || !uidData?.user?.id || !uidData.user.email) {
        return c.json({ error: 'Invalid assign_user_id.' }, 400);
      }
      submittedByUpdate = {
        submitted_by_user_id: uidData.user.id,
        submitted_by: uidData.user.email.trim(),
        submitted_by_name: extractDisplayNameFromAuthUser(uidData.user),
      };
      console.log(`🔗 Auto-assigning venue to user: ${uidData.user.email} (userId: ${assignUserId})`);
    } else if (body.submitted_by !== undefined) {
      const rawSb = String(body.submitted_by ?? '').trim();
      if (rawSb) {
        const resolvedSb = await resolveRegisteredSubmitterEmail(supabase, rawSb);
        if (resolvedSb) {
          submittedByUpdate = { submitted_by: resolvedSb };
          console.log(`🔗 Updating submitted_by to: ${resolvedSb}`);
        }
      }
    }

    const tagsUpdate =
      body.tags !== undefined ? { tags: normalizeVenueTagsInput(body.tags) } : {};
    const derivedVenuePageSlugForVenueUpdate = deriveVenuePageSlugFromVenueType(body.venue_type);
    if (body.venue_type !== undefined && !derivedVenuePageSlugForVenueUpdate) {
      return c.json({ error: `Invalid venue_type: ${String(body.venue_type)}` }, 400);
    }

    // ✅ snake_case only — ?? (nullish coalescing) preserves empty strings
    const { data: venue, error } = await supabase
      .from('venues_ee0c365c')
      .update({
        title: body.title,
        title_en: body.title_en,
        description: body.description,
        description_en: body.description_en,
        page_slug: derivedVenuePageSlugForVenueUpdate || body.page_slug,
        venue_type: body.venue_type ?? null,
        cuisine: body.cuisine,
        cuisine_en: body.cuisine_en,
        city: body.city,
        address: body.address,
        phone: body.phone,
        website: body.website,
        image: body.image,
        price: body.price,
        opening_hours: body.opening_hours,
        opening_hours_en: body.opening_hours_en,
        contact_name: body.contact_name,
        contact_phone: body.contact_phone,
        contact_email: contactEmail,
        ...tagsUpdate,
        ...submittedByUpdate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Database error updating venue:', error);
      return c.json({ error: 'Failed to update venue', details: String(error) }, 500);
    }
    
    if (
      body.image !== undefined &&
      previousVenueImage &&
      !sameOwnedStorageObject(previousVenueImage, body.image, [VENUE_IMAGES_BUCKET])
    ) {
      await bestEffortDeleteOwnedStorageObject(
        supabase,
        previousVenueImage,
        [VENUE_IMAGES_BUCKET],
        "replace-venue-image"
      );
    }

    console.log(`✅ Updated venue: ${venue.title}${submittedByUpdate.submitted_by ? ` (assigned to ${submittedByUpdate.submitted_by})` : ''}`);
    return c.json({ venue });
  } catch (error) {
    console.error('❌ Error updating venue:', error);
    return c.json({ error: 'Failed to update venue', details: String(error) }, 500);
  }
});

// Delete venue by ID (owner or admin)
app.delete("/make-server-a0e1e9cb/venues/:id", async (c) => {
  try {
    const id = c.req.param('id');
    console.log('🗑️ [DELETE /venues/:id] Hit route', { id });
    if (!id) {
      return c.json({ error: 'Venue ID is required' }, 400);
    }

    const accessToken = getTokenFromRequest(c);
    if (!accessToken) {
      return c.json({ error: 'Unauthorized - please log in' }, 401);
    }

    const { data: { user }, error: authError } = await safeGetUser(null, accessToken);
    if (authError || !user || !user.email) {
      console.error('🗑️ [DELETE /venues/:id] Auth failed', { id, authError: authError?.message });
      return c.json({ error: 'Unauthorized - invalid token' }, 401);
    }

    const normalize = (value: unknown): string => String(value ?? '').trim().toLowerCase();
    const userEmail = normalize(user.email);
    const supabase = sbService();
    const isAdmin = await profileHasAdminAccess(supabase, user.id);
    console.log('🗑️ [DELETE /venues/:id] Resolved user', { id, userEmail, isAdmin });

    const { data: venue, error: fetchError } = await supabase
      .from('venues_ee0c365c')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('🗑️ [DELETE /venues/:id] Failed to fetch venue', { id, error: fetchError.message });
      return c.json({ error: 'Failed to fetch venue', details: fetchError.message }, 500);
    }
    if (!venue) {
      return c.json({ error: 'Venue not found' }, 404);
    }

    const isOwner =
      normalize((venue as Record<string, unknown>).submitted_by_user_id) === normalize(user.id) ||
      normalize(venue.submitted_by) === userEmail ||
      normalize(venue.contact_email) === userEmail ||
      normalize((venue as any).organizer_email) === userEmail;
    console.log('🗑️ [DELETE /venues/:id] Ownership check', {
      id,
      submitted_by: normalize(venue.submitted_by),
      contact_email: normalize(venue.contact_email),
      organizer_email: normalize((venue as any).organizer_email),
      userEmail,
      isOwner,
      isAdmin,
    });
    if (!isAdmin && !isOwner) {
      console.warn('🗑️ [DELETE /venues/:id] Authorization denied', { id, userEmail });
      return c.json({ error: 'Forbidden - not your venue' }, 403);
    }

    const { data: deletedVenues, error: deleteError } = await supabase
      .from('venues_ee0c365c')
      .delete()
      .eq('id', id)
      .select('id');

    if (deleteError) {
      console.error('🗑️ [DELETE /venues/:id] Delete failed', { id, error: deleteError.message });
      return c.json({ error: 'Failed to delete venue', details: deleteError.message }, 500);
    }
    console.log('🗑️ [DELETE /venues/:id] Delete result', { id, deletedCount: deletedVenues?.length || 0 });
    if (!deletedVenues || deletedVenues.length === 0) {
      return c.json({ error: 'Venue not found' }, 404);
    }

    await bestEffortDeleteOwnedStorageObject(
      supabase,
      (venue as Record<string, unknown>).image,
      [VENUE_IMAGES_BUCKET],
      "delete-venue-image"
    );

    return c.json({ success: true, deleted_id: id, entity: 'venue' });
  } catch (error) {
    console.error('❌ Error deleting venue:', error);
    return c.json({ error: 'Failed to delete venue', details: String(error) }, 500);
  }
});

// =============================================
// FEATURED VENUES (stored in kv_store - migrated from venues table due to CHECK constraint)
// =============================================

// In-memory featured IDs cache (persisted to kv_store)
let featuredVenueIdsCache: string[] | null = null;

// KV keys for config storage (migrated from venues table due to CHECK constraint on category)
const KV_FEATURED_KEY = 'blguide:featured_venue_ids';

// Helper: Load featured IDs from kv_store
async function loadFeaturedIds(): Promise<string[]> {
  if (featuredVenueIdsCache !== null) return featuredVenueIdsCache;
  
  try {
    const data = await kv.get(KV_FEATURED_KEY);
    
    if (!data) {
      console.log('⭐ No featured config found in kv_store, starting empty');
      featuredVenueIdsCache = [];
      return [];
    }
    
    const ids = Array.isArray(data) ? data : [];
    featuredVenueIdsCache = ids;
    console.log(`⭐ Loaded ${featuredVenueIdsCache.length} featured IDs from kv_store`);
    return featuredVenueIdsCache;
  } catch (error) {
    console.error('❌ Error loading featured IDs from kv_store:', error);
    featuredVenueIdsCache = [];
    return [];
  }
}

// Helper: Save featured IDs to kv_store
async function saveFeaturedIds(ids: string[]): Promise<void> {
  try {
    await kv.set(KV_FEATURED_KEY, ids);
    featuredVenueIdsCache = ids;
    console.log(`⭐ Saved ${ids.length} featured IDs to kv_store`);
  } catch (error) {
    console.error('❌ Error saving featured IDs to kv_store:', error);
    throw new Error(`saveFeaturedIds failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// GET featured venue IDs (public)
app.get("/make-server-a0e1e9cb/featured-venues", async (c) => {
  try {
    const ids = await loadFeaturedIds();
    return c.json({ ids });
  } catch (error) {
    console.error('❌ Error getting featured venues:', error);
    return c.json({ ids: [] });
  }
});

// GET featured venues with full data (public)
app.get("/make-server-a0e1e9cb/featured-venues/full", async (c) => {
  try {
    const ids = await loadFeaturedIds();
    if (ids.length === 0) {
      return c.json({ venues: [] });
    }
    
    const supabase = getSupabaseClient();
    const { data: venues, error } = await supabase
      .from('venues_ee0c365c')
      .select('*')
      .in('id', ids)
      .eq('status', 'approved');
    
    if (error) {
      console.error('❌ Error fetching featured venue data:', error);
      return c.json({ venues: [] });
    }
    
    // Filter out inactive venues from featured
    let filteredVenues = venues || [];
    const inactiveIds = await loadInactiveIds();
    if (inactiveIds.length > 0) {
      const inactiveSet = new Set(inactiveIds);
      filteredVenues = filteredVenues.filter((v: any) => !inactiveSet.has(v.id));
    }
    
    console.log(`✅ Fetched ${filteredVenues.length} featured venues`);
    return c.json({ venues: filteredVenues });
  } catch (error) {
    console.error('❌ Error getting featured venues full:', error);
    return c.json({ venues: [] });
  }
});

// PATCH toggle featured status (admin only)
app.patch("/make-server-a0e1e9cb/venues/:id/toggle-featured", requireAdmin, async (c) => {
  try {
    const id = c.req.param('id');
    if (!id) {
      return c.json({ error: 'Venue ID is required' }, 400);
    }
    
    let ids = [...(await loadFeaturedIds())];
    
    const index = ids.indexOf(id);
    let is_featured: boolean;
    
    if (index > -1) {
      ids.splice(index, 1);
      is_featured = false;
      console.log(`⭐ Removed venue ${id} from featured. Total: ${ids.length}`);
    } else {
      if (ids.length >= 8) {
        return c.json({ error: 'Maximum 8 featured venues allowed', max_reached: true }, 400);
      }
      ids.push(id);
      is_featured = true;
      console.log(`⭐ Added venue ${id} to featured. Total: ${ids.length}`);
    }
    
    await saveFeaturedIds(ids);
    
    return c.json({ is_featured, featured_count: ids.length, ids });
  } catch (error) {
    console.error('❌ Error toggling featured:', error);
    return c.json({ error: 'Failed to toggle featured status', details: error instanceof Error ? error.message : JSON.stringify(error) }, 500);
  }
});

// =============================================
// INACTIVE VENUES (stored via config row, same pattern as featured)
// =============================================

// In-memory inactive IDs cache
let inactiveVenueIdsCache: string[] | null = null;

const KV_INACTIVE_VENUES_KEY = 'blguide:inactive_venue_ids';

// Helper: Load inactive IDs from kv_store
async function loadInactiveIds(): Promise<string[]> {
  if (inactiveVenueIdsCache !== null) return inactiveVenueIdsCache;
  
  try {
    const data = await kv.get(KV_INACTIVE_VENUES_KEY);
    
    if (!data) {
      console.log('🔴 No inactive config found in kv_store, starting empty');
      inactiveVenueIdsCache = [];
      return [];
    }
    
    const ids = Array.isArray(data) ? data : [];
    inactiveVenueIdsCache = ids;
    console.log(`🔴 Loaded ${inactiveVenueIdsCache.length} inactive venue IDs from kv_store`);
    return inactiveVenueIdsCache;
  } catch (error) {
    console.error('❌ Error loading inactive IDs from kv_store:', error);
    inactiveVenueIdsCache = [];
    return [];
  }
}

// Helper: Save inactive IDs to kv_store
async function saveInactiveIds(ids: string[]): Promise<void> {
  try {
    await kv.set(KV_INACTIVE_VENUES_KEY, ids);
    inactiveVenueIdsCache = ids;
    console.log(`🔴 Saved ${ids.length} inactive venue IDs to kv_store`);
  } catch (error) {
    console.error('❌ Error saving inactive IDs to kv_store:', error);
    throw new Error(`saveInactiveIds failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// GET inactive venue IDs (public)
app.get("/make-server-a0e1e9cb/inactive-venues", async (c) => {
  try {
    const ids = await loadInactiveIds();
    return c.json({ ids });
  } catch (error) {
    console.error('❌ Error getting inactive venues:', error);
    return c.json({ ids: [] });
  }
});

// =============================================
// INACTIVE EVENTS (stored via config row, same pattern)
// =============================================

let inactiveEventIdsCache: string[] | null = null;

const KV_INACTIVE_EVENTS_KEY = 'blguide:inactive_event_ids';

async function loadInactiveEventIds(): Promise<string[]> {
  if (inactiveEventIdsCache !== null) return inactiveEventIdsCache;
  
  try {
    const data = await kv.get(KV_INACTIVE_EVENTS_KEY);
    
    if (!data) {
      console.log('🔴 No inactive events config found in kv_store, starting empty');
      inactiveEventIdsCache = [];
      return [];
    }
    
    const ids = Array.isArray(data) ? data : [];
    inactiveEventIdsCache = ids;
    console.log(`🔴 Loaded ${inactiveEventIdsCache.length} inactive event IDs from kv_store`);
    return inactiveEventIdsCache;
  } catch (error) {
    console.error('❌ Error loading inactive event IDs from kv_store:', error);
    inactiveEventIdsCache = [];
    return [];
  }
}

async function saveInactiveEventIds(ids: string[]): Promise<void> {
  try {
    await kv.set(KV_INACTIVE_EVENTS_KEY, ids);
    inactiveEventIdsCache = ids;
    console.log(`🔴 Saved ${ids.length} inactive event IDs to kv_store`);
  } catch (error) {
    console.error('❌ Error saving inactive event IDs to kv_store:', error);
    throw new Error(`saveInactiveEventIds failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// GET inactive event IDs (public)
app.get("/make-server-a0e1e9cb/inactive-events", async (c) => {
  try {
    const ids = await loadInactiveEventIds();
    return c.json({ ids });
  } catch (error) {
    console.error('❌ Error getting inactive events:', error);
    return c.json({ ids: [] });
  }
});

/**
 * Toggle venue active/inactive (kv_store). Admin OR venue owner (submitted_by / contact_email).
 * Shared by `/venues/:id/toggle-active` and `/my-venues/:id/toggle-active` so production
 * deployments that only register the former still allow normal users (see gateway 404 on my-*).
 */
async function handleToggleVenueActiveRequest(c: any): Promise<Response> {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'Venue ID is required' }, 400);

  const accessToken = getTokenFromRequest(c);
  if (!accessToken) return c.json({ error: 'Unauthorized - please log in' }, 401);

  const { data: { user }, error: authError } = await safeGetUser(null, accessToken);
  if (authError || !user?.email) return c.json({ error: 'Unauthorized - invalid token' }, 401);

  const supabase = sbService();
  const userEmail = user.email;
  const normalize = (value: unknown): string => String(value ?? '').trim().toLowerCase();
  const isAdmin = await profileHasAdminAccess(supabase, user.id);

  const { data: venue, error: venueError } = await supabase
    .from('venues_ee0c365c')
    .select('id, submitted_by_user_id, submitted_by, contact_email')
    .eq('id', id)
    .maybeSingle();

  if (venueError) return c.json({ error: 'Failed to load venue', details: venueError.message }, 500);
  if (!venue) return c.json({ error: 'Venue not found' }, 404);

  const ownsVenue =
    normalize((venue as Record<string, unknown>).submitted_by_user_id) === normalize(user.id) ||
    venue.submitted_by === userEmail ||
    venue.contact_email === userEmail;
  if (!ownsVenue && !isAdmin) return c.json({ error: 'Forbidden - not your venue' }, 403);

  let ids = [...(await loadInactiveIds())];
  const index = ids.indexOf(id);
  let is_active: boolean;
  if (index > -1) {
    ids.splice(index, 1);
    is_active = true;
    console.log(`🟢 Venue ${id} set to ACTIVE. Total inactive: ${ids.length}`);
  } else {
    ids.push(id);
    is_active = false;
    console.log(`🔴 Venue ${id} set to INACTIVE. Total inactive: ${ids.length}`);
  }

  await saveInactiveIds(ids);
  return c.json({ is_active, inactive_count: ids.length, ids });
}

/**
 * Toggle event active/inactive (kv_store). Admin OR event owner (events table or legacy venues row).
 */
async function handleToggleEventActiveRequest(c: any): Promise<Response> {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'Event ID is required' }, 400);

  const accessToken = getTokenFromRequest(c);
  if (!accessToken) return c.json({ error: 'Unauthorized - please log in' }, 401);

  const { data: { user }, error: authError } = await safeGetUser(null, accessToken);
  if (authError || !user?.email) return c.json({ error: 'Unauthorized - invalid token' }, 401);

  const supabase = sbService();
  const userEmail = user.email;
  const normalize = (value: unknown): string => String(value ?? '').trim().toLowerCase();
  const isAdmin = await profileHasAdminAccess(supabase, user.id);

  const { data: eventRow, error: eventError } = await supabase
    .from('events_ee0c365c')
    .select('id, submitted_by_user_id, submitted_by, organizer_email')
    .eq('id', id)
    .maybeSingle();

  if (eventError) return c.json({ error: 'Failed to load event', details: eventError.message }, 500);

  let submittedByUserId: string | null = null;
  let submittedBy: string | null = null;
  let organizerEmail: string | null = null;

  if (eventRow) {
    submittedByUserId = (eventRow as Record<string, unknown>).submitted_by_user_id as string | null ?? null;
    submittedBy = eventRow.submitted_by ?? null;
    organizerEmail = eventRow.organizer_email ?? null;
  } else {
    const { data: legacyVenue, error: legacyErr } = await supabase
      .from('venues_ee0c365c')
      .select('id, submitted_by_user_id, submitted_by, organizer_email, contact_email, start_at, event_type')
      .eq('id', id)
      .maybeSingle();
    if (legacyErr) return c.json({ error: 'Failed to load legacy event', details: legacyErr.message }, 500);
    if (!legacyVenue || (!legacyVenue.start_at && !legacyVenue.event_type)) {
      return c.json({ error: 'Event not found' }, 404);
    }
    submittedByUserId = (legacyVenue as Record<string, unknown>).submitted_by_user_id as string | null ?? null;
    submittedBy = legacyVenue.submitted_by ?? null;
    organizerEmail = legacyVenue.organizer_email ?? legacyVenue.contact_email ?? null;
  }

  const ownsEvent =
    normalize(submittedByUserId) === normalize(user.id) ||
    submittedBy === userEmail ||
    organizerEmail === userEmail;
  if (!ownsEvent && !isAdmin) return c.json({ error: 'Forbidden - not your event' }, 403);

  let ids = [...(await loadInactiveEventIds())];
  const index = ids.indexOf(id);
  let is_active: boolean;
  if (index > -1) {
    ids.splice(index, 1);
    is_active = true;
    console.log(`🟢 Event ${id} set to ACTIVE. Total inactive: ${ids.length}`);
  } else {
    ids.push(id);
    is_active = false;
    console.log(`🔴 Event ${id} set to INACTIVE. Total inactive: ${ids.length}`);
  }

  await saveInactiveEventIds(ids);
  return c.json({ is_active, inactive_count: ids.length, ids });
}

app.patch("/make-server-a0e1e9cb/my-events/:id/toggle-active", async (c) => {
  try {
    return await handleToggleEventActiveRequest(c);
  } catch (error) {
    console.error('❌ Error toggling my event active status:', error);
    return c.json({ error: 'Failed to toggle my event active status', details: error instanceof Error ? error.message : JSON.stringify(error) }, 500);
  }
});

app.patch("/make-server-a0e1e9cb/events/:id/toggle-active", async (c) => {
  try {
    return await handleToggleEventActiveRequest(c);
  } catch (error) {
    console.error('❌ Error toggling event active status:', error);
    return c.json({ error: 'Failed to toggle event active status', details: error instanceof Error ? error.message : JSON.stringify(error) }, 500);
  }
});

app.patch("/make-server-a0e1e9cb/my-venues/:id/toggle-active", async (c) => {
  try {
    return await handleToggleVenueActiveRequest(c);
  } catch (error) {
    console.error('❌ Error toggling my venue active status:', error);
    return c.json({ error: 'Failed to toggle my venue active status', details: error instanceof Error ? error.message : JSON.stringify(error) }, 500);
  }
});

app.patch("/make-server-a0e1e9cb/venues/:id/toggle-active", async (c) => {
  try {
    return await handleToggleVenueActiveRequest(c);
  } catch (error) {
    console.error('❌ Error toggling active status:', error);
    return c.json({ error: 'Failed to toggle active status', details: error instanceof Error ? error.message : JSON.stringify(error) }, 500);
  }
});

// =============================================
// ADMIN: Assign submission to user email
// =============================================
app.put("/make-server-a0e1e9cb/admin/assign-submission/:id", requireAdmin, async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { email } = body;
    
    if (!id || !email) {
      return c.json({ error: 'ID and email are required' }, 400);
    }
    
    const supabase = getSupabaseClient();
    
    // Try updating in events table first
    const { data: event, error: eventError } = await supabase
      .from('events_ee0c365c')
      .update({ submitted_by: email, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle();
    
    if (event && !eventError) {
      console.log(`✅ Event ${id} assigned to ${email}`);
      return c.json({ success: true, item: event });
    }
    
    // Try updating in venues table
    const { data: venue, error: venueError } = await supabase
      .from('venues_ee0c365c')
      .update({ submitted_by: email, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle();
    
    if (venue && !venueError) {
      console.log(`✅ Venue ${id} assigned to ${email}`);
      return c.json({ success: true, item: venue });
    }
    
    console.error('❌ Item not found:', id);
    return c.json({ error: 'Item not found' }, 404);
  } catch (error) {
    console.error('❌ Error assigning submission:', error);
    return c.json({ error: 'Failed to assign submission', details: String(error) }, 500);
  }
});

// ===================================
// 🔐 CHANGE PASSWORD
// ===================================
app.post('/make-server-a0e1e9cb/auth/change-password', async (c) => {
  console.log('🔐 POST /auth/change-password');
  try {
    const token = getTokenFromRequest(c);
    console.log('🔐 [change-password] Token:', token ? `len=${token.length}` : 'NULL');
    if (!token) {
      return c.json({ error: 'Unauthorized - no token provided' }, 401);
    }

    const { data: userData, error: userError } = await safeGetUser(null, token);
    console.log('🔐 [change-password] User:', userData?.user?.id || 'NONE', userError?.message || 'ok');
    if (userError || !userData?.user?.id) {
      return c.json({ error: 'Unauthorized - invalid session', details: userError?.message || 'no user' }, 401);
    }

    const body = await c.req.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword) {
      return c.json({ error: 'Current password is required' }, 400);
    }

    if (!newPassword || newPassword.length < 6) {
      return c.json({ error: 'Password must be at least 6 characters' }, 400);
    }

    // Verify current password by attempting sign-in
    const userEmail = userData.user.email;
    console.log('🔐 [change-password] Verifying current password for:', userEmail);
    if (!userEmail) {
      return c.json({ error: 'Unable to verify current password - no email found' }, 400);
    }

    const verifyClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { error: signInError } = await verifyClient.auth.signInWithPassword({
      email: userEmail,
      password: currentPassword,
    });

    if (signInError) {
      console.warn('⚠️ Current password verification failed:', signInError.message, signInError.status);
      return c.json({ error: 'Current password is incorrect', code: 'WRONG_PASSWORD' }, 400);
    }

    console.log('🔐 [change-password] Current password verified ✅, updating...');
    const supabase = sbService();
    const { error } = await supabase.auth.admin.updateUserById(userData.user.id, {
      password: newPassword,
    });

    if (error) {
      console.error('❌ Error changing password:', error);
      return c.json({ error: 'Failed to change password', details: error.message }, 500);
    }

    console.log('✅ Password changed for user:', userData.user.id);
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error in change-password:', error);
    return c.json({ error: 'Failed to change password', details: String(error) }, 500);
  }
});

// ===================================
// 🛡️ CHECK ADMIN COUNT
// ===================================
app.get('/make-server-a0e1e9cb/auth/admin-count', async (c) => {
  console.log('🛡️ GET /auth/admin-count');
  try {
    const token = getTokenFromRequest(c);
    if (!token) {
      return c.json({ error: 'Unauthorized - no token provided' }, 401);
    }

    const { data: userData, error: userError } = await safeGetUser(null, token);
    if (userError || !userData?.user?.id) {
      return c.json({ error: 'Unauthorized - invalid session' }, 401);
    }

    const supabase = sbService();
    if (!(await profileHasAdminAccess(supabase, userData.user.id))) {
      return c.json({ error: 'Forbidden - admin only' }, 403);
    }

    const { count, error: countErr } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .in('role', ['admin', 'master_admin']);

    if (countErr) {
      console.error('❌ [admin-count] Error counting profiles:', countErr);
      return c.json({ error: 'Failed to count admins' }, 500);
    }

    const adminCount = count ?? 0;

    console.log(`🛡️ [admin-count] Privileged profile count (admin+master_admin): ${adminCount}`);
    return c.json({ adminCount });
  } catch (error) {
    console.error('❌ Error in admin-count:', error);
    return c.json({ error: 'Failed to count admins', details: String(error) }, 500);
  }
});

// ===================================
// 🗑️ DELETE ACCOUNT
// ===================================
app.delete('/make-server-a0e1e9cb/auth/delete-account', async (c) => {
  console.log('🗑️ DELETE /auth/delete-account');
  try {
    const token = getTokenFromRequest(c);
    if (!token) {
      return c.json({ error: 'Unauthorized - no token provided' }, 401);
    }

    const { data: userData, error: userError } = await safeGetUser(null, token);
    if (userError || !userData?.user?.id) {
      return c.json({ error: 'Unauthorized - invalid session' }, 401);
    }

    const userId = userData.user.id;
    const supabase = sbService();
    const { data: ownProfileRow } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", userId)
      .maybeSingle();
    const ownProfileImage = (ownProfileRow as { avatar_url?: string | null } | null)?.avatar_url ?? null;

    // 🛡️ ADMIN GUARD: privileged users cannot delete the last admin-capable account (profiles.role)
    const selfRole = await getProfileRoleById(supabase, userId);
    if (selfRole === 'admin' || selfRole === 'master_admin') {
      console.log('🛡️ [delete-account] User has privileged profile role, checking counts...');
      const { count, error: listError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .in('role', ['admin', 'master_admin']);
      if (listError) {
        console.error('❌ [delete-account] Error counting privileged profiles:', listError);
        return c.json({ error: 'Failed to verify admin count', code: 'ADMIN_CHECK_FAILED' }, 500);
      }
      const privilegedCount = count ?? 0;
      console.log(`🛡️ [delete-account] Privileged profile count: ${privilegedCount}`);
      if (privilegedCount <= 1) {
        console.log('🛡️ [delete-account] ❌ BLOCKED: Cannot delete last admin-capable account');
        return c.json({ 
          error: 'Cannot delete the last admin account. Promote another user to admin first.',
          code: 'LAST_ADMIN' 
        }, 403);
      }
    }

    // Get user email to clean up their submissions
    const userEmail = userData.user.email;
    
    // Delete user's venues and events from database
    try {
      if (userEmail) {
        const { data: deletedVenueRows, error: venueDelError } = await supabase
          .from('venues_ee0c365c')
          .delete()
          .eq('submitted_by', userEmail)
          .select('id, image');
        if (venueDelError) {
          console.warn('⚠️ Error deleting user venues:', venueDelError);
        } else {
          for (const row of deletedVenueRows as Array<Record<string, unknown>>) {
            await bestEffortDeleteOwnedStorageObject(
              supabase,
              row.image,
              [VENUE_IMAGES_BUCKET],
              "delete-account-venue-image"
            );
          }
        }

        const { data: deletedEventRows, error: eventDelError } = await supabase
          .from('events_ee0c365c')
          .delete()
          .eq('submitted_by', userEmail)
          .select('id, image');
        if (eventDelError) {
          console.warn('⚠️ Error deleting user events:', eventDelError);
        } else {
          for (const row of (deletedEventRows || []) as Array<Record<string, unknown>>) {
            await bestEffortDeleteOwnedStorageObject(
              supabase,
              row.image,
              [VENUE_IMAGES_BUCKET],
              "delete-account-event-image"
            );
          }
        }
      }
    } catch (cleanupError) {
      console.warn('⚠️ Error cleaning up user data (continuing with account deletion):', cleanupError);
    }

    // Delete the user from Supabase Auth
    const { error } = await supabase.auth.admin.deleteUser(userId);

    if (error) {
      console.error('❌ Error deleting account:', error);
      return c.json({ error: 'Failed to delete account', details: error.message }, 500);
    }

    await bestEffortDeleteOwnedStorageObject(
      supabase,
      ownProfileImage,
      [PROFILE_IMAGES_BUCKET],
      "delete-account-profile-image"
    );

    console.log('✅ Account deleted for user:', userId);
    return c.json({ success: true });
  } catch (error) {
    console.error('❌ Error in delete-account:', error);
    return c.json({ error: 'Failed to delete account', details: String(error) }, 500);
  }
});

// ===================================
// 🏓 HEALTH CHECK / VERSION PING
// ===================================
app.get("/make-server-a0e1e9cb/ping", (c) => {
  const info = {
    status: "ok",
    version: "9.1",
    label: "CATEGORY_KILLED_v9.1 — ping endpoint live check",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(performance.now() / 1000) + "s",
  };
  console.log("🏓 PING:", JSON.stringify(info));
  return c.json(info);
});

// ===================================
// 📊 EVENT INTEREST COUNTER
// ===================================

app.get('/make-server-a0e1e9cb/events/:id/interest', async (c) => {
  try {
    const eventId = c.req.param('id');
    const count = await kv.get(`event_interest:${eventId}`);
    return c.json({ count: count || 0 });
  } catch (error) {
    console.log('❌ [INTEREST] Error getting interest count:', error);
    return c.json({ count: 0 });
  }
});

app.post('/make-server-a0e1e9cb/events/:id/interest', async (c) => {
  try {
    const eventId = c.req.param('id');
    const kvKey = `event_interest:${eventId}`;
    const currentCount = (await kv.get(kvKey)) || 0;
    const newCount = currentCount + 1;
    await kv.set(kvKey, newCount);
    return c.json({ count: newCount });
  } catch (error) {
    console.log('❌ [INTEREST] Error incrementing interest:', error);
    return c.json({ error: 'Failed to update interest', details: String(error) }, 500);
  }
});

// DELETE decrement interest for an event
app.delete('/make-server-a0e1e9cb/events/:id/interest', async (c) => {
  try {
    const eventId = c.req.param('id');
    const kvKey = `event_interest:${eventId}`;
    const currentCount = (await kv.get(kvKey)) || 0;
    const newCount = Math.max(0, currentCount - 1);
    await kv.set(kvKey, newCount);
    return c.json({ count: newCount });
  } catch (error) {
    console.log('❌ [INTEREST] Error decrementing interest:', error);
    return c.json({ error: 'Failed to update interest', details: String(error) }, 500);
  }
});

// POST batch get interest counts for multiple events
app.post('/make-server-a0e1e9cb/events/interest/batch', async (c) => {
  try {
    const body = await c.req.json();
    const eventIds: string[] = body.event_ids || [];
    if (eventIds.length === 0) return c.json({ counts: {} });
    
    const keys = eventIds.map(id => `event_interest:${id}`);
    const values = await kv.mget(keys);
    
    const counts: Record<string, number> = {};
    eventIds.forEach((id, i) => {
      counts[id] = values[i] || 0;
    });
    return c.json({ counts });
  } catch (error) {
    console.log('❌ [INTEREST] Error batch getting interest counts:', error);
    return c.json({ counts: {} });
  }
});

Deno.serve(app.fetch);
