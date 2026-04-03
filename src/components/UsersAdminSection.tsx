import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useT } from '../hooks/useT';
import { useAuth } from '../contexts/AuthContext';
import { Users, ChevronDown, ChevronUp, Calendar, MapPin, Ban, Trash2, ShieldCheck, Shield, Crown, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { ConfirmDialog } from './ConfirmDialog';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { supabase } from '../utils/authService';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
  last_sign_in_at?: string | null;
  venues_count: number;
  events_count: number;
  total_submissions: number;
  blocked?: boolean;
  is_master_admin?: boolean;
}

interface UserSubmission {
  id: string;
  title: string;
  page_slug: string;
  status: string;
  created_at: string;
  start_at?: string;
  image?: string;
  address?: string;
}

export function UsersAdminSection() {
  const { t, language } = useT();
  const navigate = useNavigate();
  const { isLoading: authLoading, accessToken } = useAuth();
  
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [userSubmissions, setUserSubmissions] = useState<{ [userId: string]: UserSubmission[] }>({});
  const [loadingSubmissions, setLoadingSubmissions] = useState<{ [userId: string]: boolean }>({});
  const [currentToken, setCurrentToken] = useState<string | null>(null); // ✅ Store fresh token

  // Sort state for regular users
  const [regularUserSort, setRegularUserSort] = useState<'created_desc' | 'created_asc' | 'active_desc' | 'active_asc' | 'name_asc' | 'name_desc'>('active_desc');

  // ConfirmDialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: 'danger' | 'warning' | 'info';
    confirmText?: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', variant: 'warning', onConfirm: () => {} });

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
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-a0e1e9cb/users`;
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
      setUsers(data.users || []);
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
        `https://${projectId}.supabase.co/functions/v1/make-server-a0e1e9cb/users/${encodeURIComponent(email)}/submissions`,
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
      
      // Combine venues and events
      const allSubmissions = [
        ...(data.venues || []),
        ...(data.events || [])
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
      
      // Load submissions if not already loaded
      if (!userSubmissions[userId]) {
        await loadUserSubmissions(userId, email);
      }
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    // ✅ POPRAVKA: Koristi 'sr-Latn' za latinicu umesto 'sr-RS' koja vraća ćirilicu
    return date.toLocaleDateString(language === 'sr' ? 'sr-Latn' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(language === 'sr' ? 'sr-Latn' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
            `https://${projectId}.supabase.co/functions/v1/make-server-a0e1e9cb/users/${userId}/block`,
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
            `https://${projectId}.supabase.co/functions/v1/make-server-a0e1e9cb/users/${userId}/unblock`,
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
            `https://${projectId}.supabase.co/functions/v1/make-server-a0e1e9cb/users/${userId}`,
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

  const setUserRole = async (userId: string, newRole: 'admin' | 'user') => {
    showConfirm({
      title: newRole === 'admin' ? t('makeAdmin') : t('removeAdmin'),
      message: newRole === 'admin' ? t('confirmMakeAdmin') : t('confirmRemoveAdmin'),
      variant: 'info',
      confirmText: newRole === 'admin' ? t('makeAdmin') : t('removeAdmin'),
      onConfirm: async () => {
        closeConfirm();
        const token = currentToken || accessToken;
        if (!token) { toast.error('No access token available'); return; }
        try {
          const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-a0e1e9cb/users/${userId}/set-role`,
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
    // Master admin always first
    if (a.is_master_admin && !b.is_master_admin) return -1;
    if (!a.is_master_admin && b.is_master_admin) return 1;
    // Then other admins
    if (a.role === 'admin' && b.role !== 'admin') return -1;
    if (a.role !== 'admin' && b.role === 'admin') return 1;
    // Then sort by name
    return (a.name || '').localeCompare(b.name || '');
  });

  const adminUsers = sortedUsers.filter(u => u.role === 'admin');
  const regularUsersUnsorted = sortedUsers.filter(u => u.role !== 'admin');

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
        return (a.name || '').localeCompare(b.name || '');
      case 'name_desc':
        return (b.name || '').localeCompare(a.name || '');
      default:
        return 0;
    }
  });

  // ✅ Navigate to submission detail page
  const handleSubmissionClick = (submission: UserSubmission) => {
    const { page_slug, id } = submission;
    
    // Determine route based on page_slug
    if (page_slug === 'events') {
      navigate(`/events/${id}`);
    } else if (page_slug === 'food-and-drink' || page_slug === 'restaurants' || page_slug === 'cafes') {
      // food-and-drink venues (backward compat: 'restaurants' is the old slug)
      navigate(`/food-and-drink/${id}`);
    } else if (page_slug === 'clubs' || page_slug === 'nightlife') {
      navigate(`/clubs/${id}`);
    } else {
      // Fallback - pokušaj sa page_slug-om
      navigate(`/${page_slug}/${id}`);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-4">
          <Users className="w-6 h-6" style={{ color: 'var(--primary)' }} />
          <h2 className="text-xl font-semibold">{t('users')}</h2>
        </div>
        <p className="text-gray-500">{t('loading')}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-4">
          <Users className="w-6 h-6" style={{ color: 'var(--primary)' }} />
          <h2 className="text-xl font-semibold">{t('users')}</h2>
        </div>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center gap-3 mb-4">
        <Users className="w-6 h-6" style={{ color: 'var(--primary)' }} />
        <h2 className="text-xl font-semibold">{t('users')}</h2>
        <span className="text-sm font-medium px-3 py-1 rounded-full bg-blue-50 text-blue-700">
          {users.length}
        </span>
      </div>

      {/* ===== ADMIN GROUP ===== */}
      {adminUsers.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Crown className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-bold text-amber-700 uppercase tracking-wider">
              {language === 'sr' ? 'Administratori' : 'Administrators'}
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {adminUsers.length}
            </span>
            <div className="flex-1 h-px bg-amber-200 ml-2"></div>
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
            <Users className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-bold text-gray-600 uppercase tracking-wider">
              {language === 'sr' ? 'Korisnici' : 'Users'}
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {regularUsers.length}
            </span>
            <div className="flex-1 h-px bg-gray-200 ml-2"></div>
            {/* Sort controls */}
            <div className="flex items-center gap-1 ml-2">
              <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
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

      {/* Confirm Dialog */}
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
    return (
      <div key={user.id} className="border border-gray-200 rounded-xl overflow-hidden">
        {/* User Header */}
        <div
          onClick={() => toggleUserExpand(user.id, user.email)}
          className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-semibold text-lg">{user.name}</h3>
                {user.role === 'admin' && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                    {t('admin')}
                  </span>
                )}
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
          <div className="border-t border-gray-200 bg-gray-50 p-4">
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-gray-200">
              {/* Master admin is fully protected — no actions allowed */}
              {user.is_master_admin ? (
                <span className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-500 rounded-lg text-sm font-medium">
                  <ShieldCheck className="w-4 h-4" />
                  Master Admin
                </span>
              ) : user.role === 'admin' ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setUserRole(user.id, 'user');
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors text-sm font-medium"
                >
                  <Shield className="w-4 h-4" />
                  {t('removeAdmin')}
                </button>
              ) : (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setUserRole(user.id, 'admin');
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors text-sm font-medium"
                  >
                    <Shield className="w-4 h-4" />
                    {t('makeAdmin')}
                  </button>
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
              )}
            </div>
            
            {loadingSubmissions[user.id] ? (
              <p className="text-sm text-gray-500">{t('loading')}...</p>
            ) : userSubmissions[user.id]?.length > 0 ? (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-gray-700 mb-3">
                  {t('submissions')}
                </h4>
                {userSubmissions[user.id].map((submission) => (
                  <div 
                    key={submission.id} 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSubmissionClick(submission);
                    }}
                    className="bg-white rounded-lg p-3 border border-gray-200 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start gap-3">
                      {submission.image && (
                        <img 
                          src={submission.image} 
                          alt={submission.title}
                          className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h5 className="font-semibold text-sm truncate">{submission.title}</h5>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getCategoryBadgeColor(submission.page_slug)}`}>
                            {getCategoryLabel(submission.page_slug)}
                          </span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadgeColor(submission.status)}`}>
                            {getStatusLabel(submission.status)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          {submission.address && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {submission.address}
                            </span>
                          )}
                          {submission.start_at && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(submission.start_at)}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(submission.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
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