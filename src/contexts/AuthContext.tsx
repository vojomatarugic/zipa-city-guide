// @refresh reset
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as authService from '../utils/authService';
import { clearLastLoginInfo, normalizeAppRole, type AppRole } from '../utils/authService';

interface User {
  id: string;
  email: string;
  name?: string;
  /** From `profiles.role` */
  role: AppRole;
  phone?: string;
  profileImage?: string;
}

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  isAdmin: boolean;
  isMasterAdmin: boolean;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string, phone?: string) => Promise<void>;
  signInOrSignUp: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  sendVerificationCode: (email: string) => Promise<void>;
  verifyAndRegister: (email: string, code: string, name: string, phone?: string) => Promise<void>;
  socialLogin: (provider: 'google' | 'facebook' | 'apple') => Promise<void>;
  logout: () => void;
  updateProfile: (name: string, email: string, phone?: string | null, profileImage?: string) => Promise<void>;
  showAuthModal: boolean;
  openAuthModal: (tab?: 'login' | 'signup') => void;
  closeAuthModal: () => void;
  authModalTab: 'login' | 'signup';
  isLoading: boolean;
}

const noop = () => {};
const noopAsync = async () => {};

const defaultContextValue: AuthContextType = {
  user: null,
  isLoggedIn: false,
  isAdmin: false,
  isMasterAdmin: false,
  accessToken: null,
  login: noopAsync,
  signup: noopAsync,
  signInOrSignUp: noopAsync,
  resetPassword: noopAsync,
  sendVerificationCode: noopAsync,
  verifyAndRegister: noopAsync,
  socialLogin: noopAsync,
  logout: noop,
  updateProfile: noopAsync,
  showAuthModal: false,
  openAuthModal: noop,
  closeAuthModal: noop,
  authModalTab: 'login',
  isLoading: true,
};

const AuthContext = createContext<AuthContextType>(defaultContextValue);

const STORAGE_KEY = 'blguide_auth_user';
const TOKEN_KEY = 'blguide_auth_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  // ✅ Instantly hydrate from localStorage to avoid loading flash
  const [user, setUser] = useState<User | null>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        let role: AppRole = normalizeAppRole(parsed.role);
        if (parsed.role === undefined || parsed.role === null || parsed.role === '') {
          if (parsed.isMasterAdmin === true || parsed.is_master_admin === true) role = 'master_admin';
          else if (parsed.isAdmin === true) role = 'admin';
        }
        return {
          id: parsed.id,
          email: parsed.email,
          name: parsed.name,
          role,
          phone: parsed.phone,
          profileImage: parsed.profileImage,
        };
      }
    } catch { /* ignore parse errors */ }
    return null;
  });
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'signup'>('login');
  // ✅ Start as false if we have cached data, true only if no cached user
  const [isLoading, setIsLoading] = useState(() => {
    try { return !localStorage.getItem(STORAGE_KEY); } catch { return true; }
  });
  
  console.log('🔧 [AuthProvider] Initial state - showAuthModal:', false);

  // Validate session with Supabase in background + listen for auth changes
  useEffect(() => {
    let isMounted = true;

    async function validateSession() {
      try {
        const session = await authService.getSession();
        if (session) {
          const { data: rawSessionData } = await authService.supabase.auth.getSession();
          const rawUser = rawSessionData.session?.user;
          const userBeforeMerge = rawUser
            ? {
                id: rawUser.id,
                email: rawUser.email ?? '',
                name: rawUser.user_metadata?.name,
                role: 'user' as AppRole,
                profileImage: rawUser.user_metadata?.profileImage,
              }
            : null;
          console.log('[AUTH-HYDRATION] validateSession merge', { userBeforeMerge, userAfterMerge: session.user });
          if (isMounted) {
            const u: User = {
              id: session.user.id,
              email: session.user.email,
              name: session.user.name,
              role: normalizeAppRole(session.user.role),
              phone: session.user.phone,
              profileImage: session.user.profileImage,
            };
            const isAdminComputed = u.role === 'admin' || u.role === 'master_admin';
            console.log('[AUTH-HYDRATION] validateSession → setUser + localStorage', {
              role: u.role,
              isAdmin: isAdminComputed,
              phone: u.phone,
              userId: u.id,
            });
            setUser(u);
            setAccessToken(session.accessToken);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
            localStorage.setItem(TOKEN_KEY, session.accessToken);
            console.log('[Auth] Session validated from Supabase:', session.user.email);
          }
        } else {
          // ✅ No valid Supabase session — clear any stale cached user
          if (isMounted) {
            setUser(null);
            setAccessToken(null);
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(TOKEN_KEY);
            console.log('[Auth] No valid session found, cleared cached state');
          }
        }
      } catch (error) {
        console.error('[Auth] Failed to validate session:', error);
        if (isMounted) {
          try {
            const { data: rescue } = await authService.supabase.auth.getSession();
            const s = rescue.session;
            if (s?.user?.id && s.access_token) {
              const ru = s.user;
              const fallback: User = {
                id: ru.id,
                email: ru.email ?? '',
                name: ru.user_metadata?.name,
                role: 'user',
                phone: undefined,
                profileImage: ru.user_metadata?.profileImage,
              };
              console.warn(
                '[Auth] validateSession threw but Supabase session exists; keeping tokens (profile hydrate may retry on next navigation)',
              );
              setUser(fallback);
              setAccessToken(s.access_token);
              localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
              localStorage.setItem(TOKEN_KEY, s.access_token);
            } else {
              setUser(null);
              setAccessToken(null);
              localStorage.removeItem(STORAGE_KEY);
              localStorage.removeItem(TOKEN_KEY);
            }
          } catch {
            setUser(null);
            setAccessToken(null);
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(TOKEN_KEY);
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    
    validateSession();
    
    // ✅ Listen for auth state changes (including token refresh)
    const { data: { subscription } } = authService.supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔔 [Auth] State change:', event, session?.user?.email);
      
      // ✅ SKIP INITIAL_SESSION — loadSession() handles initial validation server-side.
      // INITIAL_SESSION can contain a stale session whose session_id was deleted,
      // and setting user state from it triggers my-venues/my-events calls that 403.
      if (event === 'INITIAL_SESSION') {
        console.log('🔔 [Auth] Skipping INITIAL_SESSION (loadSession handles it)');
        return;
      }
      
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && session?.user) {
        void (async () => {
          const token = session.access_token;
          if (!token) {
            console.error('[PROFILE API] onAuthStateChange: session missing access_token', { event });
            return;
          }
          console.log('[AUTH-HYDRATION] onAuthStateChange', {
            event,
            email: session.user.email,
            provider: (session.user as { app_metadata?: { provider?: string } }).app_metadata?.provider,
          });
          const base: User = {
            id: session.user.id,
            email: session.user.email!,
            name: session.user.user_metadata?.name,
            role: 'user',
            profileImage: session.user.user_metadata?.profileImage,
          };
          try {
            const withProfile = await authService.mergeProfileIntoUser(base, token);
            console.log('[AUTH-HYDRATION] onAuthStateChange merged → setUser', {
              event,
              role: withProfile.role,
              phone: withProfile.phone,
              isAdmin: withProfile.role === 'admin' || withProfile.role === 'master_admin',
            });
            setUser(withProfile);
            setAccessToken(token);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(withProfile));
            localStorage.setItem(TOKEN_KEY, token);
          } catch (e) {
            console.error(
              '[PROFILE API] onAuthStateChange: profile hydrate failed; keeping Supabase session (role/phone from profiles when refetch succeeds)',
              e,
            );
            setUser(base);
            setAccessToken(token);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(base));
            localStorage.setItem(TOKEN_KEY, token);
          }
        })();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setAccessToken(null);
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(TOKEN_KEY);
      }
    });
    
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await authService.signIn(email, password);
      
      const newUser: User = {
        id: response.user.id,
        email: response.user.email,
        name: response.user.name,
        role: normalizeAppRole(response.user.role),
        phone: response.user.phone,
        profileImage: response.user.profileImage,
      };
      
      setUser(newUser);
      setAccessToken(response.accessToken);
      setShowAuthModal(false);
      
      // Persist to localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
      localStorage.setItem(TOKEN_KEY, response.accessToken);
      
      // ✅ Remember last login method
      authService.saveLastLoginInfo({ method: 'email', email, name: newUser.name });
      
      console.log('[Auth] Login successful:', email);
    } catch (error) {
      console.error('[Auth] Login failed:', error);
      throw new Error('Prijava nije uspjela. Provjerite email i lozinku.');
    }
  };

  const signup = async (email: string, password: string, name?: string, phone?: string) => {
    try {
      const response = await authService.signUp(email, password, name, phone);
      
      const newUser: User = {
        id: response.user.id,
        email: response.user.email,
        name: response.user.name,
        role: normalizeAppRole(response.user.role),
        phone: response.user.phone,
        profileImage: response.user.profileImage,
      };
      
      setUser(newUser);
      setAccessToken(response.accessToken);
      setShowAuthModal(false);
      
      // Persist to localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
      localStorage.setItem(TOKEN_KEY, response.accessToken);
      
      console.log('[Auth] Signup successful:', email);
    } catch (error) {
      console.error('[Auth] Signup failed:', error);
      throw new Error('Registracija nije uspjela. Pokušajte ponovo.');
    }
  };

  const signInOrSignUp = async (email: string, password: string) => {
    try {
      const response = await authService.signInOrSignUp(email, password);
      
      const newUser: User = {
        id: response.user.id,
        email: response.user.email,
        name: response.user.name,
        role: normalizeAppRole(response.user.role),
        phone: response.user.phone,
        profileImage: response.user.profileImage,
      };
      
      setUser(newUser);
      setAccessToken(response.accessToken);
      setShowAuthModal(false);
      
      // Persist to localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
      localStorage.setItem(TOKEN_KEY, response.accessToken);

      // ✅ Remember last login method
      authService.saveLastLoginInfo({ method: 'email', email, name: newUser.name });
      
      console.log('[Auth] Sign in or sign up successful:', email);
    } catch (error) {
      console.error('[Auth] Sign in or sign up failed:', error);
      // ✅ Pass through the original error message instead of swallowing it
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await authService.resetPassword(email);
      console.log('[Auth] Password reset email sent:', email);
    } catch (error) {
      console.error('[Auth] Failed to send password reset email:', error);
      throw new Error('Slanje emaila za reset lozinke nije uspjelo. Pokušajte ponovo.');
    }
  };

  const sendVerificationCode = async (email: string) => {
    try {
      await authService.sendVerificationCode(email);
      console.log('[Auth] Verification code sent:', email);
    } catch (error) {
      console.error('[Auth] Failed to send verification code:', error);
      throw new Error('Slanje verifikacijskog koda nije uspjelo. Pokušajte ponovo.');
    }
  };

  const verifyAndRegister = async (email: string, code: string, name: string, phone?: string) => {
    try {
      const response = await authService.verifyAndRegister(email, code, name, phone);
      
      const newUser: User = {
        id: response.user.id,
        email: response.user.email,
        name: response.user.name,
        role: normalizeAppRole(response.user.role),
        phone: response.user.phone,
        profileImage: response.user.profileImage,
      };
      
      setUser(newUser);
      setAccessToken(response.accessToken);
      setShowAuthModal(false);
      
      // Persist to localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
      localStorage.setItem(TOKEN_KEY, response.accessToken);
      
      console.log('[Auth] Verification and registration successful:', email);
    } catch (error) {
      console.error('[Auth] Verification and registration failed:', error);
      throw new Error('Verifikacija i registracija nisu uspjele. Pokušajte ponovo.');
    }
  };

  const socialLogin = async (provider: 'google' | 'facebook' | 'apple') => {
    try {
      await authService.signInWithSocial(provider);
      // OAuth flow triggers a redirect — onAuthStateChange handles the rest
      setShowAuthModal(false);
    } catch (error) {
      console.error('[Auth] Social login failed:', error);
      throw new Error('Prijava putem društvenih mreža nije uspjela. Pokušajte ponovo.');
    }
  };

  const logout = () => {
    // 🔥 PROPER SIGN OUT - Clear Supabase session
    authService.signOut().then(() => {
      setUser(null);
      setAccessToken(null);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(TOKEN_KEY);
      console.log('[Auth] User logged out and Supabase session cleared');
      // NOTE: Do NOT clear last login info on logout — keep it for convenience
      // User can clear it manually via "Koristi drugi nalog" in the modal
    }).catch((error) => {
      console.error('[Auth] Error during sign out:', error);
      // Clear local state anyway
      setUser(null);
      setAccessToken(null);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(TOKEN_KEY);
    });
  };

  const updateProfile = async (name: string, email: string, phone?: string | null, profileImage?: string) => {
    try {
      const response = await authService.updateProfile(name, email, phone, profileImage);
      
      const newUser: User = {
        id: response.user.id,
        email: response.user.email,
        name: response.user.name,
        role: normalizeAppRole(response.user.role),
        phone: response.user.phone,
        profileImage: response.user.profileImage,
      };
      
      setUser(newUser);
      setAccessToken(response.accessToken);
      
      // Persist to localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
      localStorage.setItem(TOKEN_KEY, response.accessToken);
      
      console.log('[Auth] Profile updated:', email);
    } catch (error) {
      console.error('[Auth] Profile update failed:', error);
      throw new Error('Ažuriranje profila nije uspjelo. Pokušajte ponovo.');
    }
  };

  const openAuthModal = (tab: 'login' | 'signup' = 'login') => {
    setAuthModalTab(tab);
    setShowAuthModal(true);
  };

  const closeAuthModal = () => {
    setShowAuthModal(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        isAdmin: user ? (user.role === 'admin' || user.role === 'master_admin') : false,
        isMasterAdmin: user?.role === 'master_admin',
        accessToken,
        login,
        signup,
        signInOrSignUp,
        resetPassword,
        sendVerificationCode,
        verifyAndRegister,
        socialLogin,
        logout,
        updateProfile,
        showAuthModal,
        openAuthModal,
        closeAuthModal,
        authModalTab,
        isLoading
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  return context;
}