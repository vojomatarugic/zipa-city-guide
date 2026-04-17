import { useT } from '../hooks/useT';
import { useAuth } from '../contexts/AuthContext';
import { BACKGROUNDS, BORDERS, TEXT, BRAND } from '../utils/colors';
import { Link, useNavigate } from 'react-router';
import { User, FileText, Calendar, Edit2, Upload, X, MapPin, Phone, LogOut, KeyRound, Trash2, Building2, Mail } from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useEffect, useState, useMemo } from 'react';
import * as dataService from '../utils/dataService';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { translations } from '../utils/translations';
import { formatDate as formatAppDate } from '../utils/dateFormat';
import { useLocation as useSelectedCity } from '../contexts/LocationContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { listingDocumentTitle } from '../utils/documentTitle';

export function MyPanelPage() {
  const { t, language } = useT();
  const { isLoggedIn, isAdmin, user, updateProfile, isLoading, logout, accessToken } = useAuth(); // ✅ ADD isLoading
  const navigate = useNavigate();
  const { selectedCity } = useSelectedCity();
  const panelTitle = useMemo(
    () => listingDocumentTitle(t('myPanel'), selectedCity),
    [t, selectedCity],
  );
  useDocumentTitle(panelTitle);
  
  const [userVenues, setUserVenues] = useState<dataService.Item[]>([]);
  const [userEvents, setUserEvents] = useState<dataService.Item[]>([]);
  const [loading, setLoading] = useState(true);
  
  // ✅ SELECTION STATE for individual delete
  const [selectedVenueIds, setSelectedVenueIds] = useState<Set<string>>(new Set());
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [deletingVenues, setDeletingVenues] = useState(false);
  const [deletingEvents, setDeletingEvents] = useState(false);
  const [inactiveVenueIds, setInactiveVenueIds] = useState<Set<string>>(new Set());
  const [inactiveEventIds, setInactiveEventIds] = useState<Set<string>>(new Set());
  const [togglingVenueActiveId, setTogglingVenueActiveId] = useState<string | null>(null);
  const [togglingEventActiveId, setTogglingEventActiveId] = useState<string | null>(null);

  // ✅ CONFIRM DIALOG STATE (replaces window.confirm)
  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string;
    message: string;
    confirmText: string;
    variant: 'danger' | 'warning' | 'info';
    action: () => void;
  } | null>(null);
  const topBadgeBaseClass = "inline-flex items-center h-7 px-2.5 rounded-[6px] text-[12px] leading-none font-semibold";
  const formatDate = (dateStr: string) => {
    return formatAppDate(dateStr, language === 'en' ? 'en' : 'sr');
  };

  const getVenueDetailHref = (venue: dataService.Item): string => {
    const pageSlug = String(venue.page_slug || '').toLowerCase();
    if (pageSlug === 'clubs' || pageSlug === 'nightlife') return `/clubs/${venue.id}`;
    if (pageSlug === 'food-and-drink' || pageSlug === 'restaurants' || pageSlug === 'cafes') return `/food-and-drink/${venue.id}`;
    return `/${pageSlug || 'food-and-drink'}/${venue.id}`;
  };

  const handleToggleVenueActive = async (id: string, makeActive: boolean) => {
    const currentlyInactive = inactiveVenueIds.has(id);
    if (makeActive && !currentlyInactive) return;
    if (!makeActive && currentlyInactive) return;
    setTogglingVenueActiveId(id);
    try {
      const result = await dataService.toggleVenueActive(id);
      if (!result) {
        toast.error(t('toastActiveStatusFailed'));
        return;
      }
      const next = new Set(inactiveVenueIds);
      if (result.is_active) {
        next.delete(id);
        toast.success(t('toastVenueNowActive'));
      } else {
        next.add(id);
        toast.success(t('toastVenueNowInactive'));
      }
      setInactiveVenueIds(next);
    } finally {
      setTogglingVenueActiveId(null);
    }
  };

  const handleToggleEventActive = async (id: string, makeActive: boolean) => {
    const currentlyInactive = inactiveEventIds.has(id);
    if (makeActive && !currentlyInactive) return;
    if (!makeActive && currentlyInactive) return;
    setTogglingEventActiveId(id);
    try {
      const result = await dataService.toggleEventActive(id);
      if (!result) {
        toast.error(t('toastActiveStatusFailed'));
        return;
      }
      const next = new Set(inactiveEventIds);
      if (result.is_active) {
        next.delete(id);
        toast.success(t('toastEventNowActive'));
      } else {
        next.add(id);
        toast.success(t('toastEventNowInactive'));
      }
      setInactiveEventIds(next);
    } finally {
      setTogglingEventActiveId(null);
    }
  };
  
  // ✅ EDIT PROFILE STATE
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editProfileImage, setEditProfileImage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [phoneError, setPhoneError] = useState('');

  // ✅ CHANGE PASSWORD & DELETE ACCOUNT STATE
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  // 🔄 SYNC EDIT STATE WITH USER
  useEffect(() => {
    if (user) {
      setEditName(user.name || '');
      setEditEmail(user.email || '');
      setEditPhone(user.phone || '');
      setEditProfileImage(user.profileImage || '');
      setImagePreview(user.profileImage || '');
    }
  }, [user]);

  // Redirect if not logged in OR if admin (admin uses Admin Panel only!)
  useEffect(() => {
    // ✅ WAIT for auth to finish loading before redirecting
    if (!isLoading && !isLoggedIn) {
      console.log('[MyPanel] User not logged in, redirecting to home');
      navigate('/', { replace: true });
    }
    // 🔥 ADMIN GUARD: Admin should NEVER see My Panel — redirect to Admin Panel
    if (!isLoading && isLoggedIn && isAdmin) {
      console.log('[MyPanel] Admin detected — redirecting to Admin Panel');
      navigate('/admin', { replace: true });
    }
  }, [isLoading, isLoggedIn, isAdmin, navigate]);

  // 🔥 LOAD USER SUBMISSIONS (venues + events)
  useEffect(() => {
    // ✅ CRITICAL: Wait for auth to finish loading before fetching user data.
    // This prevents firing requests with stale tokens from INITIAL_SESSION.
    if (!isLoading && user) {
      console.log('🔥 Loading user submissions for:', user.email);
      setLoading(true);
      
      Promise.all([
        dataService.getMyVenues(),
        dataService.getMyEvents(),
        dataService.getInactiveVenueIds(),
        dataService.getInactiveEventIds(),
      ]).then(([myVenues, myEvents, inactiveVenues, inactiveEvents]) => {
        setUserVenues(myVenues);
        setUserEvents(myEvents);
        setInactiveVenueIds(new Set(inactiveVenues));
        setInactiveEventIds(new Set(inactiveEvents));
        console.log('✅ Loaded:', myVenues.length, 'venues,', myEvents.length, 'events');
        setLoading(false);
      }).catch(error => {
        console.error('❌ Error loading user submissions:', error);
        setLoading(false);
      });
    }
  }, [isLoading, user]);

  // 📤 UPLOAD PROFILE IMAGE
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast.error(t('invalidImageType'));
      e.target.value = ''; // Reset file input
      return;
    }
    
    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error(t('fileTooLargeUpload'));
      e.target.value = ''; // Reset file input
      return;
    }
    
    // Store file for later upload
    setSelectedFile(file);
    
    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    
    // Reset file input so same file can be selected again
    e.target.value = '';
    
    toast.success(t('imageSelected'));
  };

  if (!isLoggedIn || !user) {
    return null;
  }

  return (
    <div 
      className="min-h-screen w-full"
      style={{
        background: '#FFFFFF',
      }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          paddingLeft: '16px',
          paddingRight: '16px',
          paddingTop: '48px',
          paddingBottom: '48px'
        }}
      >
        {/* Header */}
        <div className="mb-8 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          {/* LEFT SIDE - Title, Profile & Admin Panel */}
          <div className="flex items-start gap-4">
            {/* PROFILE IMAGE AVATAR WITH +/X (ONLY IN EDIT MODE) */}
            <div className="relative w-16 h-16 flex-shrink-0">
              {/* Hidden file input */}
              <input
                type="file"
                id="profile-image-upload-main"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              
              {/* Avatar Circle */}
              {imagePreview ? (
                <>
                  {/* Image */}
                  <img
                    src={imagePreview}
                    alt="Profile"
                    className="w-16 h-16 rounded-full object-cover"
                    style={{
                      border: '2px solid #0E3DC5'
                    }}
                  />
                  {/* X Button - Top Right (ONLY IN EDIT MODE) */}
                  {isEditingProfile && (
                    <button
                      onClick={() => {
                        setImagePreview('');
                        setSelectedFile(null);
                        setEditProfileImage('');
                      }}
                      className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-all shadow-lg"
                      style={{ cursor: 'pointer' }}
                      type="button"
                    >
                      <X size={12} />
                    </button>
                  )}
                </>
              ) : (
                <>
                  {/* Placeholder with User Icon */}
                  <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center"
                    style={{
                      border: '2px solid #0E3DC5'
                    }}
                  >
                    <User size={32} className="text-[#0E3DC5]" />
                  </div>
                  {/* + Button - Bottom Right (ONLY IN EDIT MODE) */}
                  {isEditingProfile && (
                    <button
                      onClick={() => document.getElementById('profile-image-upload-main')?.click()}
                      className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-black text-white flex items-center justify-center hover:bg-gray-800 transition-all shadow-lg"
                      style={{ cursor: 'pointer' }}
                      type="button"
                      disabled={uploadingImage}
                    >
                      {uploadingImage ? (
                        <span className="text-[12px]">⏳</span>
                      ) : (
                        <span className="text-[14px] font-bold leading-none">+</span>
                      )}
                    </button>
                  )}
                </>
              )}
            </div>

            {/* TITLE & PROFILE INFO */}
            <div className="flex-1">
              {!isEditingProfile ? (
                <>
                  <h1
                    style={{
                      fontSize: '32px',
                      fontWeight: 700,
                      color: TEXT.primary,
                      marginBottom: '4px'
                    }}
                  >
                    {t('myPanel')}
                  </h1>
                  <p
                    style={{
                      fontSize: '16px',
                      color: TEXT.secondary,
                      marginBottom: '2px'
                    }}
                  >
                    {user.name || user.email}
                  </p>
                  <p className="text-[14px] mb-1" style={{ color: TEXT.secondary }}>
                    {user.email}
                  </p>
                  {user.phone && (
                    <p className="text-[14px] mb-2" style={{ color: TEXT.secondary }}>
                      📱 {user.phone}
                    </p>
                  )}
                  {!user.phone && <div className="mb-2"></div>}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setIsEditingProfile(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-[14px] font-semibold hover:bg-gray-200 transition-all"
                      style={{ cursor: 'pointer' }}
                    >
                      <Edit2 size={16} />
                      {t('editProfile')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h1
                    style={{
                      fontSize: '32px',
                      fontWeight: 700,
                      color: TEXT.primary,
                      marginBottom: '12px'
                    }}
                  >
                    {t('editProfile')}
                  </h1>

                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="block text-[13px] font-semibold mb-1" style={{ color: TEXT.secondary }}>
                        {t('profileName')}
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[14px]"
                        placeholder={t('profileName')}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-semibold mb-1" style={{ color: TEXT.secondary }}>
                        {t('profileEmail')}
                      </label>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[14px]"
                        placeholder={t('profileEmail')}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-semibold mb-1" style={{ color: TEXT.secondary }}>
                        {t('profilePhone')}
                      </label>
                      <input
                        type="tel"
                        value={editPhone}
                        onChange={(e) => {
                          setEditPhone(e.target.value);
                          if (phoneError) setPhoneError('');
                        }}
                        className="w-full px-3 py-2 rounded-lg text-[14px]"
                        style={{
                          border: `1px solid ${phoneError ? '#DC2626' : '#D1D5DB'}`,
                        }}
                        placeholder={t('profilePhone')}
                        required
                      />
                      {phoneError && (
                        <p className="text-[12px] mt-1" style={{ color: '#DC2626' }}>{phoneError}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={async () => {
                        try {
                          // Validate required fields
                          if (!editName.trim()) {
                            toast.error(t('profileNameRequired'));
                            return;
                          }
                          if (!editEmail.trim()) {
                            toast.error(t('profileEmailRequired'));
                            return;
                          }
                          // Validate phone number - REQUIRED
                          if (!editPhone.trim()) {
                            toast.error(t('profilePhoneRequired'));
                            return;
                          }
                          const digitsOnly = editPhone.replace(/\D/g, '');
                          if (!editPhone.trim() || digitsOnly.length < 9) {
                            setPhoneError(
                              language === 'sr'
                                ? 'Broj telefona mora imati najmanje 9 cifara (npr. 065 123 456 ili +387 65 123 456)'
                                : 'Phone number must have at least 9 digits (e.g. 065 123 456 or +387 65 123 456)'
                            );
                            return;
                          }
                          if (digitsOnly.length > 15) {
                            setPhoneError(
                              language === 'sr'
                                ? 'Broj telefona ne može imati više od 15 cifara'
                                : 'Phone number cannot have more than 15 digits'
                            );
                            return;
                          }

                          setUploadingImage(true);
                          let finalProfileImageUrl = editProfileImage;
                          
                          // If there's a new file selected, upload it first
                          if (selectedFile && user) {
                            console.log('📤 Uploading new profile image...');
                            const formData = new FormData();
                            formData.append('file', selectedFile);
                            formData.append('userId', user.id);
                            
                            const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-a0e1e9cb/upload/profile-image`, {
                              method: 'POST',
                              headers: {
                                'Authorization': `Bearer ${publicAnonKey}`,
                              },
                              body: formData,
                            });
                            
                            if (!response.ok) {
                              const errorData = await response.json();
                              throw new Error(errorData.error || 'Failed to upload image');
                            }
                            
                            const data = await response.json();
                            finalProfileImageUrl = data.url;
                            console.log('✅ Image uploaded:', finalProfileImageUrl);
                          }
                          
                          // Now save profile with the uploaded image URL
                          console.log('💾 Saving profile:', { name: editName, email: editEmail, phone: editPhone, profileImage: finalProfileImageUrl });
                          await updateProfile(editName, editEmail, editPhone, finalProfileImageUrl);
                          
                          // Reset state
                          setSelectedFile(null);
                          setIsEditingProfile(false);
                          setUploadingImage(false);
                          
                          toast.success(t('profileSaved'));
                        } catch (error) {
                          console.error('❌ Error saving profile:', error);
                          setUploadingImage(false);
                          toast.error(t('profileSaveError'));
                        }
                      }}
                      className="px-4 py-2 bg-[#0E3DC5] text-white rounded-lg text-[14px] font-semibold hover:bg-[#0a2d94]"
                      disabled={uploadingImage}
                    >
                      {uploadingImage ? `⏳ ${t('saving')}` : t('save')}
                    </button>
                    <button
                      onClick={() => {
                        setEditName(user?.name || '');
                        setEditEmail(user?.email || '');
                        setEditPhone(user?.phone || '');
                        setEditProfileImage(user?.profileImage || '');
                        setImagePreview(user?.profileImage || '');
                        setSelectedFile(null);
                        setIsEditingProfile(false);
                      }}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-[14px] font-semibold hover:bg-gray-200"
                      disabled={uploadingImage}
                    >
                      {t('cancel')}
                    </button>
                  </div>

                  {/* CHANGE PASSWORD & DELETE ACCOUNT */}
                  <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setShowChangePassword(!showChangePassword);
                        setShowDeleteAccount(false);
                        setPasswordError('');
                        setCurrentPassword('');
                        setNewPassword('');
                        setConfirmPassword('');
                      }}
                      onMouseEnter={(e) => { if (!showChangePassword) { e.currentTarget.style.background = '#0E3DC5'; e.currentTarget.style.color = '#fff'; } }}
                      onMouseLeave={(e) => { if (!showChangePassword) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#0E3DC5'; } }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all cursor-pointer"
                      style={{ color: showChangePassword ? '#fff' : '#0E3DC5', border: '1px solid #0E3DC5', background: showChangePassword ? '#0E3DC5' : 'transparent' }}
                    >
                      <KeyRound size={14} />
                      {t('changePassword')}
                    </button>
                    <button
                      onClick={() => {
                        setShowDeleteAccount(!showDeleteAccount);
                        setShowChangePassword(false);
                        setDeleteConfirmText('');
                      }}
                      onMouseEnter={(e) => { if (!showDeleteAccount) { e.currentTarget.style.background = '#DC2626'; e.currentTarget.style.color = '#fff'; } }}
                      onMouseLeave={(e) => { if (!showDeleteAccount) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#DC2626'; } }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all cursor-pointer"
                      style={{ color: showDeleteAccount ? '#fff' : '#DC2626', border: '1px solid #DC2626', background: showDeleteAccount ? '#DC2626' : 'transparent' }}
                    >
                      <Trash2 size={14} />
                      {t('deleteAccount')}
                    </button>
                  </div>

                  {/* CHANGE PASSWORD FORM */}
                  {showChangePassword && (
                    <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100 max-w-sm">
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[13px] font-semibold mb-1" style={{ color: TEXT.secondary }}>
                            {t('currentPassword')} <span style={{ color: '#DC2626' }}>*</span>
                          </label>
                          <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => {
                              setCurrentPassword(e.target.value);
                              if (passwordError) setPasswordError('');
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[14px]"
                            placeholder={t('currentPassword')}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[13px] font-semibold mb-1" style={{ color: TEXT.secondary }}>
                            {t('newPassword')}
                          </label>
                          <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => {
                              setNewPassword(e.target.value);
                              if (passwordError) setPasswordError('');
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[14px]"
                            placeholder={t('newPassword')}
                          />
                        </div>
                        <div>
                          <label className="block text-[13px] font-semibold mb-1" style={{ color: TEXT.secondary }}>
                            {t('confirmNewPassword')}
                          </label>
                          <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => {
                              setConfirmPassword(e.target.value);
                              if (passwordError) setPasswordError('');
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[14px]"
                            placeholder={t('confirmNewPassword')}
                          />
                        </div>
                        {passwordError && (
                          <p className="text-[12px]" style={{ color: '#DC2626' }}>{passwordError}</p>
                        )}
                        <button
                          onClick={async () => {
                            if (!currentPassword.trim()) {
                              setPasswordError(t('currentPasswordRequired'));
                              return;
                            }
                            if (newPassword.length < 6) {
                              setPasswordError(t('passwordTooShort'));
                              return;
                            }
                            if (newPassword !== confirmPassword) {
                              setPasswordError(t('passwordsDoNotMatch'));
                              return;
                            }
                            setChangingPassword(true);
                            try {
                              const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-a0e1e9cb/auth/change-password`, {
                                method: 'POST',
                                headers: {
                                  'Authorization': `Bearer ${publicAnonKey}`,
                                  'x-auth-token': accessToken || '',
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({ currentPassword, newPassword }),
                              });
                              console.log('[change-password] Response status:', response.status);
                              if (!response.ok) {
                                const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
                                console.error('[change-password] Error response:', errorData);
                                if (errorData.code === 'WRONG_PASSWORD' || errorData.error?.includes('incorrect') || errorData.error?.includes('Invalid login credentials')) {
                                  setPasswordError(t('currentPasswordWrong'));
                                  setChangingPassword(false);
                                  return;
                                }
                                throw new Error(errorData.error || errorData.details || 'Failed to change password');
                              }
                              toast.success(t('passwordChanged'));
                              setShowChangePassword(false);
                              setCurrentPassword('');
                              setNewPassword('');
                              setConfirmPassword('');
                            } catch (error) {
                              console.error('Error changing password:', error);
                              toast.error(typeof error === 'object' && error !== null && 'message' in error ? (error as Error).message : t('passwordChangeError'));
                            } finally {
                              setChangingPassword(false);
                            }
                          }}
                          className="px-4 py-2 text-white rounded-lg text-[13px] font-semibold transition-colors"
                          disabled={changingPassword || !currentPassword.trim() || newPassword.length < 6 || newPassword !== confirmPassword}
                          style={{
                            background: (!currentPassword.trim() || newPassword.length < 6 || newPassword !== confirmPassword) ? '#9CA3AF' : '#0E3DC5',
                            cursor: (changingPassword || !currentPassword.trim() || newPassword.length < 6 || newPassword !== confirmPassword) ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {changingPassword ? `⏳ ${t('saving')}` : t('save')}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* DELETE ACCOUNT FORM */}
                  {showDeleteAccount && (
                    <div className="mt-4 p-4 bg-red-50 rounded-xl border border-red-200 max-w-sm">

                      <p className="text-[13px] mb-3" style={{ color: TEXT.secondary }}>
                        {t('deleteAccountConfirm')}
                      </p>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[12px] font-semibold mb-1" style={{ color: '#DC2626' }}>
                            {t('typeDeleteToConfirm')}
                          </label>
                          <input
                            type="text"
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg text-[14px]"
                            style={{ border: '1px solid #FCA5A5' }}
                            placeholder={language === 'sr' ? 'OBRIŠI' : 'DELETE'}
                          />
                        </div>
                        <button
                          onClick={async () => {
                            const confirmWord = language === 'sr' ? 'OBRIŠI' : 'DELETE';
                            if (deleteConfirmText !== confirmWord) return;
                            setDeletingAccount(true);
                            try {
                              const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-a0e1e9cb/auth/delete-account`, {
                                method: 'DELETE',
                                headers: {
                                  'Authorization': `Bearer ${publicAnonKey}`,
                                  'x-auth-token': accessToken || '',
                                  'Content-Type': 'application/json',
                                },
                              });
                              if (!response.ok) {
                                const errorData = await response.json().catch(() => ({}));
                                throw new Error(errorData.error || 'Failed to delete account');
                              }
                              toast.success(t('accountDeleted'));
                              logout();
                              navigate('/', { replace: true });
                            } catch (error) {
                              console.error('Error deleting account:', error);
                              toast.error(t('accountDeleteError'));
                            } finally {
                              setDeletingAccount(false);
                            }
                          }}
                          className="px-4 py-2 rounded-lg text-[13px] font-semibold transition-colors"
                          disabled={deletingAccount || deleteConfirmText !== (language === 'sr' ? 'OBRIŠI' : 'DELETE')}
                          style={{
                            background: deleteConfirmText === (language === 'sr' ? 'OBRIŠI' : 'DELETE') ? '#DC2626' : '#D1D5DB',
                            color: '#FFFFFF',
                            cursor: deletingAccount || deleteConfirmText !== (language === 'sr' ? 'OBRIŠI' : 'DELETE') ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {deletingAccount ? `⏳ ${t('saving')}` : t('deleteAccount')}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* RIGHT SIDE - Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 lg:mt-0">
            <Link
              to="/add-venue"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #0E3DC5 0%, #1E50E6 100%)';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(14, 61, 197, 0.35)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #60A5FA 0%, #0E3DC5 100%)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
              }}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg transition-all"
              style={{
                background: 'linear-gradient(135deg, #60A5FA 0%, #0E3DC5 100%)',
                color: '#FFFFFF',
                fontWeight: 500,
                fontSize: '15px',
                textDecoration: 'none',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
              }}
            >
              <FileText size={18} />
              {t('addObject')}
            </Link>
            <Link
              to="/submit-event"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #0E3DC5 0%, #1E50E6 100%)';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(14, 61, 197, 0.35)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #60A5FA 0%, #0E3DC5 100%)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
              }}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg transition-all"
              style={{
                background: 'linear-gradient(135deg, #60A5FA 0%, #0E3DC5 100%)',
                color: '#FFFFFF',
                fontWeight: 500,
                fontSize: '15px',
                textDecoration: 'none',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
              }}
            >
              <Calendar size={18} />
              {t('addEvent')}
            </Link>
            <button
              onClick={() => {
                logout();
                navigate('/', { replace: true });
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.35)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #F87171 0%, #DC2626 100%)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
              }}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg border-0 cursor-pointer transition-all"
              style={{
                background: 'linear-gradient(135deg, #F87171 0%, #DC2626 100%)',
                color: '#FFFFFF',
                fontWeight: 500,
                fontSize: '15px',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
              }}
            >
              <LogOut size={18} />
              {t('logout')}
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {/* Total Submissions */}
          <div className="p-6 rounded-xl bg-blue-50 border border-blue-100">
            <p className="text-[13px] text-blue-600 font-semibold mb-1">{t('totalSubmissions')}</p>
            <p className="text-[32px] font-bold text-blue-700">
              {userVenues.length + userEvents.length}
            </p>
          </div>

          {/* Pending */}
          <div className="p-6 rounded-xl bg-orange-50 border border-orange-100">
            <p className="text-[13px] text-orange-600 font-semibold mb-1">{t('pendingSubmissions')}</p>
            <p className="text-[32px] font-bold text-orange-700">
              {[...userVenues, ...userEvents].filter(item => item.status === 'pending').length}
            </p>
          </div>

          {/* Approved */}
          <div className="p-6 rounded-xl bg-green-50 border border-green-100">
            <p className="text-[13px] text-green-600 font-semibold mb-1">{t('approvedSubmissions')}</p>
            <p className="text-[32px] font-bold text-green-700">
              {[...userVenues, ...userEvents].filter(item => item.status === 'approved').length}
            </p>
          </div>

          {/* Rejected */}
          <div className="p-6 rounded-xl bg-gray-50 border border-gray-200">
            <p className="text-[13px] text-gray-600 font-semibold mb-1">{t('rejectedSubmissions')}</p>
            <p className="text-[32px] font-bold text-gray-700">
              {[...userVenues, ...userEvents].filter(item => item.status === 'rejected').length}
            </p>
          </div>
        </div>

        {/* MY VENUES SECTION */}
        <div
          className="p-8 rounded-xl mt-6"
          style={{
            background: '#FFFFFF',
            border: `1px solid ${BORDERS.light}`,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
          }}
        >
          {/* HEADER ROW: Title + Select All + Delete Selected */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2
              style={{
                fontSize: '20px',
                fontWeight: 600,
                color: TEXT.primary,
                margin: 0
              }}
            >
              {t('myVenues')} ({userVenues.length})
            </h2>
            {userVenues.length > 0 && (
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer select-none text-[13px]" style={{ color: TEXT.secondary }}>
                  <input
                    type="checkbox"
                    checked={userVenues.length > 0 && selectedVenueIds.size === userVenues.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedVenueIds(new Set(userVenues.map(v => v.id)));
                      } else {
                        setSelectedVenueIds(new Set());
                      }
                    }}
                    className="w-4 h-4 rounded accent-[#0E3DC5] cursor-pointer"
                  />
                  {t('selectAll')}
                </label>
                <button
                    disabled={deletingVenues || selectedVenueIds.size === 0}
                    onClick={() => {
                      const count = selectedVenueIds.size;
                      setPendingConfirm({
                        title: language === 'sr' ? 'Brisanje objekata' : 'Delete Venues',
                        message: language === 'sr'
                          ? `Da li ste sigurni da želite da obrišete ${count} odabran${count === 1 ? 'i' : 'ih'} objekat${count === 1 ? '' : 'a'}? Ova akcija se ne može poništiti!`
                          : `Are you sure you want to delete ${count} selected venue${count === 1 ? '' : 's'}? This action cannot be undone!`,
                        confirmText: language === 'sr' ? 'Obriši' : 'Delete',
                        variant: 'danger',
                        action: async () => {
                          setPendingConfirm(null);
                          setDeletingVenues(true);
                          const idsToDelete = Array.from(selectedVenueIds);
                          console.log('[MyPanel][BulkDelete][venues] Selected IDs:', idsToDelete);
                          let deleted = 0;
                          let failed = 0;
                          const successfullyDeleted = new Set<string>();
                          for (const id of idsToDelete) {
                            try {
                              console.log('[MyPanel][BulkDelete][venues] Deleting venue id:', id);
                              const ok = await dataService.deleteVenue(id);
                              if (ok) {
                                deleted++;
                                successfullyDeleted.add(id);
                                console.log('[MyPanel][BulkDelete][venues] Success for id:', id);
                              } else {
                                failed++;
                                console.error('[MyPanel][BulkDelete][venues] Failed for id:', id);
                              }
                            } catch (error) {
                              failed++;
                              console.error('[MyPanel][BulkDelete][venues] Exception for id:', id, error);
                            }
                          }
                          setUserVenues(prev => prev.filter(v => !successfullyDeleted.has(v.id)));
                          setSelectedVenueIds(new Set());
                          setDeletingVenues(false);
                          if (failed === 0) {
                            toast.success(language === 'sr' ? `Obrisano ${deleted} objekat${deleted === 1 ? '' : 'a'}` : `Deleted ${deleted} venue${deleted === 1 ? '' : 's'}`);
                          } else {
                            toast.error(language === 'sr' ? `Obrisano ${deleted}, neuspješno ${failed}` : `Deleted ${deleted}, failed ${failed}`);
                          }
                        },
                      });
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-[13px] font-semibold transition-all"
                    style={{
                      background: deletingVenues ? '#9CA3AF' : selectedVenueIds.size === 0 ? '#D1D5DB' : 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                      border: 'none',
                      cursor: deletingVenues || selectedVenueIds.size === 0 ? 'not-allowed' : 'pointer',
                      boxShadow: selectedVenueIds.size > 0 ? '0 2px 4px rgba(239, 68, 68, 0.3)' : 'none',
                      opacity: selectedVenueIds.size === 0 ? 0.6 : 1
                    }}
                  >
                    {deletingVenues ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {t('deletingInProgress')}
                      </>
                    ) : (
                      <>
                        <span>🗑️</span>
                        {t('deleteSelectedVenues')}{selectedVenueIds.size > 0 ? ` (${selectedVenueIds.size})` : ''}
                      </>
                    )}
                  </button>
              </div>
            )}
          </div>
          
          {loading ? (
            <p style={{ color: TEXT.secondary }}>{t('loading')}...</p>
          ) : (
            <>
              {userVenues.length > 0 ? (
                <div className="space-y-3">
                  {userVenues.map(venue => {
                    const isSelected = selectedVenueIds.has(venue.id);
                    const isActive = !inactiveVenueIds.has(venue.id);
                    const venueTitle = language === 'en' ? (venue.title_en || venue.title) : venue.title;
                    const venueDetailHref = getVenueDetailHref(venue);
                    const statusColor = venue.status === 'approved' ? '#16A34A' : venue.status === 'rejected' ? '#DC2626' : '#F59E0B';
                    const statusBg = venue.status === 'approved' ? '#F0FDF4' : venue.status === 'rejected' ? '#FEF2F2' : '#FFFBEB';
                    const statusLabel = venue.status === 'approved' ? t('statusApproved') : venue.status === 'rejected' ? t('statusRejected') : t('statusPending');
                    const typeSource = (venue.venue_type || venue.category || '').toString();
                    const typeKey = typeSource
                      ? (`venueType${typeSource.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join('')}` as keyof typeof translations)
                      : null;
                    const typeLabel =
                      (typeKey ? t(typeKey) : '') ||
                      typeSource ||
                      t('categoryFoodAndDrink');
                    return (
                      <div
                        key={venue.id}
                        className="flex items-start gap-3 p-4 rounded-lg border transition-all"
                        style={{
                          borderColor: isSelected ? '#0E3DC5' : BORDERS.light,
                          background: isSelected ? '#EFF3FF' : '#FAFBFC'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const next = new Set(selectedVenueIds);
                            if (e.target.checked) next.add(venue.id);
                            else next.delete(venue.id);
                            setSelectedVenueIds(next);
                          }}
                          className="w-4 h-4 rounded accent-[#0E3DC5] cursor-pointer flex-shrink-0 mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <h4 style={{ fontSize: '15px', fontWeight: 600, color: TEXT.primary, margin: 0 }}>
                              <Link to={venueDetailHref} style={{ color: 'inherit', textDecoration: 'none' }}>
                                {venueTitle}
                              </Link>
                            </h4>
                            <span className={`${topBadgeBaseClass} bg-gray-100`} style={{ color: TEXT.secondary }}>
                              {typeLabel}
                            </span>
                            <span
                              className={topBadgeBaseClass}
                              style={{ background: statusBg, color: statusColor, border: `1px solid ${statusColor}30` }}
                            >
                              {statusLabel}
                            </span>
                            <div className="inline-flex">
                              <button
                                type="button"
                                onClick={() => handleToggleVenueActive(venue.id, true)}
                                disabled={togglingVenueActiveId === venue.id}
                                className={`${topBadgeBaseClass} rounded-r-none border`}
                                style={{
                                  background: isActive ? '#F0FDF4' : '#F3F4F6',
                                  borderColor: isActive ? '#86EFAC' : '#D1D5DB',
                                  color: isActive ? '#16A34A' : '#9CA3AF',
                                  opacity: togglingVenueActiveId === venue.id ? 0.5 : 1,
                                  cursor: togglingVenueActiveId === venue.id ? 'not-allowed' : 'pointer',
                                }}
                              >
                                {language === 'sr' ? 'Aktivan' : 'Active'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleVenueActive(venue.id, false)}
                                disabled={togglingVenueActiveId === venue.id}
                                className={`${topBadgeBaseClass} rounded-l-none border border-l-0`}
                                style={{
                                  background: !isActive ? '#FEF2F2' : '#F3F4F6',
                                  borderColor: !isActive ? '#FCA5A5' : '#D1D5DB',
                                  color: !isActive ? '#DC2626' : '#9CA3AF',
                                  opacity: togglingVenueActiveId === venue.id ? 0.5 : 1,
                                  cursor: togglingVenueActiveId === venue.id ? 'not-allowed' : 'pointer',
                                }}
                              >
                                {language === 'sr' ? 'Neaktivan' : 'Inactive'}
                              </button>
                            </div>
                            {venue.created_at && (
                              <span className={topBadgeBaseClass} style={{ background: 'rgba(107,114,128,0.06)', border: '1px solid rgba(107,114,128,0.15)', color: '#9CA3AF', fontWeight: 500 }}>
                                📅 {formatDate(venue.created_at)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 flex-wrap text-[13px]" style={{ color: TEXT.secondary }}>
                            {venue.city && <span className="inline-flex items-center gap-1.5"><Building2 size={14} />{venue.city}</span>}
                            {venue.address && <span className="inline-flex items-center gap-1.5"><MapPin size={14} />{venue.address}</span>}
                            {venue.contact_name && <span className="inline-flex items-center gap-1.5"><User size={14} />{venue.contact_name}</span>}
                            {(venue.phone || venue.contact_phone) && <span className="inline-flex items-center gap-1.5"><Phone size={14} />{venue.phone || venue.contact_phone}</span>}
                            {venue.contact_email && <span className="inline-flex items-center gap-1.5"><Mail size={14} />{venue.contact_email}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Link
                            to={`/add-venue/${venue.id}`}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg hover:opacity-90 transition-opacity flex-shrink-0"
                            style={{
                              background: 'linear-gradient(135deg, #60A5FA 0%, #0E3DC5 100%)',
                              color: '#FFFFFF',
                              fontWeight: 500,
                              fontSize: '14px',
                              textDecoration: 'none'
                            }}
                          >
                            <Edit2 size={16} />
                            {t('edit')}
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ fontSize: '14px', color: TEXT.secondary }}>
                  {t('noVenuesYet')}
                </p>
              )}
            </>
          )}
        </div>

        {/* MY EVENTS SECTION */}
        <div
          className="p-8 rounded-xl mt-6"
          style={{
            background: '#FFFFFF',
            border: `1px solid ${BORDERS.light}`,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
          }}
        >
          {/* HEADER ROW: Title + Select All + Delete Selected */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2
              style={{
                fontSize: '20px',
                fontWeight: 600,
                color: TEXT.primary,
                margin: 0
              }}
            >
              {t('myEvents')} ({userEvents.length})
            </h2>
            {userEvents.length > 0 && (
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer select-none text-[13px]" style={{ color: TEXT.secondary }}>
                  <input
                    type="checkbox"
                    checked={userEvents.length > 0 && selectedEventIds.size === userEvents.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedEventIds(new Set(userEvents.map(ev => ev.id)));
                      } else {
                        setSelectedEventIds(new Set());
                      }
                    }}
                    className="w-4 h-4 rounded accent-[#0E3DC5] cursor-pointer"
                  />
                  {t('selectAll')}
                </label>
                <button
                    disabled={deletingEvents || selectedEventIds.size === 0}
                    onClick={() => {
                      const count = selectedEventIds.size;
                      setPendingConfirm({
                        title: language === 'sr' ? 'Brisanje dešavanja' : 'Delete Events',
                        message: language === 'sr'
                          ? `Da li ste sigurni da želite da obrišete ${count} odabran${count === 1 ? 'o' : 'ih'} dešavanje${count === 1 ? '' : 'a'}? Ova akcija se ne može poništiti!`
                          : `Are you sure you want to delete ${count} selected event${count === 1 ? '' : 's'}? This action cannot be undone!`,
                        confirmText: language === 'sr' ? 'Obriši' : 'Delete',
                        variant: 'danger',
                        action: async () => {
                          setPendingConfirm(null);
                          setDeletingEvents(true);
                          const idsToDelete = Array.from(selectedEventIds);
                          console.log('[MyPanel][BulkDelete][events] Selected IDs:', idsToDelete);
                          let deleted = 0;
                          let failed = 0;
                          const successfullyDeleted = new Set<string>();
                          for (const id of idsToDelete) {
                            try {
                              console.log('[MyPanel][BulkDelete][events] Deleting event id:', id);
                              const ok = await dataService.deleteEvent(id);
                              if (ok) {
                                deleted++;
                                successfullyDeleted.add(id);
                                console.log('[MyPanel][BulkDelete][events] Success for id:', id);
                              } else {
                                failed++;
                                console.error('[MyPanel][BulkDelete][events] Failed for id:', id);
                              }
                            } catch (error) {
                              failed++;
                              console.error('[MyPanel][BulkDelete][events] Exception for id:', id, error);
                            }
                          }
                          setUserEvents(prev => prev.filter(ev => !successfullyDeleted.has(ev.id)));
                          setSelectedEventIds(new Set());
                          setDeletingEvents(false);
                          if (failed === 0) {
                            toast.success(language === 'sr' ? `Obrisano ${deleted} dešavanje${deleted === 1 ? '' : 'a'}` : `Deleted ${deleted} event${deleted === 1 ? '' : 's'}`);
                          } else {
                            toast.error(language === 'sr' ? `Obrisano ${deleted}, neuspješno ${failed}` : `Deleted ${deleted}, failed ${failed}`);
                          }
                        },
                      });
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-[13px] font-semibold transition-all"
                    style={{
                      background: deletingEvents ? '#9CA3AF' : selectedEventIds.size === 0 ? '#D1D5DB' : 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                      border: 'none',
                      cursor: deletingEvents || selectedEventIds.size === 0 ? 'not-allowed' : 'pointer',
                      boxShadow: selectedEventIds.size > 0 ? '0 2px 4px rgba(239, 68, 68, 0.3)' : 'none',
                      opacity: selectedEventIds.size === 0 ? 0.6 : 1
                    }}
                  >
                    {deletingEvents ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {t('deletingInProgress')}
                      </>
                    ) : (
                      <>
                        <span>🗑️</span>
                        {t('deleteSelectedEvents')}{selectedEventIds.size > 0 ? ` (${selectedEventIds.size})` : ''}
                      </>
                    )}
                  </button>
              </div>
            )}
          </div>
          
          {loading ? (
            <p style={{ color: TEXT.secondary }}>{t('loading')}...</p>
          ) : (
            <>
              {userEvents.length > 0 ? (
                <div className="space-y-3">
                  {userEvents.map(event => {
                    const isSelected = selectedEventIds.has(event.id);
                    const isActive = !inactiveEventIds.has(event.id);
                    const eventTitle = language === 'en' ? (event.title_en || event.title) : event.title;
                    const statusColor = event.status === 'approved' ? '#16A34A' : event.status === 'rejected' ? '#DC2626' : '#F59E0B';
                    const statusBg = event.status === 'approved' ? '#F0FDF4' : event.status === 'rejected' ? '#FEF2F2' : '#FFFBEB';
                    const statusLabel = event.status === 'approved' ? t('statusApproved') : event.status === 'rejected' ? t('statusRejected') : t('statusPending');
                    const eventDateLabel = event.start_at
                      ? formatAppDate(event.start_at as string, language === 'en' ? 'en' : 'sr')
                      : formatAppDate(event.date || '', language === 'en' ? 'en' : 'sr');
                    const eventLocation = event.address || event.venue_name || '';
                    const eventTypeLabel = t(((event.event_type || event.page_slug || 'events') as keyof typeof translations));
                    return (
                      <div
                        key={event.id}
                        className="flex items-start gap-3 p-4 rounded-lg border transition-all"
                        style={{
                          borderColor: isSelected ? '#0E3DC5' : BORDERS.light,
                          background: isSelected ? '#EFF3FF' : '#FAFBFC'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const next = new Set(selectedEventIds);
                            if (e.target.checked) next.add(event.id);
                            else next.delete(event.id);
                            setSelectedEventIds(next);
                          }}
                          className="w-4 h-4 rounded accent-[#0E3DC5] cursor-pointer flex-shrink-0 mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <h4 style={{ fontSize: '15px', fontWeight: 600, color: TEXT.primary, margin: 0 }}>
                              <Link to={`/events/${event.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                                {eventTitle}
                              </Link>
                            </h4>
                            <span className={`${topBadgeBaseClass} bg-gray-100`} style={{ color: TEXT.secondary }}>
                              {eventTypeLabel}
                            </span>
                            <span
                              className={topBadgeBaseClass}
                              style={{ background: statusBg, color: statusColor, border: `1px solid ${statusColor}30` }}
                            >
                              {statusLabel}
                            </span>
                            <div className="inline-flex">
                              <button
                                type="button"
                                onClick={() => handleToggleEventActive(event.id, true)}
                                disabled={togglingEventActiveId === event.id}
                                className={`${topBadgeBaseClass} rounded-r-none border`}
                                style={{
                                  background: isActive ? '#F0FDF4' : '#F3F4F6',
                                  borderColor: isActive ? '#86EFAC' : '#D1D5DB',
                                  color: isActive ? '#16A34A' : '#9CA3AF',
                                  opacity: togglingEventActiveId === event.id ? 0.5 : 1,
                                  cursor: togglingEventActiveId === event.id ? 'not-allowed' : 'pointer',
                                }}
                              >
                                {language === 'sr' ? 'Aktivan' : 'Active'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleEventActive(event.id, false)}
                                disabled={togglingEventActiveId === event.id}
                                className={`${topBadgeBaseClass} rounded-l-none border border-l-0`}
                                style={{
                                  background: !isActive ? '#FEF2F2' : '#F3F4F6',
                                  borderColor: !isActive ? '#FCA5A5' : '#D1D5DB',
                                  color: !isActive ? '#DC2626' : '#9CA3AF',
                                  opacity: togglingEventActiveId === event.id ? 0.5 : 1,
                                  cursor: togglingEventActiveId === event.id ? 'not-allowed' : 'pointer',
                                }}
                              >
                                {language === 'sr' ? 'Neaktivan' : 'Inactive'}
                              </button>
                            </div>
                            {event.created_at && (
                              <span className={topBadgeBaseClass} style={{ background: 'rgba(107,114,128,0.06)', border: '1px solid rgba(107,114,128,0.15)', color: '#9CA3AF', fontWeight: 500 }}>
                                📅 {formatDate(event.created_at)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 flex-wrap text-[13px]" style={{ color: TEXT.secondary }}>
                            {event.city && <span className="inline-flex items-center gap-1.5"><Building2 size={14} />{event.city}</span>}
                            {eventLocation && <span className="inline-flex items-center gap-1.5"><MapPin size={14} />{eventLocation}</span>}
                            {eventDateLabel && <span className="inline-flex items-center gap-1.5"><Calendar size={14} />{eventDateLabel}</span>}
                            {(event.organizerName || event.organizer_name || event.contact_name) && <span className="inline-flex items-center gap-1.5"><User size={14} />{(event as any).organizerName || event.organizer_name || event.contact_name}</span>}
                            {event.organizer_phone && <span className="inline-flex items-center gap-1.5"><Phone size={14} />{event.organizer_phone}</span>}
                            {event.organizer_email && <span className="inline-flex items-center gap-1.5"><Mail size={14} />{event.organizer_email}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Link
                            to={`/submit-event/${event.id}`}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg hover:opacity-90 transition-opacity flex-shrink-0"
                            style={{
                              background: 'linear-gradient(135deg, #60A5FA 0%, #0E3DC5 100%)',
                              color: '#FFFFFF',
                              fontWeight: 500,
                              fontSize: '14px',
                              textDecoration: 'none'
                            }}
                          >
                            <Edit2 size={16} />
                            {t('edit')}
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ fontSize: '14px', color: TEXT.secondary }}>
                  {t('noEventsYet')}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Generic Pending Confirm Dialog (bulk delete) */}
      {pendingConfirm && (
        <ConfirmDialog
          isOpen={true}
          title={pendingConfirm.title}
          message={pendingConfirm.message}
          confirmText={pendingConfirm.confirmText}
          variant={pendingConfirm.variant}
          onConfirm={pendingConfirm.action}
          onCancel={() => setPendingConfirm(null)}
        />
      )}
    </div>
  );
}