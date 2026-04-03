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

// 🔍 DEBUG: Get all unique submitted_by emails from venues
app.get("/make-server-a0e1e9cb/debug/venues-emails", async (c) => {
  try {
    const supabase = getSupabaseClient();
    
    // Get ALL venues
    const { data: venues, error } = await supabase
      .from('venues_ee0c365c')
      .select('id, title, submitted_by, page_slug, status')
      .order('submitted_by');
    
    if (error) {
      console.error('❌ Error fetching venues:', error);
      return c.json({ error: error.message }, 500);
    }
    
    // Group by submitted_by
    const grouped: Record<string, any[]> = {};
    
    venues?.forEach(venue => {
      const email = venue.submitted_by || 'NULL';
      if (!grouped[email]) {
        grouped[email] = [];
      }
      grouped[email].push({
        id: venue.id,
        title: venue.title,
        category: venue.page_slug,
        status: venue.status
      });
    });
    
    console.log('📊 Venues by submitted_by:', JSON.stringify(grouped, null, 2));
    
    return c.json({ 
      total: venues?.length || 0,
      grouped,
      unique_emails: Object.keys(grouped)
    });
  } catch (error) {
    console.error('❌ Error:', error);
    return c.json({ error: String(error) }, 500);
  }
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

// Get all submissions (with optional filter by status or page_slug)
app.get("/make-server-a0e1e9cb/submissions", async (c) => {
  try {
    const status = c.req.query('status'); // pending, approved, rejected
    const page_slug = c.req.query('page_slug'); // food-and-drink, clubs, events, etc.
    
    const supabase = getSupabaseClient();
    
    // Determine which table to query based on page_slug
    let allSubmissions = [];
    
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
      
      allSubmissions = [...allSubmissions, ...(events || [])];
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
      
      allSubmissions = [...allSubmissions, ...(venues || [])];
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
      const uniqueEmails = [...new Set(allSubmissions.map((s: any) => s.submitted_by).filter(Boolean))];
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
          allSubmissions = allSubmissions.map((item: any) => ({
            ...item,
            submitted_by_name: emailToName[item.submitted_by] || null,
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
    const submittedBy = body.submitted_by;
    if (!submittedBy) {
      return c.json({ error: 'Missing required field: submitted_by' }, 400);
    }
    
    // ✅ Use sbService() to bypass broken RLS policy
    const supabase = sbService();
    
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
        concert: 'concerts', festival: 'concerts', music: 'concerts',
        theatre: 'theatre', standup: 'theatre',
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
        submitted_by: submittedBy,
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
        status: isSubmitterAdmin ? 'approved' : 'pending',
        submitted_by: submittedBy,
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

// Delete submission (admin only)
app.delete("/make-server-a0e1e9cb/submissions/:id", requireAdmin, async (c) => {
  try {
    const id = c.req.param('id');
    // ✅ Use sbService() to bypass broken RLS policy
    const supabase = sbService();
    
    // Try deleting from events table first
    const { data: deletedEvent, error: eventError } = await supabase
      .from('events_ee0c365c')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();
    
    if (deletedEvent) {
      console.log(`✅ Event deleted: ${id}`);
      return c.json({ success: true });
    }
    
    // Fallback: try deleting from venues table (legacy bug — events stuck in venues)
    const { data: deletedVenue, error: venueError } = await supabase
      .from('venues_ee0c365c')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();
    
    if (deletedVenue) {
      console.log(`✅ Venue deleted: ${id}`);
      return c.json({ success: true });
    }
    
    console.error('❌ Submission not found:', id);
    return c.json({ error: 'Submission not found' }, 404);
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
    const status = c.req.query('status'); // pending, approved, rejected
    const filter = c.req.query('filter'); // upcoming, today, tomorrow, weekend, past
    const city = c.req.query('city');
    const type = c.req.query('type');
    const page_slug = c.req.query('page_slug'); // concerts, theatre, cinema, events, etc.
    
    const supabase = getSupabaseClient();
    
    // Build base query - use events table
    let query = supabase
      .from('events_ee0c365c')
      .select('*');
    
    // Filter by status (default: only approved)
    if (status) {
      query = query.eq('status', status);
    } else {
      query = query.eq('status', 'approved');
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
      submitted_by: body.submitted_by,
      updated_at: new Date().toISOString(),
    };

    // ✅ Handle assign_user_id for events
    if (body.assign_user_id && body.submitted_by) {
      console.log(`🔗 Auto-assigning event to user: ${body.submitted_by} (userId: ${body.assign_user_id})`);
    }

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
        submitted_by: updatePayload.submitted_by ?? venueCheck.submitted_by,
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
    if (assignUserId && body.submitted_by) {
      submittedByUpdate = { submitted_by: body.submitted_by };
      console.log(`🔗 Auto-assigning venue to user: ${body.submitted_by} (userId: ${assignUserId})`);
    } else if (body.submitted_by !== undefined) {
      submittedByUpdate = { submitted_by: body.submitted_by };
      console.log(`🔗 Updating submitted_by to: ${body.submitted_by || '(cleared)'}`);
    }
    
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
// 🌱 SEED DATA ENDPOINT (admin only)
// ===================================
app.post('/make-server-a0e1e9cb/seed', async (c) => {
  console.log('🌱 POST /seed - Populating database with sample data');
  try {
    const token = getTokenFromRequest(c);
    if (!token) {
      return c.json({ error: 'Unauthorized - no token provided' }, 401);
    }
    
    const { data: { user: authUser } } = await safeGetUser(sbService(), token);
    if (!authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const isMaster = authUser.user_metadata?.is_master_admin === true || authUser.email === MASTER_ADMIN_EMAIL;
    if (!isMaster) {
      return c.json({ error: 'Only master admin can seed data' }, 403);
    }

    const supabase = sbService();  // service role bypasses RLS (koja referencira nepostojeću 'category' kolonu)
    const adminEmail = authUser.email || MASTER_ADMIN_EMAIL;
    const now = new Date().toISOString();

    const venues = [
      // ── RESTAURANTS (venue_type: restaurant) ×3 ──
      { page_slug:'food-and-drink',venue_type:'restaurant',title:'Kazamat',title_en:'Kazamat',description:'Elegantni restoran smješten u tvrđavi Kastel sa pogledom na rijeku Vrbas. Nudi vrhunsku bosansku i internacionalnu kuhinju u jedinstvenom ambijentu.',description_en:'Elegant restaurant located in the Kastel fortress overlooking the Vrbas river. Offers premium Bosnian and international cuisine in a unique setting.',city:'Banja Luka',address:'Kastel bb, 78000 Banja Luka',phone:'051222333',cuisine:'Bosanska, Internacionalna',cuisine_en:'Bosnian, International',opening_hours:'Pon-Ned: 11:00-23:00',opening_hours_en:'Mon-Sun: 11:00-23:00',image:'https://images.unsplash.com/photo-1758648207365-df458d3e83f4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbGVnYW50JTIwcmVzdGF1cmFudCUyMGludGVyaW9yJTIwZGluaW5nfGVufDF8fHx8MTc3MzA5NDMyMnww&ixlib=rb-4.1.0&q=80&w=1080',price:'€€€',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      { page_slug:'food-and-drink',venue_type:'restaurant',title:'Restoran Mala Stanica',title_en:'Restaurant Mala Stanica',description:'Restoran sa terasom na obali Vrbasa. Specijaliteti od riječne ribe i domaće paste u romantičnom ambijentu.',description_en:'Riverside terrace restaurant. Specialties from river fish and homemade pasta in a romantic setting.',city:'Banja Luka',address:'Patre 5, 78000 Banja Luka',phone:'051234567',cuisine:'Riblja, Mediteranska',cuisine_en:'Seafood, Mediterranean',opening_hours:'Pon-Ned: 10:00-23:00',opening_hours_en:'Mon-Sun: 10:00-23:00',image:'https://images.unsplash.com/photo-1760726743604-fb4e71718901?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtZWRpdGVycmFuZWFuJTIwc2VhZm9vZCUyMHJlc3RhdXJhbnQlMjB0ZXJyYWNlfGVufDF8fHx8MTc3MzE1MzE5OXww&ixlib=rb-4.1.0&q=80&w=1080',price:'€€',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      { page_slug:'food-and-drink',venue_type:'restaurant',title:'Kruna',title_en:'Kruna',description:'Premium fine dining restoran sa panoramskim pogledom na grad. Autorska kuhinja, sezonski meni i vrhunska vinska karta.',description_en:'Premium fine dining restaurant with panoramic city views. Signature cuisine, seasonal menu and excellent wine list.',city:'Banja Luka',address:'Kralja Petra I Karađorđevića 115',phone:'051345678',cuisine:'Autorska, Internacionalna',cuisine_en:'Signature, International',opening_hours:'Pon-Sub: 12:00-23:00',opening_hours_en:'Mon-Sat: 12:00-23:00',image:'https://images.unsplash.com/photo-1767732182449-395bdcbf875f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyb29mdG9wJTIwcmVzdGF1cmFudCUyMGNpdHklMjB2aWV3JTIwZGlubmVyfGVufDF8fHx8MTc3MzE1MzE5OXww&ixlib=rb-4.1.0&q=80&w=1080',price:'€€€',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      // ── ĆEVABDŽINICE (venue_type: cevabdzinica) ×3 ──
      { page_slug:'food-and-drink',venue_type:'cevabdzinica',title:'Kod Muje',title_en:'Kod Muje',description:'Tradicionalna ćevabdžinica sa najboljim ćevapima u gradu. Domaća atmosfera i autentični balkanski ukusi.',description_en:'Traditional grill house with the best cevapi in town. Homely atmosphere and authentic Balkan flavors.',city:'Banja Luka',address:'Kralja Petra I Karađorđevića 97',phone:'051211234',cuisine:'Balkanska, Roštilj',cuisine_en:'Balkan, Grill',opening_hours:'Pon-Sub: 08:00-22:00',opening_hours_en:'Mon-Sat: 08:00-22:00',image:'https://images.unsplash.com/photo-1592412544617-7c962b8b7271?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjZXZhcGklMjBrZWJhYiUyMGJhbGthbiUyMGdyaWxsZWQlMjBtZWF0fGVufDF8fHx8MTc3MzE1MzE5NHww&ixlib=rb-4.1.0&q=80&w=1080',price:'€',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      { page_slug:'food-and-drink',venue_type:'cevabdzinica',title:'Ćevabdžinica Tukić',title_en:'Cevabdzinica Tukic',description:'Porodična ćevabdžinica sa receptom starim 40 godina. Ručno pravljeni ćevapi od junetine i lepinja iz krušne peći.',description_en:'Family grill house with a 40-year-old recipe. Handmade beef cevapi and bread from a wood-fired oven.',city:'Banja Luka',address:'Srpska 22',phone:'051223344',cuisine:'Balkanska, Roštilj',cuisine_en:'Balkan, Grill',opening_hours:'Pon-Sub: 07:00-21:00',opening_hours_en:'Mon-Sat: 07:00-21:00',image:'https://images.unsplash.com/photo-1752162958264-22f6f5aecd96?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0cmFkaXRpb25hbCUyMGJhbGthbiUyMGdyaWxsJTIwZm9vZHxlbnwxfHx8fDE3NzMwNDczODh8MA&ixlib=rb-4.1.0&q=80&w=1080',price:'€',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      { page_slug:'food-and-drink',venue_type:'cevabdzinica',title:'Ćevabdžinica Banja Luka',title_en:'Cevabdzinica Banja Luka',description:'Klasična banjalučka ćevabdžinica u centru grada. Banjalučki ćevap serviran u somunu sa kajmakom.',description_en:'Classic Banja Luka grill house downtown. Banja Luka-style cevap served in somun bread with kajmak.',city:'Banja Luka',address:'Veselina Masleše 5',phone:'051556677',cuisine:'Balkanska',cuisine_en:'Balkan',opening_hours:'Pon-Ned: 08:00-20:00',opening_hours_en:'Mon-Sun: 08:00-20:00',image:'https://images.unsplash.com/photo-1752162958264-22f6f5aecd96?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0cmFkaXRpb25hbCUyMGJhbGthbiUyMGdyaWxsJTIwZm9vZHxlbnwxfHx8fDE3NzMwNDczODh8MA&ixlib=rb-4.1.0&q=80&w=1080',price:'€',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      // ── PIZZERIE (venue_type: pizzeria) ×3 ──
      { page_slug:'food-and-drink',venue_type:'pizzeria',title:'Pizzeria San Marco',title_en:'Pizzeria San Marco',description:'Autentična italijanska picerija sa pizzama pečenim u drvenoj peći. Svježi sastojci i originalni recepti iz Napulja.',description_en:'Authentic Italian pizzeria with wood-fired pizzas. Fresh ingredients and original recipes from Naples.',city:'Banja Luka',address:'Ferhadija 12',phone:'051445566',cuisine:'Italijanska',cuisine_en:'Italian',opening_hours:'Pon-Ned: 10:00-23:00',opening_hours_en:'Mon-Sun: 10:00-23:00',image:'https://images.unsplash.com/photo-1689150911817-3e27168ab6a3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpdGFsaWFuJTIwcGl6emElMjB3b29kJTIwb3ZlbnxlbnwxfHx8fDE3NzMwNjk4MTZ8MA&ixlib=rb-4.1.0&q=80&w=1080',price:'€€',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      { page_slug:'food-and-drink',venue_type:'pizzeria',title:'Pizza Plus',title_en:'Pizza Plus',description:'Moderna picerija sa kreativnim kombinacijama i klasičnim receptima. Dostava na kućnu adresu u roku od 30 min.',description_en:'Modern pizzeria with creative combos and classic recipes. Home delivery within 30 minutes.',city:'Banja Luka',address:'Aleja Svetog Save 20',phone:'051667788',cuisine:'Italijanska, Fast food',cuisine_en:'Italian, Fast food',opening_hours:'Pon-Ned: 09:00-24:00',opening_hours_en:'Mon-Sun: 09:00-24:00',image:'https://images.unsplash.com/photo-1689150911817-3e27168ab6a3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpdGFsaWFuJTIwcGl6emElMjB3b29kJTIwb3ZlbnxlbnwxfHx8fDE3NzMwNjk4MTZ8MA&ixlib=rb-4.1.0&q=80&w=1080',price:'€',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      { page_slug:'food-and-drink',venue_type:'pizzeria',title:'Napoli Express',title_en:'Napoli Express',description:'Brza picerija sa tankim tijestom u napolitanskom stilu. Sveže napravljeno tijesto svaki dan.',description_en:'Fast pizzeria with thin Neapolitan-style dough. Freshly made dough every day.',city:'Banja Luka',address:'Jovana Dučića 30',phone:'051778899',cuisine:'Italijanska',cuisine_en:'Italian',opening_hours:'Pon-Ned: 10:00-22:00',opening_hours_en:'Mon-Sun: 10:00-22:00',image:'https://images.unsplash.com/photo-1689150911817-3e27168ab6a3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpdGFsaWFuJTIwcGl6emElMjB3b29kJTIwb3ZlbnxlbnwxfHx8fDE3NzMwNjk4MTZ8MA&ixlib=rb-4.1.0&q=80&w=1080',price:'€',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      // ── FAST FOOD (venue_type: fast_food) ×3 ──
      { page_slug:'food-and-drink',venue_type:'fast_food',title:'Burger House BL',title_en:'Burger House BL',description:'Gurmansko burger iskustvo sa domaćim mesom i kreativnim kombinacijama. Craft pivo i premium kokteli.',description_en:'Gourmet burger experience with locally sourced meat and creative combinations. Craft beer and premium cocktails.',city:'Banja Luka',address:'Aleja Svetog Save 8',phone:'051555666',cuisine:'Američka, Fast food',cuisine_en:'American, Fast food',opening_hours:'Pon-Ned: 11:00-23:00',opening_hours_en:'Mon-Sun: 11:00-23:00',image:'https://images.unsplash.com/photo-1677825949038-9e2dea0620d0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYXN0JTIwZm9vZCUyMGJ1cmdlciUyMHJlc3RhdXJhbnR8ZW58MXx8fHwxNzczMTUzMTg2fDA&ixlib=rb-4.1.0&q=80&w=1080',price:'€€',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      { page_slug:'food-and-drink',venue_type:'fast_food',title:'Giros Korner',title_en:'Gyros Corner',description:'Brza hrana inspirisana grčkom kuhinjom. Giros u lepinji, souvlaki i svježe salate.',description_en:'Fast food inspired by Greek cuisine. Gyros wraps, souvlaki and fresh salads.',city:'Banja Luka',address:'Bulevar Cara Dušana 15',phone:'051889900',cuisine:'Grčka, Fast food',cuisine_en:'Greek, Fast food',opening_hours:'Pon-Ned: 09:00-01:00',opening_hours_en:'Mon-Sun: 09:00-01:00',image:'https://images.unsplash.com/photo-1677825949038-9e2dea0620d0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYXN0JTIwZm9vZCUyMGJ1cmdlciUyMHJlc3RhdXJhbnR8ZW58MXx8fHwxNzczMTUzMTg2fDA&ixlib=rb-4.1.0&q=80&w=1080',price:'€',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      { page_slug:'food-and-drink',venue_type:'fast_food',title:'Wok & Roll',title_en:'Wok & Roll',description:'Azijski fast food sa noodle-ima, wok jelima i spring roll-ovima. Brza priprema, svježi sastojci.',description_en:'Asian fast food with noodles, wok dishes and spring rolls. Quick preparation, fresh ingredients.',city:'Banja Luka',address:'Gundulićeva 12',phone:'051990011',cuisine:'Azijska, Fast food',cuisine_en:'Asian, Fast food',opening_hours:'Pon-Ned: 10:00-22:00',opening_hours_en:'Mon-Sun: 10:00-22:00',image:'https://images.unsplash.com/photo-1771773527813-a0524607bcf0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdXNoaSUyMGphcGFuZXNlJTIwcmVzdGF1cmFudCUyMGZyZXNofGVufDF8fHx8MTc3MzE1MzE5Mnww&ixlib=rb-4.1.0&q=80&w=1080',price:'€',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      // ── DESSERT SHOP (venue_type: dessert_shop) ×3 ──
      { page_slug:'food-and-drink',venue_type:'dessert_shop',title:'Slatki Kutak',title_en:'Sweet Corner',description:'Slastičarna poznata po domaćim tortama, kremšnitama i baklavi. Savršen za porodični izlazak.',description_en:'Pastry shop known for homemade cakes, cream slices and baklava. Perfect for family outings.',city:'Banja Luka',address:'Kneza Miloša 22',phone:'051334455',cuisine:'Slastičarnica',cuisine_en:'Pastry shop',opening_hours:'Pon-Ned: 08:00-22:00',opening_hours_en:'Mon-Sun: 08:00-22:00',image:'https://images.unsplash.com/photo-1646981973579-f36c7298f07e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwYXN0cnklMjBiYWtlcnklMjBjYWtlcyUyMGRlc3NlcnR8ZW58MXx8fHwxNzczMTUzMTg3fDA&ixlib=rb-4.1.0&q=80&w=1080',price:'€',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      { page_slug:'food-and-drink',venue_type:'dessert_shop',title:'Gelato Amore',title_en:'Gelato Amore',description:'Artizanski sladoled po italijanskim receptima. 24 ukusa koji se mijenjaju sezonski, plus vegansko i sugar-free opcije.',description_en:'Artisan gelato from Italian recipes. 24 rotating seasonal flavors, plus vegan and sugar-free options.',city:'Banja Luka',address:'Veselina Masleše 35',phone:'051445500',cuisine:'Sladoled, Deserti',cuisine_en:'Gelato, Desserts',opening_hours:'Pon-Ned: 10:00-22:00',opening_hours_en:'Mon-Sun: 10:00-22:00',image:'https://images.unsplash.com/photo-1646981973579-f36c7298f07e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwYXN0cnklMjBiYWtlcnklMjBjYWtlcyUyMGRlc3NlcnR8ZW58MXx8fHwxNzczMTUzMTg3fDA&ixlib=rb-4.1.0&q=80&w=1080',price:'€',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      { page_slug:'food-and-drink',venue_type:'dessert_shop',title:'Čoko Raj',title_en:'Choco Heaven',description:'Čokoladnica i slastičarna sa domaćim pralineima, čokoladnim fondanima i toplom čokoladom od belgijskog kakaa.',description_en:'Chocolaterie and pastry shop with homemade pralines, chocolate fondants and hot chocolate from Belgian cocoa.',city:'Banja Luka',address:'Ive Andrića 10',phone:'051556600',cuisine:'Čokolada, Deserti',cuisine_en:'Chocolate, Desserts',opening_hours:'Pon-Sub: 09:00-21:00',opening_hours_en:'Mon-Sat: 09:00-21:00',image:'https://images.unsplash.com/photo-1646981973579-f36c7298f07e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwYXN0cnklMjBiYWtlcnklMjBjYWtlcyUyMGRlc3NlcnR8ZW58MXx8fHwxNzczMTUzMTg3fDA&ixlib=rb-4.1.0&q=80&w=1080',price:'€€',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      // ── PUB (venue_type: pub) ×3 ─��
      { page_slug:'food-and-drink',venue_type:'pub',title:'Craft Beer Pub',title_en:'Craft Beer Pub',description:'Pivnica sa 20+ vrsta craft piva iz lokalnih i međunarodnih mikropivara. Pub hrana i opuštena atmosfera.',description_en:'Pub with 20+ types of craft beer from local and international microbreweries. Pub food and relaxed atmosphere.',city:'Banja Luka',address:'Gundulićeva 8',phone:'051777888',cuisine:'Craft pivo, Pub hrana',cuisine_en:'Craft beer, Pub food',opening_hours:'Pon-Ned: 16:00-01:00',opening_hours_en:'Mon-Sun: 16:00-01:00',image:'https://images.unsplash.com/photo-1761474910886-a4c7308076d8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcmFmdCUyMGJlZXIlMjBwdWIlMjBicmV3ZXJ5fGVufDF8fHx8MTc3MzE1MzE5Mnww&ixlib=rb-4.1.0&q=80&w=1080',price:'€€',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      { page_slug:'food-and-drink',venue_type:'pub',title:'Irish Corner',title_en:'Irish Corner',description:'Irski pub sa živom muzikom petkom i subotom. Guinness na točenju, fish & chips i whiskey kolekcija.',description_en:'Irish pub with live music on Fridays and Saturdays. Draught Guinness, fish & chips and whiskey collection.',city:'Banja Luka',address:'Srpska 45',phone:'051112233',cuisine:'Irska, Pub hrana',cuisine_en:'Irish, Pub food',opening_hours:'Pon-Ned: 15:00-02:00',opening_hours_en:'Mon-Sun: 15:00-02:00',image:'https://images.unsplash.com/photo-1761474910886-a4c7308076d8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcmFmdCUyMGJlZXIlMjBwdWIlMjBicmV3ZXJ5fGVufDF8fHx8MTc3MzE1MzE5Mnww&ixlib=rb-4.1.0&q=80&w=1080',price:'€€',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      { page_slug:'food-and-drink',venue_type:'pub',title:'Wine Gallery',title_en:'Wine Gallery',description:'Vinski bar sa kolekcijom od 150+ etiketa iz BiH, Srbije, Hrvatske i svijeta. Degustacije svake petkom.',description_en:'Wine bar with a collection of 150+ labels from BiH, Serbia, Croatia and the world. Tastings every Friday.',city:'Banja Luka',address:'Braće Fejića 36',phone:'051543210',cuisine:'Vino, Delikatese',cuisine_en:'Wine, Delicatessen',opening_hours:'Pon-Sub: 15:00-24:00',opening_hours_en:'Mon-Sat: 15:00-24:00',image:'https://images.unsplash.com/photo-1650903015056-4c2e63a8ce85?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3aW5lJTIwYmFyJTIwY2VsbGFyJTIwdGFzdGluZ3xlbnwxfHx8fDE3NzMwNDczOTZ8MA&ixlib=rb-4.1.0&q=80&w=1080',price:'€€€',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      // ── CAFE (venue_type: cafe) ×3 ──
      { page_slug:'food-and-drink',venue_type:'cafe',title:'Cafe Capuccino',title_en:'Cafe Capuccino',description:'Udoban kafić sa najboljom kafom u gradu. Domaće torte, kolači i latte art koji oduševljava.',description_en:'Cozy cafe with the best coffee in town. Homemade cakes, pastries and impressive latte art.',city:'Banja Luka',address:'Kralja Petra I Karađorđevića 55',phone:'051123456',cuisine:'Kafa, Kolači',cuisine_en:'Coffee, Pastries',opening_hours:'Pon-Ned: 07:00-23:00',opening_hours_en:'Mon-Sun: 07:00-23:00',image:'https://images.unsplash.com/photo-1548983811-31048d472093?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb3p5JTIwY29mZmVlJTIwc2hvcCUyMGNhZmUlMjBsYXR0ZXxlbnwxfHx8fDE3NzMxMzk5MzJ8MA&ixlib=rb-4.1.0&q=80&w=1080',price:'€',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      { page_slug:'food-and-drink',venue_type:'cafe',title:'Latte Boutique',title_en:'Latte Boutique',description:'Moderni specialty coffee shop sa zrnima iz cijeloga svijeta. Third wave kafa i domaći kolači.',description_en:'Modern specialty coffee shop with beans from around the world. Third wave coffee and homemade pastries.',city:'Banja Luka',address:'Maršala Tita 30',phone:'051667788',cuisine:'Specialty kafa',cuisine_en:'Specialty coffee',opening_hours:'Pon-Sub: 07:30-22:00',opening_hours_en:'Mon-Sat: 07:30-22:00',image:'https://images.unsplash.com/photo-1615127039322-71e4a97433d8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBjYWZlJTIwaW50ZXJpb3IlMjBkZXNpZ258ZW58MXx8fHwxNzczMTA4MzczfDA&ixlib=rb-4.1.0&q=80&w=1080',price:'€€',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      { page_slug:'food-and-drink',venue_type:'cafe',title:'Book Cafe',title_en:'Book Cafe',description:'Kafić-knjižara sa čitaonicom i bogatim fondom knjiga. Tiha oaza za ljubitelje čitanja uz odličnu kafu.',description_en:'Bookstore-cafe with reading room and rich book collection. A quiet oasis for reading lovers with excellent coffee.',city:'Banja Luka',address:'Ive Andrića 4',phone:'051888999',cuisine:'Kafa, Čaj',cuisine_en:'Coffee, Tea',opening_hours:'Pon-Sub: 09:00-21:00',opening_hours_en:'Mon-Sat: 09:00-21:00',image:'https://images.unsplash.com/photo-1739133086794-6424277dbfd0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxib29rc3RvcmUlMjByZWFkaW5nJTIwY296eSUyMGxpYnJhcnl8ZW58MXx8fHwxNzczMTUzMTk5fDA&ixlib=rb-4.1.0&q=80&w=1080',price:'€',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      // ── NIGHTCLUBS (venue_type: nightclub, page_slug: clubs) ×3 ──
      { page_slug:'clubs',venue_type:'nightclub',title:'Club Underground',title_en:'Club Underground',description:'Najpoznatiji noćni klub u Banja Luci sa DJ-evima iz regiona. Elektronska, house i techno muzika.',description_en:'The most famous nightclub in Banja Luka with DJs from the region. Electronic, house and techno music.',city:'Banja Luka',address:'Braće Mažar 7',phone:'051666777',opening_hours:'Pet-Sub: 23:00-05:00',opening_hours_en:'Fri-Sat: 23:00-05:00',image:'https://images.unsplash.com/photo-1657208431551-cbf415b8ef26?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuaWdodGNsdWIlMjBwYXJ0eSUyMGxpZ2h0cyUyMGRhbmNlfGVufDF8fHx8MTc3MzA0NzM4OXww&ixlib=rb-4.1.0&q=80&w=1080',price:'€€',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      { page_slug:'clubs',venue_type:'nightclub',title:'Lounge 33',title_en:'Lounge 33',description:'Elegantni koktel bar i lounge sa premium koktelima i opuštenom muzikom. Savršeno za veče u dvoje.',description_en:'Elegant cocktail bar and lounge with premium cocktails and relaxed music. Perfect for a romantic evening.',city:'Banja Luka',address:'Svetog Save 33',phone:'051999000',opening_hours:'Pon-Sub: 18:00-02:00',opening_hours_en:'Mon-Sat: 18:00-02:00',image:'https://images.unsplash.com/photo-1758685493098-d3a09d4044d0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb2NrdGFpbCUyMGJhciUyMGxvdW5nZSUyMGV2ZW5pbmd8ZW58MXx8fHwxNzczMDQ3MzkwfDA&ixlib=rb-4.1.0&q=80&w=1080',price:'���€€',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      { page_slug:'clubs',venue_type:'nightclub',title:'Club Pulse',title_en:'Club Pulse',description:'Moderni klub sa vrhunskim zvukom i LED instalacijama. Domaći i gostujući DJ-evi svaki vikend.',description_en:'Modern club with top-tier sound system and LED installations. Local and guest DJs every weekend.',city:'Sarajevo',address:'Hamdije Kreševljakovića 3, 71000 Sarajevo',phone:'033889900',opening_hours:'Čet-Sub: 22:00-05:00',opening_hours_en:'Thu-Sat: 22:00-05:00',image:'https://images.unsplash.com/photo-1583376102242-5a6aad625ce5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkaiUyMGVsZWN0cm9uaWMlMjBtdXNpYyUyMGNsdWJ8ZW58MXx8fHwxNzczMDQ3Mzk3fDA&ixlib=rb-4.1.0&q=80&w=1080',price:'€€',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      // ── ATTRACTIONS (venue_type: other, page_slug: attractions) ×3 ──
      { page_slug:'attractions',venue_type:'other',title:'Tvrđava Kastel',title_en:'Kastel Fortress',description:'Srednjovjekovna tvrđava na obali Vrbasa. Jedna od najstarijih građevina u Banja Luci sa bogatom historijom.',description_en:'Medieval fortress on the banks of the Vrbas river. One of the oldest structures in Banja Luka with rich history.',city:'Banja Luka',address:'Kastel bb, 78000 Banja Luka',phone:'051301143',opening_hours:'Pon-Ned: 08:00-20:00',opening_hours_en:'Mon-Sun: 08:00-20:00',image:'https://images.unsplash.com/photo-1771877418824-1a8ef2b603c7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvbGQlMjB0b3duJTIwZm9ydHJlc3MlMjBjYXN0bGUlMjBhdHRyYWN0aW9ufGVufDF8fHx8MTc3MzA0NzM5NHww&ixlib=rb-4.1.0&q=80&w=1080',price:'Besplatno',price_en:'Free',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      { page_slug:'attractions',venue_type:'other',title:'Kanjon Vrbasa',title_en:'Vrbas Canyon',description:'Predivan kanjon rijeke Vrbas sa mogućnostima raftinga, kajaka i pješačenja. Prirodna ljepota na 20 minuta od centra.',description_en:'Beautiful Vrbas river canyon with rafting, kayaking and hiking opportunities. Natural beauty 20 minutes from downtown.',city:'Banja Luka',address:'Kanjon Vrbasa, Banja Luka',phone:'051301200',opening_hours:'Otvoreno 24h',opening_hours_en:'Open 24h',image:'https://images.unsplash.com/photo-1596825456493-a96b05d52c99?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyaXZlciUyMGJyaWRnZSUyMG5hdHVyZSUyMHBhcmt8ZW58MXx8fHwxNzczMDQ3Mzk0fDA&ixlib=rb-4.1.0&q=80&w=1080',price:'Besplatno',price_en:'Free',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      { page_slug:'attractions',venue_type:'other',title:'Hram Hrista Spasitelja',title_en:'Cathedral of Christ the Saviour',description:'Najveći pravoslavni hram u Banja Luci. Impresivna arhitektura i prekrasne freske u unutrašnjosti.',description_en:'The largest Orthodox cathedral in Banja Luka. Impressive architecture and beautiful interior frescoes.',city:'Banja Luka',address:'Trg srpskih vladara 1',phone:'051215302',opening_hours:'Pon-Ned: 07:00-19:00',opening_hours_en:'Mon-Sun: 07:00-19:00',image:'https://images.unsplash.com/photo-1627661086197-e1fb0e27bdce?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaHVyY2glMjBvcnRob2RveCUyMGNhdGhlZHJhbCUyMGFyY2hpdGVjdHVyZXxlbnwxfHx8fDE3NzMxNTMyMDF8MA&ixlib=rb-4.1.0&q=80&w=1080',price:'Besplatno',price_en:'Free',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      // ── CINEMA (venue_type: other, page_slug: cinema) ×3 ──
      { page_slug:'cinema',venue_type:'other',title:'Cinestar Banja Luka',title_en:'Cinestar Banja Luka',description:'Moderni multipleks bioskop sa 6 sala, 3D projekcijama i IMAX iskustvom. Najnoviji holivudski i evropski filmovi.',description_en:'Modern multiplex cinema with 6 screens, 3D projections and IMAX experience. Latest Hollywood and European movies.',city:'Banja Luka',address:'Delta Planet Mall, Zapadni tranzit bb',phone:'051999111',opening_hours:'Pon-Ned: 10:00-24:00',opening_hours_en:'Mon-Sun: 10:00-24:00',image:'https://images.unsplash.com/photo-1640127249308-098702574176?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaW5lbWElMjBtb3ZpZSUyMHRoZWF0ZXIlMjBzY3JlZW58ZW58MXx8fHwxNzczMTIyNTM4fDA&ixlib=rb-4.1.0&q=80&w=1080',price:'7-12 KM',price_en:'7-12 BAM',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      { page_slug:'cinema',venue_type:'other',title:'Kino Kozara',title_en:'Cinema Kozara',description:'Kultni bioskop u centru grada sa jednom velikom salom. Projekcije art filmova, domaćih premijera i filmskih festivala.',description_en:'Iconic downtown cinema with one large hall. Art film screenings, local premieres and film festivals.',city:'Banja Luka',address:'Kralja Petra I Karađorđevića 100',phone:'051301450',opening_hours:'Pon-Ned: 16:00-22:00',opening_hours_en:'Mon-Sun: 16:00-22:00',image:'https://images.unsplash.com/photo-1758575603664-b2233ccc6eea?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvdXRkb29yJTIwY2luZW1hJTIwbmlnaHQlMjBzY3JlZW5pbmd8ZW58MXx8fHwxNzczMTUzMTg5fDA&ixlib=rb-4.1.0&q=80&w=1080',price:'5-8 KM',price_en:'5-8 BAM',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      { page_slug:'cinema',venue_type:'other',title:'Open Air Cinema Kastel',title_en:'Open Air Cinema Kastel',description:'Ljetni bioskop na otvorenom u tvrđavi Kastel. Projekcije pod zvijezdama od juna do septembra.',description_en:'Summer open-air cinema at Kastel fortress. Screenings under the stars from June to September.',city:'Banja Luka',address:'Kastel bb',phone:'051301500',opening_hours:'Jun-Sep: 21:00-23:30',opening_hours_en:'Jun-Sep: 21:00-23:30',image:'https://images.unsplash.com/photo-1614115866447-c9a299154650?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaWxtJTIwZmVzdGl2YWwlMjBwcmVtaWVyZSUyMHJlZCUyMGNhcnBldHxlbnwxfHx8fDE3NzMxNTMxODl8MA&ixlib=rb-4.1.0&q=80&w=1080',price:'5 KM',price_en:'5 BAM',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
    ];

    const events = [
      // ── CONCERT ×3 ──
      { page_slug:'concerts',event_type:'concert',title:'Dubioza Kolektiv - Banja Luka Live',title_en:'Dubioza Kolektiv - Banja Luka Live',description:'Veliki koncert benda Dubioza Kolektiv na otvorenom. Energija, aktivizam i nezaboravni provod.',description_en:'Big open-air concert by Dubioza Kolektiv. Energy, activism and an unforgettable night out.',city:'Banja Luka',location:'Gradski stadion Banja Luka',address:'Stadionska bb',image:'https://images.unsplash.com/photo-1759893025842-2b897398dfa7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsaXZlJTIwbXVzaWMlMjBjb25jZXJ0JTIwb3V0ZG9vciUyMGNyb3dkfGVufDF8fHx8MTc3MzE1MzE5MHww&ixlib=rb-4.1.0&q=80&w=1080',price:'25 KM',price_en:'25 BAM',start_at:'2026-04-18T20:00:00.000Z',end_at:'2026-04-18T23:30:00.000Z',venue_name:'Gradski stadion',organizer_name:'BL Live Events',organizer_phone:'066123456',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      { page_slug:'concerts',event_type:'concert',title:'Jazz Night - Banja Luka Blues & Jazz',title_en:'Jazz Night - Banja Luka Blues & Jazz',description:'Internacionalni jazz festival sa muzičarima iz 10 zemalja. Dva dana vrhunske muzike na otvorenom.',description_en:'International jazz festival with musicians from 10 countries. Two days of premium open-air music.',city:'Banja Luka',location:'Kastel Fortress',address:'Kastel bb',image:'https://images.unsplash.com/photo-1763178466088-09e3678eb56b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdW1tZXIlMjBtdXNpYyUyMGZlc3RpdmFsJTIwb3V0ZG9vciUyMHN0YWdlfGVufDF8fHx8MTc3MzE1MzIwMHww&ixlib=rb-4.1.0&q=80&w=1080',price:'20 KM',price_en:'20 BAM',start_at:'2026-05-15T19:00:00.000Z',end_at:'2026-05-17T23:00:00.000Z',venue_name:'Kastel Fortress Open Air',organizer_name:'BL Jazz Fest',organizer_phone:'066556677',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      { page_slug:'concerts',event_type:'concert',title:'Demofest 2026',title_en:'Demofest 2026',description:'Najveći muzički festival u Banja Luci! Tri bine, 50+ bendova, street food i zabava za sve generacije.',description_en:'The biggest music festival in Banja Luka! Three stages, 50+ bands, street food and fun for all generations.',city:'Banja Luka',location:'Kastel Fortress',address:'Kastel bb',image:'https://images.unsplash.com/photo-1763178466088-09e3678eb56b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdW1tZXIlMjBtdXNpYyUyMGZlc3RpdmFsJTIwb3V0ZG9vciUyMHN0YWdlfGVufDF8fHx8MTc3MzE1MzIwMHww&ixlib=rb-4.1.0&q=80&w=1080',price:'Besplatno',price_en:'Free',start_at:'2026-07-17T17:00:00.000Z',end_at:'2026-07-19T02:00:00.000Z',venue_name:'Kastel Fortress',organizer_name:'Demofest Team',organizer_phone:'066789012',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      // ── THEATRE ×3 ──
      { page_slug:'theatre',event_type:'theatre',title:'Hamlet - Narodno pozorište RS',title_en:'Hamlet - National Theatre RS',description:'Klasična Šekspirova tragedija u novoj režiji. Predstava je nagrađena na festivalu u Trebinju.',description_en:'Classic Shakespeare tragedy in a new direction. Award-winning production from the Trebinje festival.',city:'Banja Luka',location:'Narodno pozorište RS',address:'Kralja Petra I Karađorđevića 78',image:'https://images.unsplash.com/photo-1767979212124-bf08504f5dae?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0aGVhdHJlJTIwc3RhZ2UlMjBwZXJmb3JtYW5jZSUyMGRyYW1hfGVufDF8fHx8MTc3MzE1MjUzNnww&ixlib=rb-4.1.0&q=80&w=1080',price:'15 KM',price_en:'15 BAM',start_at:'2026-03-22T19:00:00.000Z',end_at:'2026-03-22T21:30:00.000Z',venue_name:'Narodno pozorište RS',organizer_name:'Narodno pozorište RS',organizer_phone:'051211100',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      { page_slug:'theatre',event_type:'theatre',title:'Koštana - Stanislav Binički',title_en:'Kostana - Stanislav Binicki',description:'Muzička drama Koštana u produkciji Narodnog pozorišta. Balkanska strast i folkorna muzika.',description_en:'Musical drama Kostana produced by the National Theatre. Balkan passion and folk music.',city:'Banja Luka',location:'Narodno pozorište RS',address:'Kralja Petra I Karađorđevića 78',image:'https://images.unsplash.com/photo-1767979212124-bf08504f5dae?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0aGVhdHJlJTIwc3RhZ2UlMjBwZXJmb3JtYW5jZSUyMGRyYW1hfGVufDF8fHx8MTc3MzE1MjUzNnww&ixlib=rb-4.1.0&q=80&w=1080',price:'12 KM',price_en:'12 BAM',start_at:'2026-04-10T19:30:00.000Z',end_at:'2026-04-10T21:30:00.000Z',venue_name:'Narodno pozorište RS',organizer_name:'Narodno pozorište RS',organizer_phone:'051211100',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      { page_slug:'theatre',event_type:'theatre',title:'Standup komedija - Marko Šelić',title_en:'Standup Comedy - Marko Selic',description:'Satirični standup performans poznatog srpskog umjetnika. Humor sa stavom i porukama.',description_en:'Satirical standup performance by renowned Serbian artist. Humor with attitude and messages.',city:'Banja Luka',location:'Dom kulture',address:'Bulevar vojvode Stepe Stepanovića 12',image:'https://images.unsplash.com/photo-1762537132884-cc6bbde0667a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdGFuZHVwJTIwY29tZWR5JTIwc2hvdyUyMG1pY3JvcGhvbmV8ZW58MXx8fHwxNzczMTUzMTk0fDA&ixlib=rb-4.1.0&q=80&w=1080',price:'20 KM',price_en:'20 BAM',start_at:'2026-04-05T20:00:00.000Z',end_at:'2026-04-05T22:00:00.000Z',venue_name:'Dom kulture',organizer_name:'BL Entertainment',organizer_phone:'066334455',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      // ── EXHIBITION ×3 ──
      { page_slug:'events',event_type:'exhibition',title:'Savremena umjetnost BiH',title_en:'Contemporary Art of BiH',description:'Retrospektivna izložba savremene umjetnosti Bosne i Hercegovine. Radovi 30 umjetnika iz cijele zemlje.',description_en:'Retrospective exhibition of contemporary art from Bosnia and Herzegovina. Works by 30 artists from across the country.',city:'Banja Luka',location:'Muzej savremene umjetnosti RS',address:'Bulevar Cara Dušana 10',image:'https://images.unsplash.com/photo-1761403757058-e3c95b662a89?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcnQlMjBnYWxsZXJ5JTIwZXhoaWJpdGlvbiUyMG1vZGVybnxlbnwxfHx8fDE3NzMwNDI1MTR8MA&ixlib=rb-4.1.0&q=80&w=1080',price:'5 KM',price_en:'5 BAM',start_at:'2026-03-15T10:00:00.000Z',end_at:'2026-05-15T18:00:00.000Z',venue_name:'Muzej savremene umjetnosti RS',organizer_name:'MSURS',organizer_phone:'051301920',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      { page_slug:'events',event_type:'exhibition',title:'Fotografski salon Banja Luka',title_en:'Banja Luka Photography Salon',description:'Godišnja izložba najboljih fotografija iz regiona. Kategorije: pejzaž, portret, street i reportaža.',description_en:'Annual exhibition of the best photographs from the region. Categories: landscape, portrait, street and reportage.',city:'Banja Luka',location:'Muzej Republike Srpske',address:'Đure Daničića 1',image:'https://images.unsplash.com/photo-1771189254857-9c0d3d0c4dc7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtdXNldW0lMjBoZXJpdGFnZSUyMGJ1aWxkaW5nJTIwZXhoaWJpdHxlbnwxfHx8fDE3NzMxNTMxODh8MA&ixlib=rb-4.1.0&q=80&w=1080',price:'3 KM',price_en:'3 BAM',start_at:'2026-04-01T09:00:00.000Z',end_at:'2026-04-30T17:00:00.000Z',venue_name:'Muzej Republike Srpske',organizer_name:'Foto Klub BL',organizer_phone:'066112244',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      { page_slug:'events',event_type:'exhibition',title:'Dizajn Sedmica 2026',title_en:'Design Week 2026',description:'Festival dizajna sa predavanjima, radionicama i izložbama. Grafički, industrijski i modni dizajn.',description_en:'Design festival with talks, workshops and exhibitions. Graphic, industrial and fashion design.',city:'Banja Luka',location:'Banski dvor',address:'Trg srpskih vladara 2',image:'https://images.unsplash.com/photo-1761403757058-e3c95b662a89?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcnQlMjBnYWxsZXJ5JTIwZXhoaWJpdGlvbiUyMG1vZGVybnxlbnwxfHx8fDE3NzMwNDI1MTR8MA&ixlib=rb-4.1.0&q=80&w=1080',price:'Besplatno',price_en:'Free',start_at:'2026-05-20T10:00:00.000Z',end_at:'2026-05-25T20:00:00.000Z',venue_name:'Banski dvor',organizer_name:'BL Design',organizer_phone:'066778899',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      // ── SPORT ×3 ──
      { page_slug:'events',event_type:'sport',title:'Igokea vs Crvena Zvezda - ABA Liga',title_en:'Igokea vs Crvena Zvezda - ABA League',description:'Košarkaški derbi ABA Lige! Igokea dočekuje Crvenu Zvezdu u prepunoj Boriku.',description_en:'ABA League basketball derby! Igokea hosts Crvena Zvezda at a packed Borik arena.',city:'Banja Luka',location:'Borik Arena',address:'Bulevar Cara Dušana bb',image:'https://images.unsplash.com/photo-1771882856158-c8e083134ee3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYXNrZXRiYWxsJTIwc3BvcnQlMjBhcmVuYSUyMGdhbWV8ZW58MXx8fHwxNzczMTUzMTkzfDA&ixlib=rb-4.1.0&q=80&w=1080',price:'10-20 KM',price_en:'10-20 BAM',start_at:'2026-03-28T18:00:00.000Z',end_at:'2026-03-28T20:00:00.000Z',venue_name:'Borik Arena',organizer_name:'KK Igokea',organizer_phone:'051301400',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      { page_slug:'events',event_type:'sport',title:'FK Borac - Premijer Liga BiH',title_en:'FK Borac - BiH Premier League',description:'Utakmica Premijer lige BiH. FK Borac dočekuje rivala na gradskom stadionu.',description_en:'BiH Premier League match. FK Borac hosts their rival at the city stadium.',city:'Banja Luka',location:'Gradski stadion',address:'Stadionska bb',image:'https://images.unsplash.com/photo-1549923015-badf41b04831?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb290YmFsbCUyMHNvY2NlciUyMHN0YWRpdW0lMjBtYXRjaHxlbnwxfHx8fDE3NzMxNTMyMDB8MA&ixlib=rb-4.1.0&q=80&w=1080',price:'5-10 KM',price_en:'5-10 BAM',start_at:'2026-04-12T17:00:00.000Z',end_at:'2026-04-12T19:00:00.000Z',venue_name:'Gradski stadion',organizer_name:'FK Borac',organizer_phone:'051301600',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      { page_slug:'events',event_type:'sport',title:'Vrbas Open - Rafting Championship',title_en:'Vrbas Open - Rafting Championship',description:'Međunarodno takmičenje u raftingu na rijeci Vrbas. Ekipe iz 15 zemalja, adrenalin i spektakl na vodi.',description_en:'International rafting competition on the Vrbas river. Teams from 15 countries, adrenaline and water spectacle.',city:'Banja Luka',location:'Kanjon Vrbasa',address:'Kanjon Vrbasa, Banja Luka',image:'https://images.unsplash.com/photo-1650671061571-a19b6c6bf672?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyaXZlciUyMGNhbnlvbiUyMG5hdHVyZSUyMHBhcmt8ZW58MXx8fHwxNzczMTUzMTg4fDA&ixlib=rb-4.1.0&q=80&w=1080',price:'Besplatno',price_en:'Free',start_at:'2026-06-20T09:00:00.000Z',end_at:'2026-06-21T17:00:00.000Z',venue_name:'Kanjon Vrbasa',organizer_name:'RS Rafting Federation',organizer_phone:'066998877',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      // ── GASTRO ×3 ──
      { page_slug:'events',event_type:'gastro',title:'Street Food Festival Banja Luka',title_en:'Street Food Festival Banja Luka',description:'Festival ulične hrane sa 40+ štandova iz cijele regije. Burgeri, taco, azijska hrana, domaći specijaliteti i craft pivo.',description_en:'Street food festival with 40+ stalls from across the region. Burgers, tacos, Asian food, local specialties and craft beer.',city:'Banja Luka',location:'Trg Krajine',address:'Trg Krajine bb',image:'https://images.unsplash.com/photo-1728364283053-b1e2abe71611?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdHJlZXQlMjBmb29kJTIwbWFya2V0JTIwZmVzdGl2YWx8ZW58MXx8fHwxNzczMTUzMTkzfDA&ixlib=rb-4.1.0&q=80&w=1080',price:'Besplatno ulaz',price_en:'Free entry',start_at:'2026-06-12T11:00:00.000Z',end_at:'2026-06-14T23:00:00.000Z',venue_name:'Trg Krajine',organizer_name:'BL Food Fest',organizer_phone:'066112233',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      { page_slug:'events',event_type:'gastro',title:'Wine & Cheese Festival',title_en:'Wine & Cheese Festival',description:'Festival vina i sireva sa vinogradima iz BiH i regije. Degustacije, edukativne radionice i muzika.',description_en:'Wine and cheese festival with vineyards from BiH and the region. Tastings, educational workshops and music.',city:'Banja Luka',location:'Banski dvor',address:'Trg srpskih vladara 2',image:'https://images.unsplash.com/photo-1650903015056-4c2e63a8ce85?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3aW5lJTIwYmFyJTIwY2VsbGFyJTIwdGFzdGluZ3xlbnwxfHx8fDE3NzMwNDczOTZ8MA&ixlib=rb-4.1.0&q=80&w=1080',price:'15 KM',price_en:'15 BAM',start_at:'2026-09-05T12:00:00.000Z',end_at:'2026-09-07T22:00:00.000Z',venue_name:'Banski dvor',organizer_name:'Vino BiH',organizer_phone:'066445566',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      { page_slug:'events',event_type:'gastro',title:'Banjalučka Čorba Fest',title_en:'Banja Luka Soup Fest',description:'Takmičenje u kuvanju čorbi sa 30+ ekipa iz cijele BiH. Degustacija za posjetioce, glasanje publike za najbolju čorbu.',description_en:'Soup cooking competition with 30+ teams from all over BiH. Visitor tastings, audience voting for the best soup.',city:'Banja Luka',location:'Gradski park',address:'Gradski park bb',image:'https://images.unsplash.com/photo-1728364283053-b1e2abe71611?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdHJlZXQlMjBmb29kJTIwbWFya2V0JTIwZmVzdGl2YWx8ZW58MXx8fHwxNzczMTUzMTkzfDA&ixlib=rb-4.1.0&q=80&w=1080',price:'Besplatno',price_en:'Free',start_at:'2026-10-10T10:00:00.000Z',end_at:'2026-10-10T18:00:00.000Z',venue_name:'Gradski park',organizer_name:'Grad Banja Luka',organizer_phone:'051301700',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      // ── OTHER ×3 ──
      { page_slug:'events',event_type:'other',title:'Banja Luka Book Fair 2026',title_en:'Banja Luka Book Fair 2026',description:'Sajam knjiga sa 100+ izdavača. Promocije, potpisivanje knjiga i susreti sa piscima.',description_en:'Book fair with 100+ publishers. Promotions, book signings and meetings with authors.',city:'Banja Luka',location:'Banski dvor',address:'Trg srpskih vladara 2',image:'https://images.unsplash.com/photo-1739133086794-6424277dbfd0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxib29rc3RvcmUlMjByZWFkaW5nJTIwY296eSUyMGxpYnJhcnl8ZW58MXx8fHwxNzczMTUzMTk5fDA&ixlib=rb-4.1.0&q=80&w=1080',price:'Besplatno',price_en:'Free',start_at:'2026-11-15T10:00:00.000Z',end_at:'2026-11-20T20:00:00.000Z',venue_name:'Banski dvor',organizer_name:'Kulturni centar BL',organizer_phone:'051301800',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      { page_slug:'events',event_type:'other',title:'IT Meetup Banja Luka',title_en:'IT Meetup Banja Luka',description:'Mjesečni meetup za programere i IT profesionalce. Predavanja, networking i pizza.',description_en:'Monthly meetup for developers and IT professionals. Talks, networking and pizza.',city:'Banja Luka',location:'Innovation Centre BL',address:'Jovana Dučića 25',image:'https://images.unsplash.com/photo-1772833020822-b797f1b6ea49?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvbGQlMjB0b3duJTIwYnJpZGdlJTIwaGlzdG9yaWMlMjBsYW5kbWFya3xlbnwxfHx8fDE3NzMxNTMxOTN8MA&ixlib=rb-4.1.0&q=80&w=1080',price:'Besplatno',price_en:'Free',start_at:'2026-03-25T18:00:00.000Z',end_at:'2026-03-25T21:00:00.000Z',venue_name:'Innovation Centre BL',organizer_name:'BL Dev Community',organizer_phone:'066889900',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
      { page_slug:'events',event_type:'other',title:'Noć Muzeja 2026',title_en:'Night of Museums 2026',description:'Svi muzeji i galerije otvoreni besplatno do ponoći. Specijalni programi, vodstva i performansi.',description_en:'All museums and galleries open for free until midnight. Special programs, guided tours and performances.',city:'Banja Luka',location:'Svi muzeji u gradu',address:'Centar Banja Luka',image:'https://images.unsplash.com/photo-1771189254857-9c0d3d0c4dc7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtdXNldW0lMjBoZXJpdGFnZSUyMGJ1aWxkaW5nJTIwZXhoaWJpdHxlbnwxfHx8fDE3NzMxNTMxODh8MA&ixlib=rb-4.1.0&q=80&w=1080',price:'Besplatno',price_en:'Free',start_at:'2026-05-16T18:00:00.000Z',end_at:'2026-05-17T00:00:00.000Z',venue_name:'Svi muzeji',organizer_name:'Ministarstvo kulture RS',organizer_phone:'051301900',status:'approved',submitted_by:adminEmail,is_custom:false,source:'seed',created_at:now },
    ];

    // Whitelist: eksplicitno uzimamo samo kolone koje postoje u venues_ee0c365c shemi
    // Ovo garantuje da 'category', 'source' i bilo koji drugi nepostojeći ključ nikad ne stigne do PostgREST-a
    const VENUE_COLS = ['title','title_en','description','description_en','city','location','address','phone','website','cuisine','cuisine_en','opening_hours','opening_hours_en','price','price_en','tags','status','submitted_by','contact_name','contact_phone','contact_email','image','is_custom','venue_type','page_slug','created_at'];
    const venuesClean = venues.map((v: any) => {
      const clean: Record<string, any> = {};
      for (const f of VENUE_COLS) if (v[f] !== undefined) clean[f] = v[f];
      return clean;
    });
    const EVENT_COLS = ['title','title_en','description','description_en','city','location','address','image','price','price_en','start_at','end_at','venue_name','organizer_name','organizer_phone','event_type','page_slug','status','submitted_by','is_custom','created_at'];
    const eventsClean = events.map((e: any) => {
      const clean: Record<string, any> = {};
      for (const f of EVENT_COLS) if (e[f] !== undefined) clean[f] = e[f];
      return clean;
    });
    const { data: insertedVenues, error: venueError } = await supabase
      .from('venues_ee0c365c').insert(venuesClean).select('id, title, city, page_slug');
    if (venueError) {
      console.error('❌ Error seeding venues:', venueError);
      return c.json({ error: 'Failed to seed venues', details: venueError.message }, 500);
    }

    const { data: insertedEvents, error: eventError } = await supabase
      .from('events_ee0c365c').insert(eventsClean).select('id, title, city, event_type');
    if (eventError) {
      console.error('❌ Error seeding events:', eventError);
      return c.json({ error: 'Failed to seed events (venues OK)', details: eventError.message, venuesInserted: insertedVenues?.length || 0 }, 500);
    }

    console.log(`🌱 Seed complete: ${insertedVenues?.length} venues + ${insertedEvents?.length} events`);
    return c.json({ success: true, venuesInserted: insertedVenues?.length || 0, eventsInserted: insertedEvents?.length || 0, venues: insertedVenues, events: insertedEvents });
  } catch (error) {
    console.error('❌ Seed error:', error);
    return c.json({ error: 'Seed failed', details: String(error) }, 500);
  }
});

// ===================================
// 🌍 SEED REGIONAL (ex-YU, outside BiH)
// ===================================
app.post('/make-server-a0e1e9cb/seed-regional', async (c) => {
  console.log('🌍 POST /seed-regional');
  try {
    const token = getTokenFromRequest(c);
    if (!token) return c.json({ error: 'Unauthorized' }, 401);
    const { data: { user: au } } = await safeGetUser(sbService(), token);
    if (!au) return c.json({ error: 'Unauthorized' }, 401);
    if (!(au.user_metadata?.is_master_admin === true || au.email === MASTER_ADMIN_EMAIL))
      return c.json({ error: 'Only master admin' }, 403);
    const sb = sbService(), em = au.email||MASTER_ADMIN_EMAIL, ts = new Date().toISOString(); // service role bypasses RLS
    const s = 'approved', src = ''; // src se koristi u obj literalima ali strip-a u vClean/evClean
    const v = [
      {category:'food-and-drink',title:'Dva Jelena',title_en:'Two Deer',description:'Legendarna kafana na Skadarliji sa više od 100 godina tradicije. Srpska kuhinja, živa muzika i nezaboravan ambijent.',description_en:'Legendary tavern on Skadarlija with over 100 years of tradition. Serbian cuisine, live music and unforgettable atmosphere.',city:'Beograd',address:'Skadarska 32, 11000 Beograd',phone:'+381112343885',cuisine:'Srpska, Tradicionalna',cuisine_en:'Serbian, Traditional',opening_hours:'Pon-Ned: 10:00-01:00',opening_hours_en:'Mon-Sun: 10:00-01:00',image:'https://images.unsplash.com/photo-1689245780587-a9a6725718b1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzZXJiaWFuJTIwdHJhZGl0aW9uYWwlMjBmb29kJTIwcGxhdHRlcnxlbnwxfHx8fDE3NzMwNDgzOTZ8MA&ixlib=rb-4.1.0&q=80&w=1080',price:'€€',status:s,submitted_by:em,is_custom:false,source:src,created_at:ts},
      {category:'food-and-drink',title:'Restoran Franš',title_en:'Restaurant Frans',description:'Fine dining restoran u centru Beograda. Francusko-srpska fuzija sa sezonskim menijem i vrhunskom vinskom kartom.',description_en:'Fine dining in central Belgrade. French-Serbian fusion with seasonal menu and premium wine list.',city:'Beograd',address:'Bul. Kralja Aleksandra 43, Beograd',phone:'+381113240944',cuisine:'Francuska, Fuzija',cuisine_en:'French, Fusion',opening_hours:'Pon-Sub: 12:00-24:00',opening_hours_en:'Mon-Sat: 12:00-24:00',image:'https://images.unsplash.com/photo-1759686127423-ebdd5955a3a6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZWxncmFkZSUyMG5pZ2h0bGlmZSUyMHJlc3RhdXJhbnQlMjBzZXJiaWF8ZW58MXx8fHwxNzczMDQ4MzkzfDA&ixlib=rb-4.1.0&q=80&w=1080',price:'€€€',status:s,submitted_by:em,is_custom:false,source:src,created_at:ts},
      {category:'clubs',title:'Freestyler',title_en:'Freestyler',description:'Ikona beogradskog noćnog života — splav na Savi. House, R&B i gostujući DJ-evi iz cijelog svijeta.',description_en:'Icon of Belgrade nightlife — floating club on the Sava. House, R&B and guest DJs from around the world.',city:'Beograd',address:'Beton Hala, Karađorđeva bb',phone:'+381112345678',opening_hours:'Pet-Sub: 23:00-06:00',opening_hours_en:'Fri-Sat: 23:00-06:00',image:'https://images.unsplash.com/photo-1717570564507-2c80a6e8181a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZWxncmFkZSUyMGZsb2F0aW5nJTIwcml2ZXIlMjBjbHVifGVufDF8fHx8MTc3MzA0ODM5N3ww&ixlib=rb-4.1.0&q=80&w=1080',price:'€€',status:s,submitted_by:em,is_custom:false,source:src,created_at:ts},
      {category:'cafes',title:'Kafeterija Beograd',title_en:'Kafeterija Belgrade',description:'Hipsterska kafa u industrijskom ambijentu Dorćola. Specialty espresso, cold brew i domaće pecivo.',description_en:'Hipster coffee in Dorcol industrial setting. Specialty espresso, cold brew and homemade pastries.',city:'Beograd',address:'Dobračina 16, Beograd',phone:'+381113456789',cuisine:'Specialty kafa',cuisine_en:'Specialty coffee',opening_hours:'Pon-Ned: 08:00-22:00',opening_hours_en:'Mon-Sun: 08:00-22:00',image:'https://images.unsplash.com/photo-1634547813427-8f051eb6a872?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0dXJraXNoJTIwY29mZmVlJTIwdHJhZGl0aW9uYWwlMjBjb3BwZXJ8ZW58MXx8fHwxNzczMDQ4NDAxfDA&ixlib=rb-4.1.0&q=80&w=1080',price:'€',status:s,submitted_by:em,is_custom:false,source:src,created_at:ts},
      {category:'food-and-drink',title:'Toster Bar',title_en:'Toster Bar',description:'Urban restoran u centru Novog Sada. Burgeri, sendviči i kokteli u retro ambijentu.',description_en:'Urban restaurant in central Novi Sad. Burgers, sandwiches and cocktails in retro setting.',city:'Novi Sad',address:'Jevrejska 21, 21000 Novi Sad',phone:'+381214567890',cuisine:'Moderna, Street food',cuisine_en:'Modern, Street food',opening_hours:'Pon-Ned: 10:00-24:00',opening_hours_en:'Mon-Sun: 10:00-24:00',image:'https://images.unsplash.com/photo-1581949882446-58884cf7ef88?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtZWRpdGVycmFuZWFuJTIwZ3JpbGxlZCUyMG1lYXQlMjBzdGVha2hvdXNlfGVufDF8fHx8MTc3MzA0ODM5OHww&ixlib=rb-4.1.0&q=80&w=1080',price:'€€',status:s,submitted_by:em,is_custom:false,source:src,created_at:ts},
      {category:'attractions',title:'Petrovaradinska tvrđava',title_en:'Petrovaradin Fortress',description:'Monumentalna tvrđava na Dunavu, dom EXIT festivala. Galerije, ateljei i panoramski pogled.',description_en:'Monumental fortress on the Danube, home of EXIT festival. Galleries, ateliers and panoramic views.',city:'Novi Sad',address:'Petrovaradin, 21131 Novi Sad',phone:'+381216344555',opening_hours:'Otvoreno 24h',opening_hours_en:'Open 24h',image:'https://images.unsplash.com/photo-1766777597740-95eab74cd764?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxub3ZpJTIwc2FkJTIwZm9ydHJlc3MlMjBkYW51YmUlMjByaXZlcnxlbnwxfHx8fDE3NzMwNDgzOTR8MA&ixlib=rb-4.1.0&q=80&w=1080',price:'Besplatno',price_en:'Free',status:s,submitted_by:em,is_custom:false,source:src,created_at:ts},
      {category:'food-and-drink',title:'Vinodol',title_en:'Vinodol',description:'Tradicijski restoran u srcu Zagreba sa unutrašnjim dvorištem. Domaća hrvatska kuhinja i vinska karta.',description_en:'Traditional restaurant in Zagreb with inner courtyard. Croatian cuisine and wine list.',city:'Zagreb',address:'Nikole Tesle 10, 10000 Zagreb',phone:'+38514811427',cuisine:'Hrvatska, Mediteranska',cuisine_en:'Croatian, Mediterranean',opening_hours:'Pon-Ned: 11:00-24:00',opening_hours_en:'Mon-Sun: 11:00-24:00',image:'https://images.unsplash.com/photo-1772190576978-b43f586efbcb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx6YWdyZWIlMjBjcm9hdGlhJTIwaGlzdG9yaWMlMjBjYWZlfGVufDF8fHx8MTc3MzA0ODM5NHww&ixlib=rb-4.1.0&q=80&w=1080',price:'€€€',status:s,submitted_by:em,is_custom:false,source:src,created_at:ts},
      {category:'cafes',title:'Cogito Coffee',title_en:'Cogito Coffee',description:'Specialty coffee shop u Zagrebu. Single origin kafa i edukativni pristup svakoj šalici.',description_en:'Specialty coffee shop in Zagreb. Single origin and educational approach to every cup.',city:'Zagreb',address:'Varšavska 11, 10000 Zagreb',phone:'+38514834079',cuisine:'Specialty kafa',cuisine_en:'Specialty coffee',opening_hours:'Pon-Sub: 07:30-21:00',opening_hours_en:'Mon-Sat: 07:30-21:00',image:'https://images.unsplash.com/photo-1752606301350-4a8e3a8ed9e3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnZWxhdG8lMjBpY2UlMjBjcmVhbSUyMHNob3AlMjBjb2xvcmZ1bHxlbnwxfHx8fDE3NzMwNDg0MDF8MA&ixlib=rb-4.1.0&q=80&w=1080',price:'€€',status:s,submitted_by:em,is_custom:false,source:src,created_at:ts},
      {category:'food-and-drink',title:'Konoba Matejuška',title_en:'Konoba Matejuska',description:'Dalmatinska konoba tik uz more. Svježa riba, hobotnica ispod peke i lokalna vina.',description_en:'Dalmatian tavern by the sea. Fresh fish, octopus under peka and local wines.',city:'Split',address:'Tome Stržića 3, 21000 Split',phone:'+385213456789',cuisine:'Dalmatinska, Riblja',cuisine_en:'Dalmatian, Seafood',opening_hours:'Pon-Ned: 11:00-23:00',opening_hours_en:'Mon-Sun: 11:00-23:00',image:'https://images.unsplash.com/photo-1515594848784-7a3f98e75f86?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzcGxpdCUyMGRhbG1hdGlhbiUyMHNlYWZvb2QlMjB0ZXJyYWNlfGVufDF8fHx8MTc3MzA0ODM5NHww&ixlib=rb-4.1.0&q=80&w=1080',price:'€€',status:s,submitted_by:em,is_custom:false,source:src,created_at:ts},
      {category:'attractions',title:'Dioklecijanova palača',title_en:'Diocletian Palace',description:'UNESCO — rimska palača u srcu Splita. Živi antički spomenik sa restoranima i muzejima.',description_en:'UNESCO — Roman palace in Split. Living ancient monument with restaurants and museums.',city:'Split',address:'Dioklecijanova ul., 21000 Split',phone:'+385215678901',opening_hours:'Otvoreno 24h',opening_hours_en:'Open 24h',image:'https://images.unsplash.com/photo-1698181358897-e4869d6a3a0a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkdWJyb3ZuaWslMjBjcm9hdGlhJTIwaGlzdG9yaWMlMjB3YWxsc3xlbnwxfHx8fDE3NzMwNDg0MDF8MA&ixlib=rb-4.1.0&q=80&w=1080',price:'Besplatno',price_en:'Free',status:s,submitted_by:em,is_custom:false,source:src,created_at:ts},
      {category:'food-and-drink',title:'Pod Volat',title_en:'Pod Volat',description:'Tradicionalni crnogorski restoran. Njeguška pršuta, kačamak i vranac u autentičnom ambijentu.',description_en:'Traditional Montenegrin restaurant. Njeguski prosciutto, kacamak and vranac in authentic ambiance.',city:'Podgorica',address:'Trg V. B. Osmanagića 1, 81000 Podgorica',phone:'+38220234567',cuisine:'Crnogorska',cuisine_en:'Montenegrin',opening_hours:'Pon-Ned: 09:00-23:00',opening_hours_en:'Mon-Sun: 09:00-23:00',image:'https://images.unsplash.com/photo-1771402473322-93a818279b62?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwb2Rnb3JpY2ElMjBtb250ZW5lZ3JvJTIwbW9kZXJuJTIwcmVzdGF1cmFudHxlbnwxfHx8fDE3NzMwNDgzOTV8MA&ixlib=rb-4.1.0&q=80&w=1080',price:'€€',status:s,submitted_by:em,is_custom:false,source:src,created_at:ts},
      {category:'attractions',title:'Stari grad Kotor',title_en:'Kotor Old Town',description:'UNESCO stari grad sa tvrđavom iznad Bokokotorskog zaliva. Venecijanska arhitektura i zadivljujući pogled.',description_en:'UNESCO old town with fortress above Bay of Kotor. Venetian architecture and breathtaking views.',city:'Kotor',address:'Stari Grad, 85330 Kotor',phone:'+38232325950',opening_hours:'Otvoreno 24h',opening_hours_en:'Open 24h',image:'https://images.unsplash.com/photo-1700549586671-6d5868866337?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxrb3RvciUyMG1vbnRlbmVncm8lMjBvbGQlMjB0b3duJTIwYmF5fGVufDF8fHx8MTc3MzA0ODQwMHww&ixlib=rb-4.1.0&q=80&w=1080',price:'8€',price_en:'8€',status:s,submitted_by:em,is_custom:false,source:src,created_at:ts},
      {category:'food-and-drink',title:'Galion',title_en:'Galion',description:'Luksuzni restoran na obali Bokokotorskog zaliva. Svježi morski plodovi i pogled koji oduzima dah.',description_en:'Luxury restaurant on Bay of Kotor shores. Fresh seafood and breathtaking views.',city:'Kotor',address:'Šuranj bb, 85330 Kotor',phone:'+38232325054',cuisine:'Mediteranska, Riblja',cuisine_en:'Mediterranean, Seafood',opening_hours:'Pon-Ned: 11:00-24:00',opening_hours_en:'Mon-Sun: 11:00-24:00',image:'https://images.unsplash.com/photo-1728327510164-04538fb967ee?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhZHJpYXRpYyUyMGNvYXN0JTIwc3Vuc2V0JTIwZGluaW5nfGVufDF8fHx8MTc3MzA0ODM5OHww&ixlib=rb-4.1.0&q=80&w=1080',price:'€€€',status:s,submitted_by:em,is_custom:false,source:src,created_at:ts},
      {category:'food-and-drink',title:'Stara Kuka',title_en:'Stara Kuka',description:'Restoran u osmanskoj kući u Starom Bazaru. Makedonska kuhinja, tavče gravče i lokalna rakija.',description_en:'Restaurant in Ottoman house in Old Bazaar. Macedonian cuisine, tavce gravce and local rakija.',city:'Skoplje',address:'Stara Čaršija, 1000 Skopje',phone:'+38923456789',cuisine:'Makedonska',cuisine_en:'Macedonian',opening_hours:'Pon-Ned: 10:00-23:00',opening_hours_en:'Mon-Sun: 10:00-23:00',image:'https://images.unsplash.com/photo-1641950075479-9b46d178ee64?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxza29wamUlMjBtYWNlZG9uaWElMjBvbGQlMjBiYXphYXJ8ZW58MXx8fHwxNzczMDQ4Mzk2fDA&ixlib=rb-4.1.0&q=80&w=1080',price:'€',status:s,submitted_by:em,is_custom:false,source:src,created_at:ts},
      {category:'food-and-drink',title:'Gostilna Dela',title_en:'Gostilna Dela',description:'Moderni slovenski restoran na obali Ljubljanice. Sezonski meni i lokalni proizvodi.',description_en:'Modern Slovenian restaurant on Ljubljanica riverbank. Seasonal menu and local produce.',city:'Ljubljana',address:'Petkovškovo nabrežje 65, 1000 Ljubljana',phone:'+38612345678',cuisine:'Slovenska, Moderna',cuisine_en:'Slovenian, Modern',opening_hours:'Pon-Sub: 11:00-22:00',opening_hours_en:'Mon-Sat: 11:00-22:00',image:'https://images.unsplash.com/photo-1640024038740-45671e324c7e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsanVibGphbmElMjBzbG92ZW5pYSUyMHJpdmVyJTIwY2FmZXxlbnwxfHx8fDE3NzMwNDgzOTZ8MA&ixlib=rb-4.1.0&q=80&w=1080',price:'€€€',status:s,submitted_by:em,is_custom:false,source:src,created_at:ts},
    ];
    const ev = [
      {category:'events',event_type:'concert',title:'Bajaga i Instruktori - Beogradska Arena',title_en:'Bajaga i Instruktori - Belgrade Arena',description:'Veliki koncert legendarnog benda. Hitovi svih vremena pred 20.000 fanova.',description_en:'Grand concert by legendary band. All-time hits in front of 20,000 fans.',city:'Beograd',location:'Stark Arena',address:'Bul. A. Čarnojevića 58, Beograd',image:'https://images.unsplash.com/photo-1593291785451-6525ceb1a345?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb2xrJTIwbXVzaWMlMjBiYWxrYW4lMjB0cmFkaXRpb25hbCUyMGJhbmR8ZW58MXx8fHwxNzczMDQ4Mzk4fDA&ixlib=rb-4.1.0&q=80&w=1080',price:'2500 RSD',price_en:'~21€',start_at:'2026-05-09T20:00:00.000Z',end_at:'2026-05-09T23:00:00.000Z',venue_name:'Stark Arena',organizer_name:'Live Nation Srbija',organizer_phone:'+381112345678',status:s,submitted_by:em,is_custom:false,source:src,created_at:ts},
      {category:'events',event_type:'sport',title:'Crvena Zvezda vs Partizan - Vječiti derbi',title_en:'Crvena Zvezda vs Partizan - Eternal Derby',description:'Najvatreniji fudbalski derbi na Balkanu na Marakani!',description_en:'The fiercest football derby in the Balkans at Marakana!',city:'Beograd',location:'Marakana',address:'Ljutice Bogdana 1a, Beograd',image:'https://images.unsplash.com/photo-1549923015-badf41b04831?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzb2NjZXIlMjBmb290YmFsbCUyMHN0YWRpdW0lMjBjcm93ZHxlbnwxfHx8fDE3NzMwNDg0MDB8MA&ixlib=rb-4.1.0&q=80&w=1080',price:'500-3000 RSD',price_en:'~4-25€',start_at:'2026-04-12T18:00:00.000Z',end_at:'2026-04-12T20:00:00.000Z',venue_name:'Marakana',organizer_name:'FK Crvena Zvezda',organizer_phone:'+381112067800',status:s,submitted_by:em,is_custom:false,source:src,created_at:ts},
      {category:'events',event_type:'other',title:'Belgrade Underground Techno Night',title_en:'Belgrade Underground Techno Night',description:'Beogradska techno scena u napuštenom industrijskom prostoru.',description_en:'Belgrade techno scene in abandoned industrial space.',city:'Beograd',location:'Drugstore Club',address:'Bul. Despota Stefana 115',image:'https://images.unsplash.com/photo-1588503291572-6b60107fe000?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZWNobm8lMjByYXZlJTIwcGFydHklMjB1bmRlcmdyb3VuZHxlbnwxfHx8fDE3NzMwNDgzOTl8MA&ixlib=rb-4.1.0&q=80&w=1080',price:'1000 RSD',price_en:'~8€',start_at:'2026-03-21T23:00:00.000Z',end_at:'2026-03-22T07:00:00.000Z',venue_name:'Drugstore Club',organizer_name:'Underground BG',organizer_phone:'+381601234567',status:s,submitted_by:em,is_custom:false,source:src,created_at:ts},
      {category:'events',event_type:'concert',title:'EXIT Festival 2026',title_en:'EXIT Festival 2026',description:'Jedan od najvećih festivala u Evropi! 4 dana, 40+ bina, 200+ izvođača.',description_en:'One of Europe biggest festivals! 4 days, 40+ stages, 200+ performers.',city:'Novi Sad',location:'Petrovaradinska tvrđava',address:'Petrovaradin, 21131 Novi Sad',image:'https://images.unsplash.com/photo-1703806914338-a18ed6066f74?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxleGl0JTIwZmVzdGl2YWwlMjBub3ZpJTIwc2FkJTIwc3RhZ2V8ZW58MXx8fHwxNzczMDQ4Mzk3fDA&ixlib=rb-4.1.0&q=80&w=1080',price:'75€',price_en:'75€ (4-day)',start_at:'2026-07-09T16:00:00.000Z',end_at:'2026-07-12T06:00:00.000Z',venue_name:'Petrovaradinska tvrđava',organizer_name:'EXIT Foundation',organizer_phone:'+381214567890',status:s,submitted_by:em,is_custom:false,source:src,created_at:ts},
      {category:'events',event_type:'exhibition',title:'MSU Zagreb - Retrospektiva',title_en:'MSU Zagreb - Retrospective',description:'Retrospektiva hrvatskih suvremenih umjetnika. Instalacije, video art i performansi.',description_en:'Retrospective of Croatian contemporary artists. Installations, video art and performances.',city:'Zagreb',location:'MSU Zagreb',address:'Av. Dubrovnik 17, 10000 Zagreb',image:'https://images.unsplash.com/photo-1527979809431-ea3d5c0c01c9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxldXJvcGVhbiUyMGZpbG0lMjBmZXN0aXZhbCUyMG91dGRvb3IlMjBzY3JlZW5pbmd8ZW58MXx8fHwxNzczMDQ4Mzk5fDA&ixlib=rb-4.1.0&q=80&w=1080',price:'5€',price_en:'5€',start_at:'2026-04-01T10:00:00.000Z',end_at:'2026-06-30T20:00:00.000Z',venue_name:'MSU Zagreb',organizer_name:'MSU',organizer_phone:'+38516052700',status:s,submitted_by:em,is_custom:false,source:src,created_at:ts},
      {category:'events',event_type:'concert',title:'INmusic Festival 2026',title_en:'INmusic Festival 2026',description:'Najpoznatiji hrvatski open-air festival na Jarunu. Internacionalne zvijezde.',description_en:'Croatia most famous open-air festival at Jarun Lake. International stars.',city:'Zagreb',location:'Jarun - Otok mladosti',address:'Otok hrvatske mladeži, Zagreb',image:'https://images.unsplash.com/photo-1703806914338-a18ed6066f74?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxleGl0JTIwZmVzdGl2YWwlMjBub3ZpJTIwc2FkJTIwc3RhZ2V8ZW58MXx8fHwxNzczMDQ4Mzk3fDA&ixlib=rb-4.1.0&q=80&w=1080',price:'55€',price_en:'55€',start_at:'2026-06-22T14:00:00.000Z',end_at:'2026-06-24T02:00:00.000Z',venue_name:'Jarun',organizer_name:'INmusic',organizer_phone:'+38516111222',status:s,submitted_by:em,is_custom:false,source:src,created_at:ts},
      {category:'events',event_type:'concert',title:'Sea Dance Festival - Budva',title_en:'Sea Dance Festival - Budva',description:'Beach festival na plaži Jaz. Elektronska i pop muzika uz Jadransko more.',description_en:'Beach festival at Jaz. Electronic and pop music by the Adriatic.',city:'Budva',location:'Plaža Jaz',address:'Jaz Beach, 85310 Budva',image:'https://images.unsplash.com/photo-1728327510164-04538fb967ee?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhZHJpYXRpYyUyMGNvYXN0JTIwc3Vuc2V0JTIwZGluaW5nfGVufDF8fHx8MTc3MzA0ODM5OHww&ixlib=rb-4.1.0&q=80&w=1080',price:'40€',price_en:'40€',start_at:'2026-08-28T17:00:00.000Z',end_at:'2026-08-30T04:00:00.000Z',venue_name:'Plaža Jaz',organizer_name:'EXIT Foundation',organizer_phone:'+382691234567',status:s,submitted_by:em,is_custom:false,source:src,created_at:ts},
      {category:'events',event_type:'gastro',title:'Skopje Food Festival',title_en:'Skopje Food Festival',description:'Festival hrane iz Makedonije i Balkana. Kuharska takmičenja i degustacije.',description_en:'Food fest from Macedonia and Balkans. Cooking competitions and tastings.',city:'Skoplje',location:'Gradski park',address:'City Park, 1000 Skopje',image:'https://images.unsplash.com/photo-1641950075479-9b46d178ee64?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxza29wamUlMjBtYWNlZG9uaWElMjBvbGQlMjBiYXphYXJ8ZW58MXx8fHwxNzczMDQ4Mzk2fDA&ixlib=rb-4.1.0&q=80&w=1080',price:'Besplatno',price_en:'Free',start_at:'2026-09-05T11:00:00.000Z',end_at:'2026-09-07T22:00:00.000Z',venue_name:'Gradski park',organizer_name:'Skopje Tourism',organizer_phone:'+38923111222',status:s,submitted_by:em,is_custom:false,source:src,created_at:ts},
      {category:'events',event_type:'theatre',title:'Borštnikovo srečanje 2026',title_en:'Borstnik Meeting 2026',description:'Najprestižniji pozorišni festival u Sloveniji. Gostujuće trupe iz cijele regije.',description_en:'Most prestigious theatre festival in Slovenia. Guest troupes from the region.',city:'Ljubljana',location:'SNG Drama Ljubljana',address:'Erjavčeva 1, 1000 Ljubljana',image:'https://images.unsplash.com/photo-1527979809431-ea3d5c0c01c9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxldXJvcGVhbiUyMGZpbG0lMjBmZXN0aXZhbCUyMG91dGRvb3IlMjBzY3JlZW5pbmd8ZW58MXx8fHwxNzczMDQ4Mzk5fDA&ixlib=rb-4.1.0&q=80&w=1080',price:'15€',price_en:'15€',start_at:'2026-10-10T19:00:00.000Z',end_at:'2026-10-17T22:00:00.000Z',venue_name:'SNG Drama',organizer_name:'SNG Drama Ljubljana',organizer_phone:'+38612521511',status:s,submitted_by:em,is_custom:false,source:src,created_at:ts},
    ];
    // Whitelist + category→page_slug konverzija za regionalne podatke
    const V_COLS = ['title','title_en','description','description_en','city','location','address','phone','website','cuisine','cuisine_en','opening_hours','opening_hours_en','price','price_en','tags','status','submitted_by','contact_name','contact_phone','contact_email','image','is_custom','venue_type','page_slug','created_at'];
    const vClean = v.map((x: any) => {
      const obj: Record<string,any> = { page_slug: x.category }; // category → page_slug
      for (const f of V_COLS) if (f !== 'page_slug' && x[f] !== undefined) obj[f] = x[f];
      return obj;
    });
    const EV_COLS = ['title','title_en','description','description_en','city','location','address','image','price','price_en','start_at','end_at','venue_name','organizer_name','organizer_phone','event_type','page_slug','status','submitted_by','is_custom','created_at'];
    const REG_EVENT_TYPE_TO_PAGE_SLUG: Record<string, string> = {
      concert: 'concerts', festival: 'concerts', music: 'concerts',
      theatre: 'theatre', standup: 'theatre',
      cinema: 'cinema',
      club: 'clubs',
      exhibition: 'events', sport: 'events',
      gastro: 'events', conference: 'events',
      workshop: 'events', kids: 'events',
      other: 'events',
    };
    const evClean = ev.map((x: any) => {
      const obj: Record<string,any> = {
        page_slug: x.page_slug || (x.event_type ? REG_EVENT_TYPE_TO_PAGE_SLUG[x.event_type] : null) || 'events',
      };
      for (const f of EV_COLS) if (f !== 'page_slug' && x[f] !== undefined) obj[f] = x[f];
      return obj;
    });
    const { data: iv, error: ve } = await sb.from('venues_ee0c365c').insert(vClean).select('id, title, city, page_slug');
    if (ve) { console.error('❌ Regional venues error:', ve); return c.json({ error: ve.message }, 500); }
    const { data: ie, error: ee } = await sb.from('events_ee0c365c').insert(evClean).select('id, title, city, event_type');
    if (ee) { console.error('❌ Regional events error:', ee); return c.json({ error: ee.message, venuesInserted: iv?.length||0 }, 500); }
    console.log(`🌍 Regional seed: ${iv?.length} venues + ${ie?.length} events`);
    return c.json({ success:true, venuesInserted:iv?.length||0, eventsInserted:ie?.length||0, venues:iv, events:ie });
  } catch (error) {
    console.error('❌ Regional seed error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ===================================
// 🗑️ CLEAR ALL DATA (master admin only)
// ===================================
app.post('/make-server-a0e1e9cb/clear-all', async (c) => {
  console.log('🗑️ POST /clear-all - Deleting all venues and events');
  try {
    const token = getTokenFromRequest(c);
    if (!token) return c.json({ error: 'Unauthorized' }, 401);
    const supabase = sbService();
    const { data: { user: authUser }, error: authError } = await safeGetUser(supabase, token);
    if (authError || !authUser) return c.json({ error: 'Unauthorized' }, 401);
    const isMaster = authUser.user_metadata?.is_master_admin === true || authUser.email === MASTER_ADMIN_EMAIL;
    if (!isMaster) return c.json({ error: 'Only master admin can clear data' }, 403);

    // Koristimo service role (sbService) da zaobiđemo RLS pri brisanju
    const sb = sbService();

    const { error: venueErr } = await sb
      .from('venues_ee0c365c')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (venueErr) {
      console.error('❌ Error clearing venues:', venueErr);
      return c.json({ error: 'Failed to clear venues', details: venueErr.message }, 500);
    }

    const { error: eventErr } = await sb
      .from('events_ee0c365c')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (eventErr) {
      console.error('❌ Error clearing events:', eventErr);
      return c.json({ error: 'Failed to clear events', details: eventErr.message }, 500);
    }

    console.log('🗑️ All venues and events cleared');
    return c.json({ success: true, venuesDeleted: 'all', eventsDeleted: 'all' });
  } catch (error) {
    console.error('❌ Clear error:', error);
    return c.json({ error: 'Clear failed', details: String(error) }, 500);
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