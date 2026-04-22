import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { useT } from '../hooks/useT';
import { useAuth } from '../contexts/AuthContext';
import { Users, ChevronDown, ChevronUp, Calendar, MapPin, Ban, Trash2, ShieldCheck, Shield, Crown, ArrowUpDown, Building2, User, Phone, Mail } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { ConfirmDialog } from './ConfirmDialog';
import { publicAnonKey } from '../utils/supabase/info';
import { apiUrl } from '../config/apiBase';
import { supabase } from '../utils/authService';
import { getCanonicalEventPageSlug } from '../utils/eventPageCategory';
import { shouldHandleSoftRowClick } from '../utils/rowClick';
import { adminAccordionCountBadgeClass } from '../utils/adminAccordionBadgeClasses';
import { formatDate as formatAppDate, formatDateTime as formatAppDateTime } from '../utils/dateFormat';
import * as eventService from '../utils/eventService';
type ProfileRole = 'user' | 'admin' | 'master_admin';

interface User {
  id: string;
  email: string;
  name: string;
  /** When API includes profile full name (e.g. from DB), prefer this in `getUserDisplayName`. */
  full_name?: string | null;
  role: ProfileRole;
  created_at: string;
  last_sign_in_at?: string | null;
  venues_count: number;
  events_count: number;
  total_submissions: number;
  blocked?: boolean;
}

interface UserSubmission {
  id: string;
  title: string;
  title_en?: string;
  page_slug: string;
  status: string;
  created_at: string;
  start_at?: string;
  end_at?: string | null;
  event_schedules?: unknown;
  image?: string;
  address?: string;
  city?: string;
  venue_type?: string;
  event_type?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  organizer_name?: string;
  organizer_phone?: string;
  organizer_email?: string;
  is_active?: boolean;
  /** Same source of truth as Admin lists: inactive IDs in kv_store, not DB is_active. */
  _kind?: 'venue' | 'event';
}

function normalizeListRole(r: unknown): ProfileRole {
  const s = String(r ?? '').trim().toLowerCase();
  if (s === 'master_admin' || s === 'admin' || s === 'user') return s;
  return 'user';
}

/** Display name from profile/API fields only — never role. Backend may send `name`, `full_name`, or placeholder "N/A". */
function getUserDisplayName(user: { name?: string | null; full_name?: string | null; email: string }) {
  const full = (user.full_name ?? '').trim();
  if (full) return full;
  const rawName = (user.name ?? '').trim();
  if (rawName && rawName !== 'N/A') return rawName;
  return (user.email ?? '').trim() || '';
}

type UsersAdminSectionProps = {
  /** Same kv_store-backed source as Admin main list (updates when admin toggles active/inactive). */
  inactiveVenueIds: Set<string>;
  inactiveEventIds: Set<string>;
};

export function UsersAdminSection({ inactiveVenueIds, inactiveEventIds }: UsersAdminSectionProps) {
  const { t, language } = useT();
  const { isLoading: authLoading, accessToken, user: currentUser } = useAuth();
  const canManageRoles = currentUser?.role === 'master_admin';
  const navigate = useNavigate();
  
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [userSubmissions, setUserSubmissions] = useState<{ [userId: string]: UserSubmission[] }>({});
  const [loadingSubmissions, setLoadingSubmissions] = useState<{ [userId: string]: boolean }>({});
  const [currentToken, setCurrentToken] = useState<string | null>(null); // ✅ Store fresh token

  // Sort state for regular users
  const [regularUserSort, setRegularUserSort] = useState<'created_desc' | 'created_asc' | 'active_desc' | 'active_asc' | 'name_asc' | 'name_desc'>('active_desc');

  /** Collapsible section (default closed), same pattern as Admin “Lista objekata”. */
  const [usersSectionExpanded, setUsersSectionExpanded] = useState(false);

  // ConfirmDialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: 'danger' | 'warning' | 'info';
    confirmText?: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', variant: 'warning', onConfirm: () => {} });
  const topBadgeBaseClass = 'inline-flex items-center h-7 px-2.5 rounded-[6px] text-[12px] leading-none font-semibold';

  const showConfirm = (opts: { title: string; message: string; variant: 'danger' | 'warning' | 'info'; confirmText?: string; onConfirm: () => void }) => {
    setConfirmDialog({ isOpen: true, ...opts });
  };

  const closeConfirm = () => {
    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
  };

  useEffect(() => {
    // Only load if auth is ready
    if (!authLoading) {
      loadUsers();
    }
  }, [authLoading]);

  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);
    
    console.log(' [UsersAdminSection] ========================================');
    console.log('🔍 [UsersAdminSection] Loading users...');
    
    // ✅ CRITICAL FIX: Refresh session to get fresh token
    console.log('🔄 [UsersAdminSection] Refreshing session to get fresh token...');
    const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
    
    if (sessionError) {
      console.error('❌ [UsersAdminSection] Session refresh error:', sessionError);
      setError('Session expired - please log in again');
      setIsLoading(false);
      return;
    }
    
    const freshToken = session?.access_token;
    
    console.log('🔑 [UsersAdminSection] Session refresh result:');
    console.log('  - session exists:', !!session);
    console.log('  - token exists:', !!freshToken);
    console.log('  - token length:', freshToken?.length);
    console.log('  - user email:', session?.user?.email);
    console.log('  - user role:', session?.user?.user_metadata?.role);
    console.log(' [UsersAdminSection] publicAnonKey exists:', !!publicAnonKey);
    console.log('🔑 [UsersAdminSection] publicAnonKey length:', publicAnonKey?.length);
    console.log('🔑 [UsersAdminSection] publicAnonKey preview:', publicAnonKey?.slice(0, 50) + '...');
    
    if (!freshToken) {
      const errorMsg = 'No access token available - user not logged in';
      console.error('❌ [UsersAdminSection]', errorMsg);
      setError(errorMsg);
      setIsLoading(false);
      return;
    }
    
    if (!publicAnonKey) {
      const errorMsg = 'No publicAnonKey available - configuration error';
      console.error('❌ [UsersAdminSection]', errorMsg);
      setError(errorMsg);
      setIsLoading(false);
      return;
    }
    
    try {
      const url = apiUrl('/users');
      console.log('📡 [UsersAdminSection] Fetching:', url);
      
      // ✅ CRITICAL FIX: Gateway intercepts Authorization header, so send user JWT via x-auth-token
      const requestHeaders = {
        'Authorization': `Bearer ${publicAnonKey}`,  // ✅ For Supabase gateway routing
        'apikey': publicAnonKey,                     // ✅ Required for Supabase to route request
        'x-auth-token': freshToken,                  // ✅ User's real JWT (read by backend)
        'Content-Type': 'application/json',
      };
      
      console.log('📡 [UsersAdminSection] Request headers:', {
        'Authorization': 'Bearer ${publicAnonKey} (gateway)',
        'x-auth-token': `${freshToken.slice(0, 30)}... (user JWT, len=${freshToken.length})`,
      });
      
      const response = await fetch(url, {
        method: 'GET',
        headers: requestHeaders,
      });

      console.log('📥 [UsersAdminSection] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ [UsersAdminSection] Error response:', errorData);
        throw new Error(errorData.message || errorData.error || 'Failed to fetch users');
      }

      const data = await response.json();
      console.log('✅ [UsersAdminSection] Users loaded:', data.users?.length || 0);
      const raw = (data.users || []) as User[];
      setUsers(raw.map((u) => ({ ...u, role: normalizeListRole(u.role) })));
      setCurrentToken(freshToken); // ✅ Store fresh token
    } catch (err) {
      console.error('❌ [UsersAdminSection] Error loading users:', err);
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserSubmissions = async (userId: string, email: string) => {
    setLoadingSubmissions({ ...loadingSubmissions, [userId]: true });
    
    const token = currentToken || accessToken; // ✅ Use fresh token if available
    if (!token) {
      console.error('No access token available');
      setLoadingSubmissions({ ...loadingSubmissions, [userId]: false });
      return;
    }
    
    try {
      const response = await fetch(
        apiUrl(`/users/${encodeURIComponent(email)}/submissions`),
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,  // ✅ For gateway routing
            'apikey': publicAnonKey,                      // ✅ Required
            'x-auth-token': token,                        // ✅ User's real JWT
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch user submissions');
      }

      const data = await response.json();
      
      // Combine venues and events (tag kind so active/inactive matches Admin list kv_store)
      const allSubmissions: UserSubmission[] = [
        ...(data.venues || []).map((v: Record<string, unknown>) => ({ ...v, _kind: 'venue' as const })),
        ...(data.events || []).map((e: Record<string, unknown>) => ({ ...e, _kind: 'event' as const })),
      ];
      
      setUserSubmissions({ ...userSubmissions, [userId]: allSubmissions });
    } catch (err) {
      console.error('Error loading user submissions:', err);
    } finally {
      setLoadingSubmissions({ ...loadingSubmissions, [userId]: false });
    }
  };

  const toggleUserExpand = async (userId: string, email: string) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
    } else {
      setExpandedUserId(userId);
      if (!userSubmissions[userId]) {
        await loadUserSubmissions(userId, email);
      }
    }
  };

  const formatDate = (dateString: string) => {
    return formatAppDate(dateString, language === 'en' ? 'en' : 'sr');
  };

  const formatDateTime = (dateString: string) => {
    return formatAppDateTime(dateString, language === 'en' ? 'en' : 'sr');
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'food-and-drink':
      case 'restaurants': return t('categoryRestaurants');
      case 'clubs': return t('categoryClubs');
      case 'cafes': return t('categoryCafes');
      case 'events': return t('categoryEvents');
      default: return category;
    }
  };

  const getTypeLabel = (submission: UserSubmission) => {
    const rawType = (submission.event_type || submission.venue_type || '').toString().trim();
    if (!rawType) {
      return getCategoryLabel(submission.page_slug || '');
    }
    const translationKey = rawType as Parameters<typeof t>[0];
    const translated = t(translationKey);
    if (translated !== translationKey) return translated;
    return rawType
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  const getSubmissionActive = (submission: UserSubmission) => {
    if (submission.status !== 'approved') return false;
    if (submission._kind === 'event') {
      return !inactiveEventIds.has(submission.id) && !eventService.isEventExpired(submission);
    }
    if (submission._kind === 'venue') return !inactiveVenueIds.has(submission.id);
    const normalized = (submission.page_slug || '').toLowerCase();
    const looksEvent =
      !!submission.event_type ||
      ['events', 'event', 'exhibition', 'concerts', 'cinema', 'theatre'].includes(normalized);
    return looksEvent
      ? !inactiveEventIds.has(submission.id) && !eventService.isEventExpired(submission)
      : !inactiveVenueIds.has(submission.id);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved': return t('statusApproved');
      case 'pending': return t('statusPending');
      case 'rejected': return t('statusRejected');
      default: return status;
    }
  };

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case 'food-and-drink':
      case 'restaurants': return 'bg-orange-100 text-orange-700';
      case 'clubs': return 'bg-purple-100 text-purple-700';
      case 'cafes': return 'bg-amber-100 text-amber-700';
      case 'events': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeBadgeColor = (submission: UserSubmission) => {
    if (submission.event_type) return 'bg-blue-100 text-blue-700';
    return getCategoryBadgeColor(submission.page_slug);
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const blockUser = async (userId: string) => {
    showConfirm({
      title: t('blockUser'),
      message: t('confirmBlockUser'),
      variant: 'warning',
      confirmText: t('blockUser'),
      onConfirm: async () => {
        closeConfirm();
        const token = currentToken || accessToken;
        if (!token) { toast.error('No access token available'); return; }
        try {
          const response = await fetch(
            apiUrl(`/users/${userId}/block`),
            {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${publicAnonKey}`,
                'apikey': publicAnonKey,
                'x-auth-token': token,
                'Content-Type': 'application/json',
              },
            }
          );
          if (!response.ok) throw new Error('Failed to block user');
          toast.success(t('userBlocked'));
          await loadUsers();
        } catch (err) {
          console.error('Error blocking user:', err);
          toast.error('Failed to block user');
        }
      },
    });
  };

  const unblockUser = async (userId: string) => {
    showConfirm({
      title: t('unblockUser'),
      message: t('confirmUnblockUser'),
      variant: 'info',
      confirmText: t('unblockUser'),
      onConfirm: async () => {
        closeConfirm();
        const token = currentToken || accessToken;
        if (!token) { toast.error('No access token available'); return; }
        try {
          const response = await fetch(
            apiUrl(`/users/${userId}/unblock`),
            {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${publicAnonKey}`,
                'apikey': publicAnonKey,
                'x-auth-token': token,
                'Content-Type': 'application/json',
              },
            }
          );
          if (!response.ok) throw new Error('Failed to unblock user');
          toast.success(t('userUnblocked'));
          await loadUsers();
        } catch (err) {
          console.error('Error unblocking user:', err);
          toast.error('Failed to unblock user');
        }
      },
    });
  };

  const deleteUser = async (userId: string) => {
    showConfirm({
      title: t('deleteUser'),
      message: t('confirmDeleteUser'),
      variant: 'danger',
      confirmText: t('deleteUser'),
      onConfirm: async () => {
        closeConfirm();
        const token = currentToken || accessToken;
        if (!token) { toast.error('No access token available'); return; }
        try {
          const response = await fetch(
            apiUrl(`/users/${userId}`),
            {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${publicAnonKey}`,
                'apikey': publicAnonKey,
                'x-auth-token': token,
                'Content-Type': 'application/json',
              },
            }
          );
          if (!response.ok) throw new Error('Failed to delete user');
          toast.success(t('userDeleted'));
          await loadUsers();
        } catch (err) {
          console.error('Error deleting user:', err);
          toast.error('Failed to delete user');
        }
      },
    });
  };

  const setUserRole = async (userId: string, targetEmail: string, currentRole: ProfileRole, newRole: 'admin' | 'user') => {
    if (currentRole === newRole) return;

    const isMasterAdminTarget = currentRole === 'master_admin';

    showConfirm({
      title: isMasterAdminTarget
        ? (language === 'sr' ? 'Potvrda promjene prava' : 'Confirm role change')
        : (newRole === 'admin' ? t('makeAdmin') : t('removeAdmin')),
      message: isMasterAdminTarget
        ? 'Da li si siguran da želiš promijeniti prava master admin korisniku?'
        : (newRole === 'admin' ? t('confirmMakeAdmin') : t('confirmRemoveAdmin')),
      variant: isMasterAdminTarget ? 'warning' : 'info',
      confirmText: newRole === 'admin' ? t('makeAdmin') : t('removeAdmin'),
      onConfirm: async () => {
        closeConfirm();
        const token = currentToken || accessToken;
        if (!token) { toast.error('No access token available'); return; }
        try {
          console.log('[UsersAdminSection] set-role PATCH →', {
            targetUserId: userId,
            targetEmail,
            currentRole,
            requestedRole: newRole,
          });
          const response = await fetch(
            apiUrl(`/users/${encodeURIComponent(userId)}/set-role`),
            {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${publicAnonKey}`,
                'apikey': publicAnonKey,
                'x-auth-token': token,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ role: newRole }),
            }
          );
          if (!response.ok) {
            const errorData = await response.json();
            if (errorData.code === 'LAST_ADMIN') {
              toast.error(t('cannotRemoveLastAdmin'));
              return;
            }
            throw new Error(errorData.error || 'Failed to set user role');
          }
          toast.success(newRole === 'admin' ? t('adminRoleGranted') : t('adminRoleRemoved'));
          await loadUsers();
        } catch (err) {
          console.error('Error setting user role:', err);
          toast.error(err instanceof Error ? err.message : 'Failed to set user role');
        }
      },
    });
  };

  // ✅ Sort users: master admin first, then admins, then regular users
  const sortedUsers = [...users].sort((a, b) => {
    const rank = (r: ProfileRole) => (r === 'master_admin' ? 0 : r === 'admin' ? 1 : 2);
    const d = rank(a.role) - rank(b.role);
    if (d !== 0) return d;
    return getUserDisplayName(a).localeCompare(getUserDisplayName(b));
  });

  const adminUsers = sortedUsers.filter((u) => u.role === 'admin' || u.role === 'master_admin');
  const regularUsersUnsorted = sortedUsers.filter((u) => u.role === 'user');

  // ✅ Sort regular users based on selected sort option
  const regularUsers = [...regularUsersUnsorted].sort((a, b) => {
    switch (regularUserSort) {
      case 'created_desc':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case 'created_asc':
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case 'active_desc':
        return new Date(b.last_sign_in_at || '1970-01-01').getTime() - new Date(a.last_sign_in_at || '1970-01-01').getTime();
      case 'active_asc':
        return new Date(a.last_sign_in_at || '1970-01-01').getTime() - new Date(b.last_sign_in_at || '1970-01-01').getTime();
      case 'name_asc':
        return getUserDisplayName(a).localeCompare(getUserDisplayName(b));
      case 'name_desc':
        return getUserDisplayName(b).localeCompare(getUserDisplayName(a));
      default:
        return 0;
    }
  });

  const getSubmissionHref = (submission: UserSubmission) => {
    const { page_slug, id } = submission;
    const normalized = (page_slug || '').toLowerCase();
    
    // Determine route based on canonical page mapping
    if (submission.event_type || normalized === 'events' || normalized === 'event' || normalized === 'exhibition' || normalized === 'concerts' || normalized === 'cinema' || normalized === 'theatre') {
      return `/${getCanonicalEventPageSlug(submission.event_type, submission.page_slug)}/${id}`;
    } else if (normalized === 'food-and-drink' || normalized === 'restaurants' || normalized === 'cafes') {
      // food-and-drink venues (backward compat: 'restaurants' is the old slug)
      return `/food-and-drink/${id}`;
    } else if (normalized === 'clubs' || normalized === 'nightlife') {
      return `/clubs/${id}`;
    } else {
      // Fallback - pokušaj sa page_slug-om
      return `/${normalized || 'food-and-drink'}/${id}`;
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className={`flex w-full min-w-0 items-center gap-3 flex-wrap ${usersSectionExpanded ? 'mb-4' : 'mb-0'}`}>
        <button
          type="button"
          onClick={() => setUsersSectionExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center text-left rounded-lg px-1 py-1 -mx-1 hover:bg-gray-50 cursor-pointer transition-colors border-0 bg-transparent"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Users className="w-6 h-6 shrink-0" style={{ color: 'var(--primary)' }} aria-hidden />
            <h2 className="m-0 min-w-0 text-xl font-bold" style={{ textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>
              {t('users')}
            </h2>
            {!isLoading && (
              <span className={adminAccordionCountBadgeClass('blue')}>{users.length}</span>
            )}
          </div>
        </button>
        <button
          type="button"
          onClick={() => setUsersSectionExpanded((v) => !v)}
          className="flex shrink-0 items-center justify-center rounded-lg px-1 py-1 -mx-1 hover:bg-gray-50 cursor-pointer transition-colors border-0 bg-transparent"
          aria-expanded={usersSectionExpanded}
        >
          {usersSectionExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" aria-hidden />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" aria-hidden />
          )}
        </button>
      </div>

      {usersSectionExpanded && (
        <>
          {isLoading ? (
            <p className="text-gray-500">{t('loading')}...</p>
          ) : error ? (
            <p className="text-red-600">{error}</p>
          ) : (
            <>
              {/* ===== ADMIN GROUP ===== */}
              {adminUsers.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <Crown className="w-4 h-4 shrink-0 text-[#C9A227]" strokeWidth={2} aria-hidden />
                    <span className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
                      {language === 'sr' ? 'Administratori' : 'Administrators'}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-neutral-900 text-[#E8C547] border border-[#C9A227]/70 tabular-nums">
                      {adminUsers.length}
                    </span>
                    <div className="flex-1 h-px bg-gradient-to-r from-[#C9A227] via-[#C9A227]/40 to-transparent ml-2" />
                  </div>
                  <div className="space-y-3">
                    {adminUsers.map((user) => renderUserCard(user))}
                  </div>
                </div>
              )}

              {/* ===== REGULAR USERS GROUP ===== */}
              {regularUsers.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <Users className="w-4 h-4 text-gray-500" aria-hidden />
                    <span className="text-sm font-bold text-gray-600 uppercase tracking-wider">
                      {language === 'sr' ? 'Korisnici' : 'Users'}
                    </span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {regularUsers.length}
                    </span>
                    <div className="flex-1 h-px bg-gray-200 ml-2" />
                    <div className="flex items-center gap-1 ml-2">
                      <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" aria-hidden />
                      <select
                        value={regularUserSort}
                        onChange={(e) => setRegularUserSort(e.target.value as typeof regularUserSort)}
                        className="text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg px-2 py-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-300"
                      >
                        <option value="created_desc">{language === 'sr' ? 'Najnoviji prvo' : 'Newest first'}</option>
                        <option value="created_asc">{language === 'sr' ? 'Najstariji prvo' : 'Oldest first'}</option>
                        <option value="active_desc">{language === 'sr' ? 'Zadnja aktivnost ↓' : 'Last active ↓'}</option>
                        <option value="active_asc">{language === 'sr' ? 'Zadnja aktivnost ↑' : 'Last active ↑'}</option>
                        <option value="name_asc">{language === 'sr' ? 'Ime A-Z' : 'Name A-Z'}</option>
                        <option value="name_desc">{language === 'sr' ? 'Ime Z-A' : 'Name Z-A'}</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {regularUsers.map((user) => renderUserCard(user))}
                  </div>
                </div>
              )}

              {users.length === 0 && (
                <p className="text-center text-gray-500 py-8">
                  {t('noUsersRegistered')}
                </p>
              )}
            </>
          )}
        </>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        confirmText={confirmDialog.confirmText}
        onConfirm={confirmDialog.onConfirm}
        onCancel={closeConfirm}
      />
    </div>
  );

  function renderUserCard(user: User) {
    const isSelf = currentUser?.id === user.id;
    return (
      <div key={user.id} className="border border-gray-200 rounded-xl bg-white">
        {/* User Header */}
        <div
          onClick={() => toggleUserExpand(user.id, user.email)}
          className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="font-semibold text-lg" style={{ color: '#DC2626' }}>
                  {getUserDisplayName(user)}
                </div>
                {user.role === 'master_admin' ? (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-neutral-900 text-[#E8C547] border border-[#C9A227]/70">
                    Master Admin
                  </span>
                ) : user.role === 'admin' ? (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                    Admin
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-gray-600 mb-2">{user.email}</p>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>
                  {t('joined')}: {formatDate(user.created_at)}
                </span>
                {user.last_sign_in_at && (
                  <span>
                    {t('lastSignIn')}: {formatDateTime(user.last_sign_in_at)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-orange-50">
                  <span className="font-bold text-orange-600 text-[20px]">{user.venues_count}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">{t('venuesLabel')}</div>
              </div>
              <div className="text-center">
                <div className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-purple-50">
                  <span className="font-bold text-purple-600 text-[20px]">{user.events_count}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">{t('eventsLabel')}</div>
              </div>
              <div className="text-center">
                <div className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-blue-50">
                  <span className="font-bold text-blue-600 text-[20px]">{user.total_submissions}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">{t('total')}</div>
              </div>
              
              {expandedUserId === user.id ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </div>
          </div>
        </div>

        {/* Expanded User Submissions */}
        {expandedUserId === user.id && (
          <div className="border-t border-gray-200 bg-gray-50 p-4 sm:p-5">
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-gray-200">
              {!isSelf &&
                (user.role === 'master_admin' ? (
                  <span className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-neutral-900 text-[#E8C547] border border-[#C9A227]/60">
                    <ShieldCheck className="w-4 h-4 text-[#C9A227]" aria-hidden />
                    Master Admin
                  </span>
                ) : (
                  <>
                    {canManageRoles && (
                      <>
                        {(() => {
                          const isSameRoleAsAdmin = user.role === 'admin';
                          const isSameRoleAsUser = user.role === 'user';
                          const sameRoleMessage = 'Already has this role';

                          return (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setUserRole(user.id, user.email, user.role, 'admin');
                                }}
                                disabled={isSameRoleAsAdmin}
                                title={isSameRoleAsAdmin ? sameRoleMessage : undefined}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                <Shield className="w-4 h-4" />
                                {t('makeAdmin')}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setUserRole(user.id, user.email, user.role, 'user');
                                }}
                                disabled={isSameRoleAsUser}
                                title={isSameRoleAsUser ? sameRoleMessage : undefined}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                <Shield className="w-4 h-4" />
                                {t('removeAdmin')}
                              </button>
                            </>
                          );
                        })()}
                      </>
                    )}
                    {user.blocked ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          unblockUser(user.id);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition-colors text-sm font-medium"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        {t('unblockUser')}
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          blockUser(user.id);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 rounded-lg transition-colors text-sm font-medium"
                      >
                        <Ban className="w-4 h-4" />
                        {t('blockUser')}
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteUser(user.id);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors text-sm font-medium"
                    >
                      <Trash2 className="w-4 h-4" />
                      {t('deleteUser')}
                    </button>
                  </>
                ))}
            </div>
            
            {loadingSubmissions[user.id] ? (
              <p className="text-sm text-gray-500">{t('loading')}...</p>
            ) : userSubmissions[user.id]?.length > 0 ? (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-gray-700 mb-1">
                  {t('submissions')}
                </h4>
                {userSubmissions[user.id].map((submission) => (
                  <article
                    key={submission.id}
                    onClick={(event) => {
                      if (!shouldHandleSoftRowClick(event)) return;
                      navigate(getSubmissionHref(submission));
                    }}
                    className="border rounded-xl p-4 hover:shadow-md transition-all cursor-pointer"
                    style={{ borderColor: '#F3F4F6', background: '#FFFFFF' }}
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h5 className="m-0 leading-tight text-base font-semibold text-gray-900">
                          <Link
                            to={getSubmissionHref(submission)}
                            className="rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 hover:underline"
                            style={{ color: 'inherit', textDecorationColor: '#0E3DC5', textUnderlineOffset: '2px' }}
                          >
                            {language === 'en' ? (submission.title_en || submission.title) : submission.title}
                          </Link>
                        </h5>
                        <span className={`${topBadgeBaseClass} ${getTypeBadgeColor(submission)}`}>
                          {getTypeLabel(submission)}
                        </span>
                        <span className={`${topBadgeBaseClass} ${getStatusBadgeColor(submission.status)}`}>
                          {getStatusLabel(submission.status)}
                        </span>
                        <span
                          className={`${topBadgeBaseClass} ${
                            getSubmissionActive(submission) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {getSubmissionActive(submission)
                            ? (language === 'sr' ? 'Aktivan' : 'Active')
                            : (language === 'sr' ? 'Neaktivan' : 'Inactive')}
                        </span>
                        <span className={topBadgeBaseClass} style={{ background: 'rgba(107,114,128,0.06)', border: '1px solid rgba(107,114,128,0.15)', color: '#9CA3AF', fontWeight: 500 }}>
                          📅 {formatDate(submission.created_at)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3 text-[14px]" style={{ color: 'var(--text-muted)' }}>
                        {submission.city && (
                          <span className="inline-flex min-w-0 items-center gap-1.5">
                            <Building2 size={14} className="shrink-0" />
                            <span className="truncate">{submission.city}</span>
                          </span>
                        )}
                        {submission.address && (
                          <span className="inline-flex min-w-0 items-center gap-1.5">
                            <MapPin size={14} className="shrink-0" />
                            <span className="truncate">{submission.address}</span>
                          </span>
                        )}
                        {submission.start_at && (
                          <span className="inline-flex min-w-0 items-center gap-1.5">
                            <Calendar size={14} className="shrink-0" />
                            <span className="truncate">{formatDate(submission.start_at)}</span>
                          </span>
                        )}
                        {(submission.organizer_name || submission.contact_name) && (
                          <span className="inline-flex min-w-0 items-center gap-1.5">
                            <User size={14} className="shrink-0" />
                            <span className="truncate">{submission.organizer_name || submission.contact_name}</span>
                          </span>
                        )}
                        {(submission.organizer_phone || submission.contact_phone) && (
                          <span className="inline-flex min-w-0 items-center gap-1.5">
                            <Phone size={14} className="shrink-0" />
                            <span className="truncate">{submission.organizer_phone || submission.contact_phone}</span>
                          </span>
                        )}
                        {(submission.organizer_email || submission.contact_email) && (
                          <span className="inline-flex min-w-0 items-center gap-1.5">
                            <Mail size={14} className="shrink-0" />
                            <span className="truncate">{submission.organizer_email || submission.contact_email}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                {t('noSubmissionsYet')}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }
}