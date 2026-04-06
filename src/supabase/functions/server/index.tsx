import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as kv from "./kv_correct.tsx";

console.log('🚀 Make Server starting... (ylztclwqmfhczklsswrt) - v9.1 CATEGORY_KILLED_v9.1 — ping endpoint live check');

const app = new Hono();

// ===================================
// 🔐 SUPABASE CLIENTS & AUTH HELPERS
// ===================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Master admin email — fully protected, cannot be deleted/blocked/demoted
const MASTER_ADMIN_EMAIL = 'vojo23@yahoo.com';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing Supabase env vars");
}

/**
 * Extract token from Authorization header OR x-auth-token (fallback for Figma env)
 */
/**
 * Check if a token looks like a valid JWT (3 dot-separated base64 segments)
 */
function isJwtFormat(token: string): boolean {
  if (!token || token.length < 20) return false;
  const parts = token.split('.');
  return parts.length === 3 && parts.every(p => p.length > 0);
}

function getTokenFromRequest(c: any): string | null {
  console.log('🔍 [getTokenFromRequest] Extracting token...');
  
  // ✅ CRITICAL FIX: Check x-auth-token FIRST because Supabase gateway
  // intercepts/replaces the Authorization header in Edge Functions.
  // The user's real JWT must be sent via x-auth-token.
  const xToken = c.req.header("x-auth-token");
  console.log('🔍 [getTokenFromRequest] x-auth-token:', xToken ? `len=${xToken.length}` : 'NONE');
  
  if (xToken && isJwtFormat(xToken)) {
    console.log('🔍 [getTokenFromRequest] ✅ Using x-auth-token (preferred, valid JWT format)');
    return xToken;
  } else if (xToken) {
    console.warn('🔍 [getTokenFromRequest] ⚠️ x-auth-token present but NOT a valid JWT format, ignoring');
  }
  
  // Fallback: try Authorization header (may contain anon key from gateway, not user JWT)
  const auth = c.req.header("Authorization") || c.req.header("authorization") || "";
  console.log('🔍 [getTokenFromRequest] Authorization header:', auth ? `${auth.slice(0, 30)}...` : 'NONE');
  
  if (auth.startsWith("Bearer ")) {
    const token = auth.slice(7);
    // ✅ Only use Authorization Bearer if it looks like a JWT (not the anon key)
    if (isJwtFormat(token)) {
      console.log('🔍 [getTokenFromRequest] Using Bearer token (fallback, valid JWT format)');
      return token;
    } else {
      console.log('🔍 [getTokenFromRequest] ⚠️ Bearer token is NOT a JWT (likely anon key), ignoring');
    }
  }
  
  return null;
}

/**
 * Supabase client acting as the user (uses anon key + user JWT)
 */
function sbUser(token: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { 
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
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
 * Safe wrapper that calls GoTrue /auth/v1/user directly via fetch.
 * Bypasses supabaseClient.auth.getUser() which throws AuthSessionMissingError
 * in this Edge Runtime version even when a valid JWT is passed.
 *
 * Signature kept as safeGetUser(supabaseClient, token) for backward compat,
 * but supabaseClient is now ignored — we use a raw fetch instead.
 */
async function safeGetUser(_supabaseClient: any, token: string) {
  if (!token || !isJwtFormat(token)) {
    console.warn('🔐 [safeGetUser] Token is missing or not in JWT format, skipping getUser call');
    return {
      data: { user: null },
      error: new Error('Invalid token format - not a JWT')
    };
  }
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
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

/**
 * Admin-only middleware - validates JWT and checks role
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
    // ✅ CRITICAL FIX: Use user client with JWT token for auth validation
    const sb = sbUser(token);
    console.log('🔐 [AUTH] Using sbUser(token) client to validate JWT...');
    
    const { data: { user }, error } = await safeGetUser(sb, token);

    console.log('🔐 [AUTH] getUser result:');
    console.log('  - user exists:', !!user);
    console.log('  - user email:', user?.email);
    console.log('  - user id:', user?.id);
    console.log('  - error:', error?.message);
    console.log('  - error details:', JSON.stringify(error, null, 2));

    if (error || !user) {
      console.warn('⚠️  [AUTH] Invalid JWT:', error?.message);
      return c.json({ code: 401, message: error?.message || "Invalid JWT" }, 401);
    }

    // Check admin role
    const isAdmin = user.user_metadata?.role === "admin" || user.email === MASTER_ADMIN_EMAIL;
    
    console.log('🔐 [AUTH] User metadata:', JSON.stringify(user.user_metadata, null, 2));
    console.log('🔐 [AUTH] User role:', user.user_metadata?.role);
    console.log('🔐 [AUTH] Is admin:', isAdmin);
    
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
    
    if (!email || !password || !name) {
      return c.json({ error: 'Missing required fields: email, password, name' }, 400);
    }
    
    // Determine user role
    let userRole = 'user'; // Default to regular user
    
    // Allow admin creation ONLY if adminSecret matches
    if (role === 'admin') {
      const ADMIN_SECRET = Deno.env.get('ADMIN_SECRET') || 'BL_ADMIN_2025_SECRET';
      
      if (adminSecret === ADMIN_SECRET) {
        userRole = 'admin';
        console.log(`🛡️  Creating admin user: ${email}`);
      } else {
        console.warn(`⚠️  Attempted admin creation without valid secret: ${email}`);
        return c.json({ error: 'Invalid admin secret' }, 403);
      }
    }
    
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { 
        name,
        phone,
        role: userRole
      },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });
    
    if (error) {
      console.error('❌ Error creating user:', error);
      return c.json({ error: 'Failed to create user', details: error.message }, 400);
    }
    
    console.log(`✅ User created: ${data.user.id} (${email}) - Role: ${userRole}`);
    
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
        
        return {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.name || 'N/A',
          role: user.user_metadata?.role || 'user',
          blocked: user.user_metadata?.blocked || false,
          is_master_admin: user.user_metadata?.is_master_admin === true || user.email === MASTER_ADMIN_EMAIL,
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
    const matchedUsers = users
      .filter(user => {
        const email = (user.email || '').toLowerCase();
        const name = (user.user_metadata?.name || '').toLowerCase();
        return email.includes(queryLower) || name.includes(queryLower);
      })
      .slice(0, 10)
      .map(user => ({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || '',
        phone: user.user_metadata?.phone || '',
        role: user.user_metadata?.role || 'user',
      }));
    
    console.log(`🔍 User search for "${query}": found ${matchedUsers.length} matches`);
    return c.json({ users: matchedUsers });
  } catch (error) {
    console.error('❌ Error searching users:', error);
    return c.json({ error: 'Failed to search users', details: String(error) }, 500);
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

// Helper: Check if userId belongs to master admin (by metadata flag OR fallback email)
async function isMasterAdmin(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.admin.getUserById(userId);
    if (!user) return false;
    // Primary: check metadata flag (survives email change)
    if (user.user_metadata?.is_master_admin === true) return true;
    // Fallback: check original email (for initial setup before flag is set)
    if (user.email === MASTER_ADMIN_EMAIL) {
      // Auto-set the flag so it persists after email change
      console.log('🔒 Auto-setting is_master_admin flag for', user.email);
      const merged = { ...(user.user_metadata || {}), is_master_admin: true };
      await supabase.auth.admin.updateUserById(userId, { user_metadata: merged });
      return true;
    }
    return false;
  } catch { return false; }
}

// Block user (admin only)
app.patch("/make-server-a0e1e9cb/users/:userId/block", requireAdmin, async (c) => {
  try {
    const userId = c.req.param('userId');
    const supabase = getSupabaseClient();
    
    // ✅ Master admin protection
    if (await isMasterAdmin(supabase, userId)) {
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
    const userId = c.req.param('userId');
    const body = await c.req.json();
    const { role } = body;
    
    if (!role || !['admin', 'user'].includes(role)) {
      return c.json({ error: 'Invalid role. Must be "admin" or "user".' }, 400);
    }
    
    const supabase = getSupabaseClient();
    
    // ✅ Master admin protection — cannot demote
    if (role === 'user' && await isMasterAdmin(supabase, userId)) {
      return c.json({ error: 'Cannot remove admin rights from master admin', code: 'MASTER_ADMIN_PROTECTED' }, 403);
    }
    
    // If removing admin, check that this is not the last admin
    if (role === 'user') {
      const { data: { users: allUsers }, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      if (listErr) {
        console.error('❌ Error listing users for admin count:', listErr);
        return c.json({ error: 'Failed to verify admin count', details: listErr.message }, 500);
      }
      const adminCount = (allUsers || []).filter((u: any) => u.user_metadata?.role === 'admin').length;
      if (adminCount <= 1) {
        console.warn('⚠️ Cannot remove the last admin user');
        return c.json({ error: 'Cannot remove the only admin user', code: 'LAST_ADMIN' }, 400);
      }
    }
    
    // ✅ Merge metadata to prevent overwriting other fields
    const newMetadata = await mergeUserMetadata(supabase, userId, { role });
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
    
    // ✅ Master admin protection — cannot delete
    if (await isMasterAdmin(supabase, userId)) {
      return c.json({ error: 'Cannot delete master admin account', code: 'MASTER_ADMIN_PROTECTED' }, 403);
    }
    
    // Delete user from auth system
    const { error } = await supabase.auth.admin.deleteUser(userId);
    
    if (error) {
      console.error('❌ Error deleting user:', error);
      return c.json({ error: 'Failed to delete user', details: error.message }, 500);
    }
    
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
    const { userId, name, email, oldEmail, phone, profileImage } = body;
    
    if (!userId) {
      return c.json({ error: 'Missing required field: userId' }, 400);
    }
    
    const supabase = getSupabaseClient();
    
    // ✅ Master admin: ensure is_master_admin flag is always preserved
    const isMaster = await isMasterAdmin(supabase, userId);
    
    // Prepare update data
    const updateData: any = {};
    
    // ✅ FIXED: Merge user metadata to preserve role/blocked/etc
    const metadataPatch: Record<string, any> = {};
    if (name !== undefined) {
      metadataPatch.name = name;
    }
    if (phone !== undefined) {
      metadataPatch.phone = phone;
    }
    if (profileImage !== undefined) {
      metadataPatch.profileImage = profileImage;
    }
    // ✅ Ensure master admin flag persists through all profile updates
    if (isMaster) {
      metadataPatch.is_master_admin = true;
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
    
    console.log(`✅ User profile updated: ${userId}`);
    return c.json({ 
      success: true, 
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name,
        role: data.user.user_metadata?.role,
        phone: data.user.user_metadata?.phone,
        profileImage: data.user.user_metadata?.profileImage,
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
    
    return c.json({ submissions: allSubmissions });
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
      return c.json({ submission: event });
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
    
    // ✅ SVA polja su snake_case — nema camelCase fallbackova
    const page_slug = body.page_slug;
    if (!page_slug) {
      return c.json({ error: 'Missing required field: page_slug' }, 400);
    }
    if (!body.title) {
      return c.json({ error: 'Missing required field: title' }, 400);
    }
    if (!body.description) {
      return c.json({ error: 'Missing required field: description' }, 400);
    }
    const bodySubmittedRaw = typeof body.submitted_by === 'string' ? body.submitted_by.trim() : '';
    // ✅ Use sbService() to bypass broken RLS policy
    const supabase = sbService();

    const authEmail = (authUser.email || '').trim();
    if (!authEmail) {
      return c.json({ error: 'Authenticated session has no email address.' }, 401);
    }
    const isAdminSubmitter = authUser.user_metadata?.role === 'admin';

    let finalSubmittedBy: string;
    if (!isAdminSubmitter) {
      finalSubmittedBy = authEmail;
      if (bodySubmittedRaw && bodySubmittedRaw.toLowerCase() !== authEmail.toLowerCase()) {
        return c.json({ error: 'submitted_by must match your logged-in account email.' }, 400);
      }
    } else {
      if (!bodySubmittedRaw) {
        return c.json({ error: 'Missing required field: submitted_by (select a registered user).' }, 400);
      }
      const resolved = await resolveRegisteredSubmitterEmail(supabase, bodySubmittedRaw);
      if (!resolved) {
        return c.json({
          error: 'submitted_by must be the email of a registered user. Choose someone from search results.',
        }, 400);
      }
      finalSubmittedBy = resolved;
      if (body.assign_user_id) {
        const { data: uidData, error: uidErr } = await supabase.auth.admin.getUserById(body.assign_user_id);
        if (uidErr || !uidData?.user?.email) {
          return c.json({ error: 'Invalid assign_user_id.' }, 400);
        }
        if (uidData.user.email.toLowerCase() !== resolved.toLowerCase()) {
          return c.json({ error: 'assign_user_id does not match submitted_by email.' }, 400);
        }
      }
    }
    
    // ✅ Check if submitter is admin → auto-approve
    let isSubmitterAdmin = false;
    if (token) {
      try {
        const { data: { user: submitterUser } } = await safeGetUser(null, token);
        if (submitterUser?.user_metadata?.role === 'admin') {
          isSubmitterAdmin = true;
          console.log('👑 Admin user detected — event will be auto-approved');
        }
      } catch (e) { /* ignore */ }
    }
    
    // Determine which table to use
    // ⚠️ 'clubs' is NOT in this list — it's shared by nightclub VENUES (venue_type='nightclub')
    //    and club EVENTS (event_type='club'). We use event_type/start_at to distinguish.
    const EVENT_PAGE_SLUGS = ['events', 'event', 'concerts', 'theatre', 'cinema'];
    const isEvent = EVENT_PAGE_SLUGS.includes(page_slug) || !!body.event_type || !!body.start_at;
    const tableName = isEvent ? 'events_ee0c365c' : 'venues_ee0c365c';
    
    if (isEvent) {
      // ── EVENT CREATION ── snake_case only
      if (!body.start_at) {
        return c.json({ error: 'Missing required field: start_at (ISO datetime)' }, 400);
      }
      const startDate = new Date(body.start_at);
      if (isNaN(startDate.getTime())) {
        return c.json({ error: 'Invalid start_at datetime format. Use ISO 8601.', received: body.start_at }, 400);
      }
      if (body.end_at) {
        const endDate = new Date(body.end_at);
        if (isNaN(endDate.getTime())) {
          return c.json({ error: 'Invalid end_at datetime format. Use ISO 8601.', received: body.end_at }, 400);
        }
      }
      
      const eventType = body.event_type || null;
      const EVENT_TYPE_TO_PAGE_SLUG: Record<string, string> = {
        concert: 'concerts', festival: 'events', music: 'concerts',
        theatre: 'theatre', standup: 'events',
        cinema: 'cinema',
        club: 'clubs',
        exhibition: 'events', sport: 'events',
        gastro: 'events', conference: 'events',
        workshop: 'events', kids: 'events',
        other: 'events',
      };
      const event = {
        page_slug: body.page_slug || (eventType ? EVENT_TYPE_TO_PAGE_SLUG[eventType] : null) || 'events',
        event_type: eventType,
        title: body.title,
        title_en: body.title_en || body.title,
        description: body.description,
        description_en: body.description_en || body.description,
        city: body.city || 'Banja Luka',
        venue_name: body.venue_name || null,
        address: body.address || null,
        image: body.image || null,
        price: body.price || null,
        start_at: body.start_at,
        end_at: body.end_at || null,
        event_time: body.event_time || null,
        ticket_link: body.ticket_link || null,
        organizer_name: body.organizer_name || null,
        organizer_phone: body.organizer_phone || null,
        organizer_email: body.organizer_email || null,
        status: isSubmitterAdmin ? 'approved' : 'pending',
        submitted_by: finalSubmittedBy,
        is_custom: true,
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
      return c.json({ success: true, submission: data }, 201);
      
    } else {
      // ── VENUE CREATION ── snake_case only
      const venue = {
        page_slug: body.page_slug,
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
        submitted_by: finalSubmittedBy,
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

    const { data: { user }, error: authError } = await safeGetUser(sbUser(token), token);
    if (authError || !user || !user.email) {
      console.error('🗑️ [DELETE /submissions/:id] Auth failed', { id, authError: authError?.message });
      return c.json({ error: 'Unauthorized - invalid token' }, 401);
    }

    const normalize = (value: unknown): string => String(value ?? '').trim().toLowerCase();
    const userEmail = normalize(user.email);
    const userRole = normalize(user.user_metadata?.role);
    const isAdmin = userRole === 'admin' || userEmail === normalize(MASTER_ADMIN_EMAIL);
    console.log('🗑️ [DELETE /submissions/:id] Resolved user', { id, userEmail, userRole, isAdmin });

    const supabase = sbService();
    
    // Try deleting from events table first
    const { data: eventToDelete, error: eventFetchError } = await supabase
      .from('events_ee0c365c')
      .select('id, submitted_by, organizer_email')
      .eq('id', id)
      .maybeSingle();

    if (eventFetchError) {
      return c.json({ error: 'Failed to fetch event', details: eventFetchError.message }, 500);
    }

    if (eventToDelete) {
      const isOwner = normalize(eventToDelete.submitted_by) === userEmail || normalize(eventToDelete.organizer_email) === userEmail;
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
    
    // Use user client with JWT token for auth validation
    const { data: { user }, error: authError } = await safeGetUser(sbUser(accessToken), accessToken);
    
    if (authError || !user || !user.email) {
      return c.json({ error: 'Unauthorized - invalid token' }, 401);
    }
    
    const userEmail = user.email;
    console.log(`🔍 Fetching events for user: ${userEmail}`);
    
    // Get ALL events submitted by this user (any status)
    const supabase = sbService();
    const { data: events, error } = await supabase
      .from('events_ee0c365c')
      .select('*')
      .or(`submitted_by.eq.${userEmail},organizer_email.eq.${userEmail}`)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Database error fetching user events:', error);
      return c.json({ error: 'Failed to fetch events', details: error.message }, 500);
    }
    
    // 🔄 Also check venues table for legacy events stuck there
    const { data: venueEvents } = await supabase
      .from('venues_ee0c365c')
      .select('*')
      .or(`submitted_by.eq.${userEmail},organizer_email.eq.${userEmail}`)
      .not('start_at', 'is', null)
      .order('created_at', { ascending: false });
    
    const allEvents = [...(events || []), ...(venueEvents || []).map((v: any) => ({ ...v, _legacy_venue: true }))];
    
    console.log(`✅ Found ${events?.length || 0} events + ${venueEvents?.length || 0} legacy venue-events for ${userEmail}`);
    return c.json({ events: allEvents });
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
    
    // Use user client with JWT token for auth validation
    const { data: { user }, error: authError } = await safeGetUser(sbUser(accessToken), accessToken);
    
    if (authError || !user || !user.email) {
      return c.json({ error: 'Unauthorized - invalid token' }, 401);
    }
    
    // Use service role for DB operations
    const supabase = sbService();
    const userEmail = user.email;
    console.log(`🗑️ DELETING ALL SUBMISSIONS for user: ${userEmail}`);
    
    // ✅ FIXED: Use select() to get deleted records for accurate count
    const { data: deletedVenues, error: venuesError } = await supabase
      .from('venues_ee0c365c')
      .delete()
      .or(`submitted_by.eq.${userEmail},contact_email.eq.${userEmail}`)
      .select('id');
    
    if (venuesError) {
      console.error('❌ Error deleting venues:', venuesError);
      return c.json({ error: 'Failed to delete venues', details: venuesError.message }, 500);
    }
    
    const venuesCount = deletedVenues?.length || 0;
    
    // Delete all events
    const { data: deletedEvents, error: eventsError } = await supabase
      .from('events_ee0c365c')
      .delete()
      .or(`submitted_by.eq.${userEmail},organizer_email.eq.${userEmail}`)
      .select('id');
    
    if (eventsError) {
      console.error('❌ Error deleting events:', eventsError);
      return c.json({ error: 'Failed to delete events', details: eventsError.message }, 500);
    }
    
    const eventsCount = deletedEvents?.length || 0;
    
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
      query = query.eq('page_slug', page_slug);
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
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    
    const tomorrowStart = new Date(todayEnd);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
    
    if (filter === 'upcoming') {
      events = events.filter((item) => {
        if (!item.start_at) return false;
        const eventDate = new Date(item.start_at);
        return eventDate >= now;
      });
    } else if (filter === 'today') {
      events = events.filter((item) => {
        if (!item.start_at) return false;
        const eventDate = new Date(item.start_at);
        return eventDate >= todayStart && eventDate < todayEnd;
      });
    } else if (filter === 'tomorrow') {
      events = events.filter((item) => {
        if (!item.start_at) return false;
        const eventDate = new Date(item.start_at);
        return eventDate >= tomorrowStart && eventDate < tomorrowEnd;
      });
    } else if (filter === 'weekend') {
      // Get next weekend (Saturday + Sunday)
      const daysUntilSaturday = (6 - now.getDay() + 7) % 7;
      const saturdayStart = new Date(todayStart);
      saturdayStart.setDate(saturdayStart.getDate() + daysUntilSaturday);
      const sundayEnd = new Date(saturdayStart);
      sundayEnd.setDate(sundayEnd.getDate() + 2);
      
      events = events.filter((item) => {
        if (!item.start_at) return false;
        const eventDate = new Date(item.start_at);
        return eventDate >= saturdayStart && eventDate < sundayEnd;
      });
    } else if (filter === 'past') {
      events = events.filter((item) => {
        if (!item.start_at) return false;
        const eventDate = new Date(item.start_at);
        return eventDate < now;
      });
    }
    
    // Sort by start_at ascending (earliest first) for upcoming events
    events.sort((a, b) => {
      const dateA = a.start_at ? new Date(a.start_at).getTime() : 0;
      const dateB = b.start_at ? new Date(b.start_at).getTime() : 0;
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
    
    return c.json({ events });
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
        return c.json({ event: venueEvent, legacy_venue: true });
      }
      
      console.log('❌ Event not found in events or venues table');
      return c.json({ error: 'Event not found' }, 404);
    }
    
    // ✅ If event is approved, return it (public access)
    if (event.status === 'approved') {
      console.log('✅ Event is approved - returning to everyone');
      return c.json({ event });
    }
    
    // If event is NOT approved, check if user is the owner
    const accessToken = getTokenFromRequest(c);
    
    // Only try to validate if we have a token
    if (accessToken) {
      try {
        // ✅ Use user client with JWT token for auth validation
        const { data: { user }, error: authError } = await safeGetUser(sbUser(accessToken), accessToken);
        
        console.log('🔍 Auth check result:');
        console.log('🔍 User email:', user?.email);
        console.log('🔍 User role:', user?.user_metadata?.role);
        console.log('🔍 Auth error:', authError);
        
        if (!authError && user) {
          const userEmail = user.email;
          const userRole = user.user_metadata?.role;
          
          console.log('🔍 Ownership check:');
          console.log('🔍 User email:', `"${userEmail}"`);
          console.log('🔍 Event submitted_by:', `"${event.submitted_by}"`);
          console.log('🔍 Event organizer_email:', `"${event.organizer_email}"`);
          console.log('🔍 Email match (submitted_by):', event.submitted_by === userEmail);
          console.log('🔍 Email match (organizer):', event.organizer_email === userEmail);
          console.log('🔍 User role:', `"${userRole}"`);
          console.log('🔍 Is admin:', userRole === 'admin');
          
          // 🔥 ADMIN can access ALL events
          if (userRole === 'admin') {
            console.log('✅ ADMIN user - granting access to all events');
            return c.json({ event });
          }
          
          // Check if user owns this event
          if (event.submitted_by === userEmail || event.organizer_email === userEmail) {
            console.log(`✅ User ${userEmail} has access to their own event (status: ${event.status})`);
            return c.json({ event });
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
    
    if (!id) {
      return c.json({ error: 'Event ID is required' }, 400);
    }
    
    // ✅ Use sbService() to bypass broken RLS policy
    const supabase = sbService();

    let resolvedEventSubmittedBy: string | undefined = undefined;
    if (body.assign_user_id && body.submitted_by !== undefined && body.submitted_by !== null) {
      const rawSb = String(body.submitted_by).trim();
      if (!rawSb) {
        return c.json({ error: 'submitted_by must be a registered user email.' }, 400);
      }
      const resolvedSb = await resolveRegisteredSubmitterEmail(supabase, rawSb);
      if (!resolvedSb) {
        return c.json({ error: 'submitted_by must be a registered user email.' }, 400);
      }
      const { data: uidData, error: uidErr } = await supabase.auth.admin.getUserById(body.assign_user_id);
      if (uidErr || !uidData?.user?.email || uidData.user.email.toLowerCase() !== resolvedSb.toLowerCase()) {
        return c.json({ error: 'assign_user_id does not match submitted_by email.' }, 400);
      }
      resolvedEventSubmittedBy = resolvedSb;
      console.log(`🔗 Auto-assigning event to user: ${resolvedSb} (userId: ${body.assign_user_id})`);
    } else if (body.submitted_by !== undefined) {
      const rawSb = String(body.submitted_by ?? '').trim();
      if (!rawSb) {
        return c.json({ error: 'submitted_by must be a registered user email.' }, 400);
      }
      const resolvedSb = await resolveRegisteredSubmitterEmail(supabase, rawSb);
      if (!resolvedSb) {
        return c.json({ error: 'submitted_by must be a registered user email.' }, 400);
      }
      resolvedEventSubmittedBy = resolvedSb;
    }
    
    // ✅ snake_case only — nema camelCase fallbackova
    const updatePayload = {
      title: body.title,
      title_en: body.title_en,
      description: body.description,
      description_en: body.description_en,
      event_type: body.event_type,
      page_slug: body.page_slug || undefined,
      city: body.city,
      venue_name: body.venue_name,
      address: body.address,
      image: body.image,
      price: body.price,
      start_at: body.start_at,
      end_at: body.end_at,
      event_time: body.event_time,
      ticket_link: body.ticket_link,
      organizer_name: body.organizer_name,
      organizer_phone: body.organizer_phone,
      organizer_email: body.organizer_email,
      ...(resolvedEventSubmittedBy !== undefined ? { submitted_by: resolvedEventSubmittedBy } : {}),
      updated_at: new Date().toISOString(),
    };

    // 1️⃣ Try events table first
    const { data: eventsRows, error: eventsError } = await supabase
      .from('events_ee0c365c')
      .update(updatePayload)
      .eq('id', id)
      .select();
    
    if (!eventsError && eventsRows && eventsRows.length > 0) {
      console.log(`✅ Updated event in events table: ${eventsRows[0].title}`);
      return c.json({ event: eventsRows[0] });
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
        title: updatePayload.title ?? venueCheck.title,
        title_en: updatePayload.title_en ?? venueCheck.title_en,
        description: updatePayload.description ?? venueCheck.description,
        description_en: updatePayload.description_en ?? venueCheck.description_en,
        event_type: updatePayload.event_type || venueCheck.event_type || 'other',
        page_slug: updatePayload.page_slug || venueCheck.page_slug || 'events',
        city: updatePayload.city ?? venueCheck.city,
        venue_name: updatePayload.venue_name ?? venueCheck.venue_name,
        address: updatePayload.address ?? venueCheck.address,
        image: updatePayload.image ?? venueCheck.image,
        price: updatePayload.price ?? venueCheck.price,
        start_at: updatePayload.start_at || venueCheck.start_at,
        end_at: updatePayload.end_at || venueCheck.end_at,
        event_time: updatePayload.event_time ?? venueCheck.event_time,
        ticket_link: updatePayload.ticket_link ?? venueCheck.ticket_link,
        organizer_name: updatePayload.organizer_name ?? venueCheck.organizer_name,
        organizer_phone: updatePayload.organizer_phone ?? venueCheck.organizer_phone,
        organizer_email: updatePayload.organizer_email ?? venueCheck.organizer_email,
        status: venueCheck.status || 'approved',
        submitted_by:
          resolvedEventSubmittedBy !== undefined ? resolvedEventSubmittedBy : venueCheck.submitted_by,
        is_custom: venueCheck.is_custom ?? true,
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
      return c.json({ event: insertedEvent, migrated: true });
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

    const { data: { user }, error: authError } = await safeGetUser(sbUser(accessToken), accessToken);
    if (authError || !user || !user.email) {
      console.error('🗑️ [DELETE /events/:id] Auth failed', { id, authError: authError?.message });
      return c.json({ error: 'Unauthorized - invalid token' }, 401);
    }

    const normalize = (value: unknown): string => String(value ?? '').trim().toLowerCase();
    const userEmail = normalize(user.email);
    const userRole = normalize(user.user_metadata?.role);
    const isAdmin = userRole === 'admin' || userEmail === normalize(MASTER_ADMIN_EMAIL);
    console.log('🗑️ [DELETE /events/:id] Resolved user', { id, userEmail, userRole, isAdmin });
    const supabase = sbService();

    // Primary source: events table
    const { data: event, error: eventFetchError } = await supabase
      .from('events_ee0c365c')
      .select('id, submitted_by, organizer_email')
      .eq('id', id)
      .maybeSingle();

    if (eventFetchError) {
      console.error('🗑️ [DELETE /events/:id] Failed to fetch event', { id, error: eventFetchError.message });
      return c.json({ error: 'Failed to fetch event', details: eventFetchError.message }, 500);
    }

    if (event) {
      const isOwner = normalize(event.submitted_by) === userEmail || normalize(event.organizer_email) === userEmail;
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
    
    // Use user client with JWT token for auth validation
    const { data: { user }, error: authError } = await safeGetUser(sbUser(accessToken), accessToken);
    
    console.log('🔍 [MY-VENUES] Auth result:', { user: user?.email, error: authError?.message });
    
    if (authError || !user || !user.email) {
      console.error('❌ [MY-VENUES] Auth failed:', authError);
      return c.json({ error: 'Unauthorized - invalid token' }, 401);
    }
    
    // Use service role for DB queries
    const supabase = sbService();
    const userEmail = user.email;
    console.log(`🔍 [MY-VENUES] Fetching venues for user: "${userEmail}"`);
    console.log(`🔍 [MY-VENUES] User email length: ${userEmail.length}`);
    console.log(`🔍 [MY-VENUES] User email bytes: ${JSON.stringify([...userEmail].map(c => c.charCodeAt(0)))}`);
    
    // Get ALL venues submitted by this user (any status)
    const { data: venues, error, count } = await supabase
      .from('venues_ee0c365c')
      .select('*', { count: 'exact' })
      .eq('submitted_by', userEmail)
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
        // Use user client with JWT token for auth validation
        const { data: { user }, error: authError } = await safeGetUser(sbUser(accessToken), accessToken);
        
        if (!authError && user) {
          const userEmail = user.email;
          const userRole = user.user_metadata?.role;
          
          // 🔥 ADMIN can access ALL venues
          if (userRole === 'admin') {
            console.log('✅ ADMIN user - granting access to all venues');
            return c.json({ venue });
          }
          
          // Check if user owns this venue
          if (venue.submitted_by === userEmail || venue.contact_email === userEmail) {
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
    
    // ✅ FIXED: Use ?? instead of || so empty strings "" are preserved (not treated as falsy)
    // || treats "" as falsy → field update skipped → old value stays in DB forever
    // ?? treats "" as defined → saves empty string → field is properly cleared
    const contactEmail = body.contact_email ?? null;
    
    // ✅ FIXED: Auto-assign submitted_by when admin selects a registered user
    // ✅ snake_case only
    const assignUserId = body.assign_user_id;
    let submittedByUpdate: Record<string, any> = {};
    if (assignUserId && body.submitted_by !== undefined && body.submitted_by !== null) {
      const rawSb = String(body.submitted_by).trim();
      if (!rawSb) {
        return c.json({ error: 'submitted_by must be a registered user email.' }, 400);
      }
      const resolvedSb = await resolveRegisteredSubmitterEmail(supabase, rawSb);
      if (!resolvedSb) {
        return c.json({ error: 'submitted_by must be a registered user email.' }, 400);
      }
      const { data: uidData, error: uidErr } = await supabase.auth.admin.getUserById(assignUserId);
      if (uidErr || !uidData?.user?.email || uidData.user.email.toLowerCase() !== resolvedSb.toLowerCase()) {
        return c.json({ error: 'assign_user_id does not match submitted_by email.' }, 400);
      }
      submittedByUpdate = { submitted_by: resolvedSb };
      console.log(`🔗 Auto-assigning venue to user: ${resolvedSb} (userId: ${assignUserId})`);
    } else if (body.submitted_by !== undefined) {
      const rawSb = String(body.submitted_by ?? '').trim();
      if (!rawSb) {
        return c.json({ error: 'submitted_by must be a registered user email.' }, 400);
      }
      const resolvedSb = await resolveRegisteredSubmitterEmail(supabase, rawSb);
      if (!resolvedSb) {
        return c.json({ error: 'submitted_by must be a registered user email.' }, 400);
      }
      submittedByUpdate = { submitted_by: resolvedSb };
      console.log(`🔗 Updating submitted_by to: ${resolvedSb}`);
    }

    const tagsUpdate =
      body.tags !== undefined ? { tags: normalizeVenueTagsInput(body.tags) } : {};

    // ✅ snake_case only — ?? (nullish coalescing) preserves empty strings
    const { data: venue, error } = await supabase
      .from('venues_ee0c365c')
      .update({
        title: body.title,
        title_en: body.title_en,
        description: body.description,
        description_en: body.description_en,
        page_slug: body.page_slug,
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

    const { data: { user }, error: authError } = await safeGetUser(sbUser(accessToken), accessToken);
    if (authError || !user || !user.email) {
      console.error('🗑️ [DELETE /venues/:id] Auth failed', { id, authError: authError?.message });
      return c.json({ error: 'Unauthorized - invalid token' }, 401);
    }

    const normalize = (value: unknown): string => String(value ?? '').trim().toLowerCase();
    const userEmail = normalize(user.email);
    const userRole = normalize(user.user_metadata?.role);
    const isAdmin = userRole === 'admin' || userEmail === normalize(MASTER_ADMIN_EMAIL);
    console.log('🗑️ [DELETE /venues/:id] Resolved user', { id, userEmail, userRole, isAdmin });
    const supabase = sbService();

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

// PATCH toggle active status for events (admin only)
app.patch("/make-server-a0e1e9cb/events/:id/toggle-active", requireAdmin, async (c) => {
  try {
    const id = c.req.param('id');
    if (!id) {
      return c.json({ error: 'Event ID is required' }, 400);
    }
    
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
  } catch (error) {
    console.error('❌ Error toggling event active status:', error);
    return c.json({ error: 'Failed to toggle event active status', details: error instanceof Error ? error.message : JSON.stringify(error) }, 500);
  }
});

// PATCH toggle active status (admin only)
app.patch("/make-server-a0e1e9cb/venues/:id/toggle-active", requireAdmin, async (c) => {
  try {
    const id = c.req.param('id');
    if (!id) {
      return c.json({ error: 'Venue ID is required' }, 400);
    }
    
    let ids = [...(await loadInactiveIds())];
    
    const index = ids.indexOf(id);
    let is_active: boolean;
    
    if (index > -1) {
      // Was inactive, make active
      ids.splice(index, 1);
      is_active = true;
      console.log(`🟢 Venue ${id} set to ACTIVE. Total inactive: ${ids.length}`);
    } else {
      // Was active, make inactive
      ids.push(id);
      is_active = false;
      console.log(`🔴 Venue ${id} set to INACTIVE. Total inactive: ${ids.length}`);
    }
    
    await saveInactiveIds(ids);
    
    return c.json({ is_active, inactive_count: ids.length, ids });
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
    console.log('🔐 [change-password] Token:', token ? `len=${token.length}, jwt=${isJwtFormat(token)}` : 'NULL');
    if (!token) {
      return c.json({ error: 'Unauthorized - no token provided' }, 401);
    }

    const { data: userData, error: userError } = await safeGetUser(sbUser(token), token);
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

    const { data: userData, error: userError } = await safeGetUser(sbUser(token), token);
    if (userError || !userData?.user?.id) {
      return c.json({ error: 'Unauthorized - invalid session' }, 401);
    }

    if (userData.user.user_metadata?.role !== 'admin') {
      return c.json({ error: 'Forbidden - admin only' }, 403);
    }

    const supabase = sbService();
    const { data: allUsers, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (listError) {
      console.error('❌ [admin-count] Error listing users:', listError);
      return c.json({ error: 'Failed to count admins' }, 500);
    }

    const adminCount = (allUsers?.users || []).filter(
      (u: any) => u.user_metadata?.role === 'admin'
    ).length;

    console.log(`🛡️ [admin-count] Admin count: ${adminCount}`);
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

    const { data: userData, error: userError } = await safeGetUser(sbUser(token), token);
    if (userError || !userData?.user?.id) {
      return c.json({ error: 'Unauthorized - invalid session' }, 401);
    }

    const userId = userData.user.id;
    const supabase = sbService();

    // 🛡️ ADMIN GUARD: If user is admin, check there's at least one other admin
    const userRole = userData.user.user_metadata?.role;
    if (userRole === 'admin') {
      console.log('🛡️ [delete-account] User is admin, checking for other admins...');
      const { data: allUsers, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      if (listError) {
        console.error('❌ [delete-account] Error listing users:', listError);
        return c.json({ error: 'Failed to verify admin count', code: 'ADMIN_CHECK_FAILED' }, 500);
      }
      const adminCount = (allUsers?.users || []).filter(
        (u: any) => u.user_metadata?.role === 'admin'
      ).length;
      console.log(`🛡️ [delete-account] Admin count: ${adminCount}`);
      if (adminCount <= 1) {
        console.log('🛡️ [delete-account] ❌ BLOCKED: Cannot delete last admin account');
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
        const { error: venueDelError } = await supabase
          .from('venues_ee0c365c')
          .delete()
          .eq('submitted_by', userEmail);
        if (venueDelError) console.warn('⚠️ Error deleting user venues:', venueDelError);

        const { error: eventDelError } = await supabase
          .from('events_ee0c365c')
          .delete()
          .eq('submitted_by', userEmail);
        if (eventDelError) console.warn('⚠️ Error deleting user events:', eventDelError);
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
