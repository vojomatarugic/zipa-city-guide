/**
 * Auth Service - Sign up, Login, Logout
 */

import { supabase } from './supabaseClient';
import { projectId, publicAnonKey } from './supabase/info';
import { getApiBase, apiUrl } from '../config/apiBase';
import { getSupabaseAuthRedirectTo } from './authRedirect';
import { normalizeUserChosenName, resolvedDisplayNameFromSources } from './userDisplay';

const SUPABASE_URL = `https://${projectId}.supabase.co`;

/** Profile PATCH succeeded but the client session could not be refreshed (e.g. after password change). */
export class ProfileUpdateSessionLostError extends Error {
  constructor() {
    super('PROFILE_UPDATE_SESSION_LOST');
    this.name = 'ProfileUpdateSessionLostError';
  }
}

/** Profile hydration — Edge Function only (no browser `supabase.from('profiles')`). */
const PROFILE_ME_URL = `${SUPABASE_URL}/functions/v1/make-server-a0e1e9cb/users/me/profile`;

// ✅ Export supabase for auth listeners
export { supabase };

// ✅ Last login method storage
const LAST_LOGIN_METHOD_KEY = 'blguide_last_login_method';
const LAST_LOGIN_EMAIL_KEY = 'blguide_last_login_email';
const LAST_LOGIN_NAME_KEY = 'blguide_last_login_name';
const LAST_LOGIN_AVATAR_KEY = 'blguide_last_login_avatar';

export type LoginMethod = 'email' | 'google' | 'facebook' | 'apple';

export interface LastLoginInfo {
  method: LoginMethod;
  email?: string;
  name?: string;
  avatar?: string;
}

export function getLastLoginInfo(): LastLoginInfo | null {
  try {
    const method = localStorage.getItem(LAST_LOGIN_METHOD_KEY) as LoginMethod | null;
    if (!method) return null;
    return {
      method,
      email: localStorage.getItem(LAST_LOGIN_EMAIL_KEY) || undefined,
      name: localStorage.getItem(LAST_LOGIN_NAME_KEY) || undefined,
      avatar: localStorage.getItem(LAST_LOGIN_AVATAR_KEY) || undefined,
    };
  } catch {
    return null;
  }
}

export function saveLastLoginInfo(info: LastLoginInfo): void {
  try {
    localStorage.setItem(LAST_LOGIN_METHOD_KEY, info.method);
    if (info.email) localStorage.setItem(LAST_LOGIN_EMAIL_KEY, info.email);
    if (info.name) localStorage.setItem(LAST_LOGIN_NAME_KEY, info.name);
    if (info.avatar) localStorage.setItem(LAST_LOGIN_AVATAR_KEY, info.avatar);
  } catch {
    // localStorage not available
  }
}

export function clearLastLoginInfo(): void {
  try {
    localStorage.removeItem(LAST_LOGIN_METHOD_KEY);
    localStorage.removeItem(LAST_LOGIN_EMAIL_KEY);
    localStorage.removeItem(LAST_LOGIN_NAME_KEY);
    localStorage.removeItem(LAST_LOGIN_AVATAR_KEY);
  } catch {
    // localStorage not available
  }
}

export type AppRole = 'user' | 'admin' | 'master_admin';

export function normalizeAppRole(value: unknown): AppRole {
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'master_admin') return 'master_admin';
    if (v === 'admin') return 'admin';
    if (v === 'user') return 'user';
  }
  if (value === 'master_admin' || value === 'admin' || value === 'user') return value;
  return 'user';
}

export interface User {
  id: string;
  email: string;
  name?: string;
  /** From `profiles.role` — single source of truth */
  role: AppRole;
  phone?: string;
  profileImage?: string;
}

type ProfileRow = {
  id: string;
  email?: string | null;
  role?: unknown;
  /** App override in GoTrue `user_metadata` (not a DB column); returned by GET users/me/profile. */
  display_name?: string | null;
  name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
};

/**
 * GET profile row from Edge (`public.profiles` via service role on server).
 * @throws On missing token, network error, non-OK HTTP, invalid JSON, or id mismatch.
 */
async function fetchProfileRowFromEdgeApi(userId: string, access_token: string): Promise<ProfileRow | null> {
  let res: Response;
  try {
    res = await fetch(PROFILE_ME_URL, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${access_token}`,
        /** Required by Supabase Functions gateway for browser invocations (anon key, not the user JWT). */
        apikey: publicAnonKey,
        /** Gateway may replace Authorization with the anon JWT; Edge reads user JWT from here first. */
        'x-auth-token': access_token,
      },
    });
  } catch (err) {
    console.error('[PROFILE API] Network error calling users/me/profile', err);
    throw new Error(
      `[PROFILE API] Network error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const text = await res.text();
  let json: { profile?: ProfileRow | null; error?: string; code?: number; details?: string } = {};
  try {
    json = text ? (JSON.parse(text) as typeof json) : {};
  } catch (err) {
    console.error('[PROFILE API] Non-JSON response', { status: res.status, snippet: text?.slice(0, 400) });
    throw new Error(`[PROFILE API] Invalid JSON (${res.status})`);
  }

  const profile = (json.profile ?? null) as ProfileRow | null;
  console.log('[PROFILE API RESULT]', profile);

  if (!res.ok) {
    const detail = json.error || json.details || res.statusText;
    console.error('[PROFILE API] users/me/profile failed (session is unchanged in caller)', {
      status: res.status,
      error: json.error,
      code: json.code,
      details: json.details,
    });
    throw new Error(`[PROFILE API] HTTP ${res.status}: ${detail}`);
  }

  if (profile && profile.id !== userId) {
    console.error('[PROFILE API] profile.id does not match session', { expected: userId, got: profile.id });
    throw new Error('[PROFILE API] profile id mismatch');
  }

  return profile;
}

/** Resolve `User.name` from GoTrue `user_metadata` + email (used before profile merge and in AuthContext fallbacks). */
export function displayNameFromSessionMetadata(
  userMetadata: Record<string, unknown> | null | undefined,
  email: string,
): string | undefined {
  const s = resolvedDisplayNameFromSources({
    display_name: userMetadata?.display_name != null ? String(userMetadata.display_name) : undefined,
    name: userMetadata?.name != null ? String(userMetadata.name) : undefined,
    full_name: userMetadata?.full_name != null ? String(userMetadata.full_name) : undefined,
    email,
  });
  const t = String(s ?? '').trim();
  return normalizeUserChosenName(t) ?? (t || undefined);
}

async function ensureProfileRowExists(base: User): Promise<void> {
  try {
    await fetch(`${getApiBase()}/users/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({
        userId: base.id,
        email: base.email,
        oldEmail: base.email,
        name: normalizeUserChosenName(base.name) ?? '',
      }),
    });
  } catch (err) {
    console.warn('[authService] ensure profile row failed:', err);
  }
}

/**
 * Merge Edge-loaded `public.profiles` row into the app user.
 * Uses ONLY GET users/me/profile — never `supabase.from('profiles')`.
 * @throws If `access_token` is missing, profile API fails, or profile row missing after ensure.
 */
export async function mergeProfileIntoUser(base: User, accessToken?: string | null): Promise<User> {
  if (!accessToken) {
    const msg = '[PROFILE API] mergeProfileIntoUser requires session access_token';
    console.error(msg);
    throw new Error(msg);
  }

  let row: ProfileRow | null = await fetchProfileRowFromEdgeApi(base.id, accessToken);

  if (!row) {
    console.log('[PROFILE API] No row yet; ensuring profile row via PATCH then refetch');
    await ensureProfileRowExists(base);
    row = await fetchProfileRowFromEdgeApi(base.id, accessToken);
  }

  if (!row) {
    const msg = `[PROFILE API] No profile row for user ${base.id} after ensure — cannot hydrate`;
    console.error(msg);
    throw new Error(msg);
  }

  const emailForResolve = String(row.email ?? '').trim() || base.email;
  const mergedNameRaw = resolvedDisplayNameFromSources({
    display_name: row.display_name,
    name: row.name,
    full_name: row.full_name,
    email: emailForResolve,
  });
  const t = String(mergedNameRaw ?? '').trim();
  const mergedName =
    normalizeUserChosenName(t) ?? (t || undefined) ?? normalizeUserChosenName(base.name);
  const phoneFromProfile = String(row.phone ?? '').trim();
  const phoneMerged = phoneFromProfile || undefined;
  const imageMerged = String(row.avatar_url ?? '').trim() || base.profileImage;
  const finalRole = normalizeAppRole(row.role);

  return {
    ...base,
    email: String(row.email ?? '').trim() || base.email,
    role: finalRole,
    name: mergedName,
    phone: phoneMerged,
    profileImage: imageMerged,
  };
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

/**
 * Sign up new user
 */
export async function signUp(email: string, password: string, name?: string, phone?: string, role?: 'user' | 'admin'): Promise<AuthResponse> {
  try {
    // Call backend signup endpoint
    const payload: Record<string, unknown> = {
      email,
      password,
      role: role || 'user',
    };
    const trimmedSignupName = String(name ?? '').trim();
    if (trimmedSignupName) payload.name = trimmedSignupName;
    if (phone != null && String(phone).trim() !== '') payload.phone = String(phone).trim();

    const response = await fetch(`${getApiBase()}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      // Include details so callers can inspect the real Supabase error
      throw new Error(errorData.details || errorData.error || 'Failed to sign up');
    }

    const data = await response.json();
    
    // Now sign in with the created user
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData.session) {
      throw new Error(signInError?.message || 'Failed to sign in after signup');
    }

    const baseUser: User = {
      id: signInData.user.id,
      email: signInData.user.email!,
      name: displayNameFromSessionMetadata(signInData.user.user_metadata, signInData.user.email!),
      role: 'user',
      profileImage: signInData.user.user_metadata?.profileImage,
    };
    let user: User = baseUser;
    try {
      user = await mergeProfileIntoUser(baseUser, signInData.session.access_token);
    } catch (e) {
      console.error('[PROFILE API] signUp: profile hydrate failed; session is still valid', e);
    }
    return {
      user,
      accessToken: signInData.session.access_token,
    };
  } catch (error) {
    console.error('❌ Error signing up:', error);
    throw error;
  }
}

export type DeleteAccountApiResult =
  | { ok: true }
  | { ok: false; code?: string; message: string };

/** DELETE `/auth/delete-account` — same contract as My Panel / Admin profile flows. */
export async function deleteUserAccount(accessToken: string | null): Promise<DeleteAccountApiResult> {
  const response = await fetch(apiUrl('/auth/delete-account'), {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${publicAnonKey}`,
      'x-auth-token': accessToken || '',
      'Content-Type': 'application/json',
    },
  });
  if (response.ok) return { ok: true };
  const errorData = (await response.json().catch(() => ({}))) as { code?: string; error?: string };
  return {
    ok: false,
    code: errorData.code,
    message: errorData.error || 'Failed to delete account',
  };
}

/**
 * Sign in or Sign up — tries signIn first, falls back to signUp for new users.
 * This is a convenience function for the unified email+password form.
 */
export async function signInOrSignUp(email: string, password: string): Promise<AuthResponse> {
  try {
    // Try sign in first
    const result = await signIn(email, password);
    return result;
  } catch (signInError: any) {
    const msg = signInError?.message || '';
    // If invalid credentials, user might not exist — try creating
    if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
      console.log('[Auth] Sign in failed, attempting sign up for:', email);
      try {
        const result = await signUp(email, password);
        return result;
      } catch (signUpError: any) {
        const signUpMsg = signUpError?.message || '';
        // If user already exists but password was wrong
        if (signUpMsg.includes('already been registered') || signUpMsg.includes('email_exists')) {
          throw new Error('Pogrešna lozinka. Pokušaj ponovo.');
        }
        throw signUpError;
      }
    }
    throw signInError;
  }
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string): Promise<void> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getSupabaseAuthRedirectTo(),
    });
    if (error) throw error;
  } catch (error) {
    console.error('❌ Error sending password reset:', error);
    throw error;
  }
}

/**
 * Sign up new admin user
 */
export async function signUpAdmin(email: string, password: string, name: string): Promise<AuthResponse> {
  return signUp(email, password, name, undefined, 'admin');
}

/**
 * Sign in existing user
 */
export async function signIn(email: string, password: string): Promise<AuthResponse> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      throw new Error(error?.message || 'Failed to sign in');
    }

    const baseUser: User = {
      id: data.user.id,
      email: data.user.email!,
      name: displayNameFromSessionMetadata(data.user.user_metadata, data.user.email!),
      role: 'user',
      profileImage: data.user.user_metadata?.profileImage,
    };
    let user: User = baseUser;
    try {
      user = await mergeProfileIntoUser(baseUser, data.session.access_token);
    } catch (e) {
      console.error('[PROFILE API] signIn: profile hydrate failed; session is still valid', e);
    }
    return {
      user,
      accessToken: data.session.access_token,
    };
  } catch (error) {
    console.error('❌ Error signing in:', error);
    throw error;
  }
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<void> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    console.error('❌ Error signing out:', error);
    throw error;
  }
}

/**
 * Send OTP verification code to email
 */
export async function sendVerificationCode(email: string): Promise<void> {
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) throw error;
  } catch (error) {
    console.error('❌ Error sending verification code:', error);
    throw error;
  }
}

/**
 * Verify OTP code and complete registration with name metadata
 */
export async function verifyAndRegister(email: string, code: string, name: string, phone?: string): Promise<AuthResponse> {
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    });

    if (error || !data.session) {
      throw new Error(error?.message || 'Failed to verify code');
    }

    // Update user metadata with name only — role lives in `profiles`, not user-controlled metadata
    const { error: updateError } = await supabase.auth.updateUser({
      data: { name },
    });

    if (updateError) {
      console.warn('⚠️ Failed to update user metadata:', updateError.message);
    }

    const phoneTrimmed = String(phone ?? '').trim();

    // Also update via backend to ensure consistency
    try {
      const patchBody: Record<string, unknown> = {
        userId: data.user.id,
        name,
        email,
        oldEmail: email,
      };
      if (phoneTrimmed) {
        patchBody.phone = phoneTrimmed;
      }
      await fetch(`${getApiBase()}/users/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify(patchBody),
      });
    } catch (backendErr) {
      console.warn('⚠️ Backend profile update failed (non-critical):', backendErr);
    }

    const baseUser: User = {
      id: data.user.id,
      email: data.user.email!,
      name: displayNameFromSessionMetadata(
        { ...(data.user.user_metadata ?? {}), name } as Record<string, unknown>,
        data.user.email!,
      ),
      role: 'user',
      profileImage: data.user.user_metadata?.profileImage,
    };
    let user: User = baseUser;
    try {
      user = await mergeProfileIntoUser(baseUser, data.session.access_token);
    } catch (e) {
      console.error('[PROFILE API] verifyAndRegister: profile hydrate failed; session is still valid', e);
    }
    return {
      user,
      accessToken: data.session.access_token,
    };
  } catch (error) {
    console.error('❌ Error verifying code:', error);
    throw error;
  }
}

/**
 * Sign in with social provider (Google, Facebook, Apple)
 * This triggers a redirect — Supabase handles the OAuth flow.
 * The provider must be enabled in Supabase Dashboard first.
 */
export async function signInWithSocial(provider: 'google' | 'facebook' | 'apple'): Promise<void> {
  try {
    // Save which provider is being used so we remember after redirect
    saveLastLoginInfo({ method: provider });

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: getSupabaseAuthRedirectTo(),
      },
    });

    if (error) throw error;
  } catch (error) {
    console.error(`❌ Error signing in with ${provider}:`, error);
    throw error;
  }
}

/**
 * Get current session
 * Uses local JWT validation only — no expensive getUser() network call.
 * Stale sessions are caught when actual API calls fail (dataService handles 401).
 */
/** Wait briefly after OAuth redirect so `getSession()` sees the exchanged session (avoids clearing cache too early). */
export async function waitForOAuthSessionHydration(): Promise<void> {
  if (typeof window === 'undefined') return;
  const h = window.location.hash;
  const s = window.location.search;
  const looksOAuth =
    h.includes('access_token') ||
    h.includes('refresh_token') ||
    s.includes('code=');
  if (!looksOAuth) return;
  console.log('[AUTH-HYDRATION] OAuth return URL detected, waiting for session…');
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user?.id) {
      console.log('[AUTH-HYDRATION] session ready after OAuth wait', {
        userId: data.session.user.id,
        email: data.session.user.email,
      });
      return;
    }
    await new Promise((r) => setTimeout(r, 80));
  }
  console.warn('[AUTH-HYDRATION] OAuth wait timed out (session still null)');
}

export async function getSession(): Promise<AuthResponse | null> {
  try {
    await waitForOAuthSessionHydration();
    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session) {
      console.log('[AUTH-HYDRATION] getSession: no session', { message: error?.message });
      return null;
    }
    console.log('[AUTH-HYDRATION] getSession: has session', {
      userId: data.session.user.id,
      email: data.session.user.email,
      provider: (data.session.user as { app_metadata?: { provider?: string } }).app_metadata?.provider,
    });

    // ✅ Quick local JWT exp check
    try {
      const payload = JSON.parse(atob(data.session.access_token.split('.')[1]));
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        console.warn('[getSession] Token expired (exp claim), attempting refresh...');
        try {
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError || !refreshData.session) {
            console.error('[getSession] Refresh failed for expired token, clearing');
            await supabase.auth.signOut();
            return null;
          }
          return await buildAuthResponseAsync(refreshData.session);
        } catch (refreshErr) {
          console.error('[getSession] Refresh threw error, clearing:', refreshErr);
          await supabase.auth.signOut().catch(() => {});
          return null;
        }
      }
    } catch (parseErr) {
      // If JWT parse fails, still use the session — API calls will catch any issues
    }

    // ✅ Trust the local session without getUser() network call
    return await buildAuthResponseAsync(data.session);
  } catch (error) {
    console.error('❌ [PROFILE API] getSession failed (session or profile hydration):', error);
    return null;
  }
}

async function buildAuthResponseAsync(session: { user: any; access_token: string }): Promise<AuthResponse> {
  const baseUser: User = {
    id: session.user.id,
    email: session.user.email!,
    name: displayNameFromSessionMetadata(session.user.user_metadata, session.user.email!),
    role: 'user',
    profileImage: session.user.user_metadata?.profileImage,
  };
  try {
    const merged = await mergeProfileIntoUser(baseUser, session.access_token);
    console.log('[AUTH-HYDRATION] buildAuthResponseAsync merged user', {
      role: merged.role,
      phone: merged.phone,
    });
    return {
      user: merged,
      accessToken: session.access_token,
    };
  } catch (e) {
    console.error(
      '[PROFILE API] Profile hydration failed; keeping Supabase session and returning session user until profiles load',
      e,
    );
    return {
      user: baseUser,
      accessToken: session.access_token,
    };
  }
}

/**
 * Update user profile (name and email)
 */
export async function updateProfile(
  name: string,
  email: string,
  phone?: string | null,
  profileImage?: string,
): Promise<AuthResponse> {
  try {
    // Get current session to get userId and accessToken
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !sessionData.session) {
      throw new Error('No active session');
    }
    
    const userId = sessionData.session.user.id;
    const oldEmail = sessionData.session.user.email; // ✅ GET OLD EMAIL
    const accessToken = sessionData.session.access_token;
    
    console.log('📤 [updateProfile] Sending to backend:', { userId, name, email, oldEmail, phone, profileImage });
    
    const nameForBackend = String(name ?? '').trim();
    const payload: Record<string, unknown> = {
      userId,
      name: nameForBackend,
      /** App-level override so OAuth re-sync does not replace the edited label. */
      display_name: nameForBackend,
      email,
      oldEmail,
      profileImage,
    };
    if (phone !== undefined) {
      const t = typeof phone === 'string' ? phone.trim() : '';
      payload.phone = phone === null || t === '' ? null : t;
    }

    // Call backend to update profile
    const response = await fetch(`${getApiBase()}/users/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ [updateProfile] Backend error:', errorData);
      throw new Error(errorData.error || 'Failed to update profile');
    }

    const data = await response.json();
    console.log('✅ [updateProfile] Backend response:', data);
    
    // Refresh session to get updated user data
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError || !refreshData.session) {
      throw new ProfileUpdateSessionLostError();
    }

    console.log('✅ [updateProfile] Session refreshed successfully');

    const baseUser: User = {
      id: refreshData.user.id,
      email: refreshData.user.email!,
      name: displayNameFromSessionMetadata(refreshData.user.user_metadata, refreshData.user.email!),
      role: 'user',
      profileImage: refreshData.user.user_metadata?.profileImage,
    };
    let user: User = baseUser;
    try {
      user = await mergeProfileIntoUser(baseUser, refreshData.session.access_token);
    } catch (e) {
      console.error('[PROFILE API] updateProfile: profile refetch failed; session was updated', e);
    }
    return {
      user,
      accessToken: refreshData.session.access_token,
    };
  } catch (error) {
    console.error('❌ Error updating profile:', error);
    throw error;
  }
}