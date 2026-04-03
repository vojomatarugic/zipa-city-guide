/**
 * Auth Service - Sign up, Login, Logout
 */

import { supabase } from './supabaseClient';
import { projectId, publicAnonKey } from './supabase/info';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-a0e1e9cb`;

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

export interface User {
  id: string;
  email: string;
  name?: string;
  role?: 'admin' | 'user';
  phone?: string;
  profileImage?: string;
  isMasterAdmin?: boolean;
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
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({ email, password, name: name || 'User', phone, role: role || 'user' }),
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

    return {
      user: {
        id: signInData.user.id,
        email: signInData.user.email!,
        name: signInData.user.user_metadata?.name,
        role: signInData.user.user_metadata?.role || 'user',
        phone: signInData.user.user_metadata?.phone,
        isMasterAdmin: signInData.user.user_metadata?.is_master_admin === true,
      },
      accessToken: signInData.session.access_token,
    };
  } catch (error) {
    console.error('❌ Error signing up:', error);
    throw error;
  }
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
      redirectTo: window.location.origin,
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
  return signUp(email, password, name, 'admin');
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

    return {
      user: {
        id: data.user.id,
        email: data.user.email!,
        name: data.user.user_metadata?.name,
        role: data.user.user_metadata?.role || 'user',
        phone: data.user.user_metadata?.phone,
        profileImage: data.user.user_metadata?.profileImage,
        isMasterAdmin: data.user.user_metadata?.is_master_admin === true,
      },
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
export async function verifyAndRegister(email: string, code: string, name: string): Promise<AuthResponse> {
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    });

    if (error || !data.session) {
      throw new Error(error?.message || 'Failed to verify code');
    }

    // Update user metadata with name
    const { error: updateError } = await supabase.auth.updateUser({
      data: { name, role: 'user' },
    });

    if (updateError) {
      console.warn('⚠️ Failed to update user metadata:', updateError.message);
    }

    // Also update via backend to ensure consistency
    try {
      await fetch(`${API_BASE_URL}/users/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          userId: data.user.id,
          name,
          email,
          oldEmail: email,
        }),
      });
    } catch (backendErr) {
      console.warn('⚠️ Backend profile update failed (non-critical):', backendErr);
    }

    return {
      user: {
        id: data.user.id,
        email: data.user.email!,
        name: name,
        role: data.user.user_metadata?.role || 'user',
        phone: data.user.user_metadata?.phone,
        profileImage: data.user.user_metadata?.profileImage,
        isMasterAdmin: data.user.user_metadata?.is_master_admin === true,
      },
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
        redirectTo: window.location.origin,
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
export async function getSession(): Promise<AuthResponse | null> {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session) {
      return null;
    }

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
          return buildAuthResponse(refreshData.session);
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
    return buildAuthResponse(data.session);
  } catch (error) {
    console.error('❌ Error getting session:', error);
    return null;
  }
}

function buildAuthResponse(session: { user: any; access_token: string }): AuthResponse {
  return {
    user: {
      id: session.user.id,
      email: session.user.email!,
      name: session.user.user_metadata?.name,
      role: session.user.user_metadata?.role || 'user',
      phone: session.user.user_metadata?.phone,
      profileImage: session.user.user_metadata?.profileImage,
      isMasterAdmin: session.user.user_metadata?.is_master_admin === true,
    },
    accessToken: session.access_token,
  };
}

/**
 * Update user profile (name and email)
 */
export async function updateProfile(name: string, email: string, phone?: string, profileImage?: string): Promise<AuthResponse> {
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
    
    // Call backend to update profile
    const response = await fetch(`${API_BASE_URL}/users/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({ userId, name, email, oldEmail, phone, profileImage }), // ✅ SEND OLD EMAIL + PHONE + PROFILE IMAGE
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ [updateProfile] Backend error:', errorData);
      throw new Error(errorData.error || 'Failed to update profile');
    }

    const data = await response.json();
    console.log('✅ [updateProfile] Backend response:', data);
    
    // Refresh session to get updated user data
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError || !refreshData.session) {
      throw new Error('Failed to refresh session after profile update');
    }

    console.log('✅ [updateProfile] Session refreshed successfully');

    return {
      user: {
        id: refreshData.user.id,
        email: refreshData.user.email!,
        name: refreshData.user.user_metadata?.name,
        role: refreshData.user.user_metadata?.role || 'user',
        phone: refreshData.user.user_metadata?.phone,
        profileImage: refreshData.user.user_metadata?.profileImage,
        isMasterAdmin: refreshData.user.user_metadata?.is_master_admin === true,
      },
      accessToken: refreshData.session.access_token,
    };
  } catch (error) {
    console.error('❌ Error updating profile:', error);
    throw error;
  }
}