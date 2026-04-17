import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { useT } from '../hooks/useT';
import { useAuth } from '../contexts/AuthContext';
import { Check, X, Edit2, Lock, Calendar, User, Phone, FileText, Trash2, KeyRound, LogOut, Star, Building2, MapPin, Mail } from 'lucide-react';
import { BannerAdminSection } from '../components/BannerAdminSection';
import { UsersAdminSection } from '../components/UsersAdminSection';
import { ConfirmDialog } from '../components/ConfirmDialog';
import * as dataService from '../utils/dataService';
import * as eventService from '../utils/eventService';
import { getCanonicalEventPageSlug } from '../utils/eventPageCategory';
import { shouldHandleSoftRowClick } from '../utils/rowClick';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { translations } from '../utils/translations';
import { formatDate as formatAppDate } from '../utils/dateFormat';

// Interface for Submission (updated to match dataService.Item)
interface Submission {
  id: string;
  title: string;
  title_en?: string;
  category?: string;
  phone?: string;
  website?: string;
  contactEmail?: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string; // ✅ SNAKE_CASE
  submitted_by?: string;
  submitted_by_name?: string;
  contact_name?: string;
  contact_email?: string;
  page_slug?: string;
  venue_type?: string;
  address?: string;
  city?: string;
  event_type?: string;
}

// Interface for Event
interface Event {
  id: string;
  title: string;
  title_en?: string;
  event_type?: string;
  venue_name?: string;
  start_at?: string | null;
  end_at?: string | null;
  description: string;
  image?: string;
  price?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  submitted_by?: string;
  submitted_by_name?: string;
  contact_name?: string;
  contact_email?: string;
  phone?: string;
  organizer_name?: string;
  organizer_phone?: string;
  organizer_email?: string;
  ticket_link?: string;
  address?: string;
  city?: string;
  page_slug?: string;
  venue_type?: string;
}

export function AdminPage() {
  const { t, language } = useT();
  const navigate = useNavigate();
  const { isLoggedIn, isAdmin, isMasterAdmin, user, updateProfile, logout, accessToken, isLoading } = useAuth();

  // Profile editing state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editProfileImage, setEditProfileImage] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  // Change password state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Delete account state
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Venues state
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'active' | 'inactive'>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [rejectConfirmId, setRejectConfirmId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storageMode, setStorageMode] = useState<'local' | 'supabase'>('supabase');
  
  // Events state
  const [eventFilter, setEventFilter] = useState<'all' | 'pending' | 'approved' | 'active' | 'inactive'>('all');
  const [events, setEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [deleteEventConfirmId, setDeleteEventConfirmId] = useState<string | null>(null);
  const [rejectEventConfirmId, setRejectEventConfirmId] = useState<string | null>(null);

  // ✅ BULK SELECT STATE
  const [selectedVenueIds, setSelectedVenueIds] = useState<Set<string>>(new Set());
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [deletingVenues, setDeletingVenues] = useState(false);
  const [deletingEvents, setDeletingEvents] = useState(false);

  // ⭐ FEATURED VENUES STATE
  const [featuredVenueIds, setFeaturedVenueIds] = useState<Set<string>>(new Set());
  const [togglingFeatured, setTogglingFeatured] = useState<string | null>(null);

  // 🔴 INACTIVE VENUES STATE
  const [inactiveVenueIds, setInactiveVenueIds] = useState<Set<string>>(new Set());

  // ✅ CONFIRM DIALOG STATE (replaces window.confirm)
  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string;
    message: string;
    confirmText: string;
    variant: 'danger' | 'warning' | 'info';
    action: () => void;
  } | null>(null);
  const [togglingActive, setTogglingActive] = useState<string | null>(null);

  // 🔴 INACTIVE EVENTS STATE
  const [inactiveEventIds, setInactiveEventIds] = useState<Set<string>>(new Set());
  const [togglingEventActive, setTogglingEventActive] = useState<string | null>(null);
  const topBadgeBaseClass = "inline-flex items-center h-7 px-2.5 rounded-[6px] text-[12px] leading-none font-semibold";

  // 🔒 AUTH GUARD - Redirect if not logged in or not admin
  useEffect(() => {
    // ✅ WAIT for auth to finish loading before redirecting
    if (isLoading) return; // Don't do anything while loading
    
    if (!isLoggedIn) {
      console.warn('⚠️ User not logged in - redirecting to home');
      navigate('/', { replace: true });
      return;
    }
    
    if (!isAdmin) {
      console.warn('⚠️ User is not admin - access denied, redirecting to home');
      navigate('/', { replace: true });
      return;
    }
    
    console.log('✅ Admin access granted:', user?.email);
  }, [isLoading, isLoggedIn, isAdmin, navigate, user]); // ✅ ADD isLoading to dependencies

  // Initialize edit fields when entering edit mode
  useEffect(() => {
    if (isEditingProfile && user) {
      setEditName(user.name || '');
      setEditEmail(user.email || '');
      setEditPhone(user.phone || '');
      setEditProfileImage(user.profileImage || '');
      setImagePreview(user.profileImage || '');
    }
  }, [isEditingProfile, user]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(language === 'sr' ? 'Slika mora biti manja od 5MB' : 'Image must be smaller than 5MB');
      return;
    }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // handleSaveProfile is now inline in the edit form button onClick

  // Load featured venue IDs
  const loadFeaturedIds = async () => {
    try {
      const ids = await dataService.getFeaturedVenueIds();
      setFeaturedVenueIds(new Set(ids));
    } catch (error) {
      console.error('Error loading featured IDs:', error);
    }
  };

  // Load inactive venue IDs
  const loadInactiveIds = async () => {
    try {
      const ids = await dataService.getInactiveVenueIds();
      setInactiveVenueIds(new Set(ids));
    } catch (error) {
      console.error('Error loading inactive IDs:', error);
    }
  };

  // Toggle active status for a venue
  const handleToggleActive = async (id: string, makeActive: boolean) => {
    // If already in desired state, do nothing
    const currentlyInactive = inactiveVenueIds.has(id);
    if (makeActive && !currentlyInactive) return;
    if (!makeActive && currentlyInactive) return;
    
    setTogglingActive(id);
    try {
      const result = await dataService.toggleVenueActive(id);
      if (result) {
        const next = new Set(inactiveVenueIds);
        if (result.is_active) {
          next.delete(id);
          toast.success(t('toastVenueNowActive'));
        } else {
          next.add(id);
          toast.success(t('toastVenueNowInactive'));
        }
        setInactiveVenueIds(next);
      } else {
        toast.error(t('toastActiveStatusFailed'));
      }
    } catch (error) {
      toast.error(t('toastActiveStatusFailed'));
    } finally {
      setTogglingActive(null);
    }
  };

  // Load inactive event IDs
  const loadInactiveEventIds = async () => {
    try {
      const ids = await dataService.getInactiveEventIds();
      setInactiveEventIds(new Set(ids));
    } catch (error) {
      console.error('Error loading inactive event IDs:', error);
    }
  };

  // Toggle active status for an event
  const handleToggleEventActive = async (id: string, makeActive: boolean) => {
    const currentlyInactive = inactiveEventIds.has(id);
    if (makeActive && !currentlyInactive) return;
    if (!makeActive && currentlyInactive) return;
    
    setTogglingEventActive(id);
    try {
      const result = await dataService.toggleEventActive(id);
      if (result) {
        const next = new Set(inactiveEventIds);
        if (result.is_active) {
          next.delete(id);
          toast.success(t('toastEventNowActive'));
        } else {
          next.add(id);
          toast.success(t('toastEventNowInactive'));
        }
        setInactiveEventIds(next);
      } else {
        toast.error(t('toastActiveStatusFailed'));
      }
    } catch (error) {
      toast.error(t('toastActiveStatusFailed'));
    } finally {
      setTogglingEventActive(null);
    }
  };

  // Toggle featured status for a venue
  const handleToggleFeatured = async (id: string) => {
    setTogglingFeatured(id);
    try {
      const result = await dataService.toggleFeaturedVenue(id);
      if (result) {
        const next = new Set(featuredVenueIds);
        if (result.is_featured) {
          next.add(id);
          toast.success(language === 'sr' ? 'Objekat dodan u istaknute' : 'Venue added to featured');
        } else {
          next.delete(id);
          toast.success(language === 'sr' ? 'Objekat uklonjen iz istaknutih' : 'Venue removed from featured');
        }
        setFeaturedVenueIds(next);
      } else {
        toast.error(language === 'sr' ? 'Maksimalno 8 istaknutih objekata' : 'Maximum 8 featured venues');
      }
    } catch (error) {
      toast.error(language === 'sr' ? 'Greška pri ažuriranju' : 'Error updating featured status');
    } finally {
      setTogglingFeatured(null);
    }
  };

  // Load submissions from backend
  useEffect(() => {
    // Only load if auth is ready AND user is admin
    if (!isLoading && isAdmin) {
      loadSubmissions();
      loadFeaturedIds();
      loadInactiveIds();
      loadInactiveEventIds();
    }
  }, [isLoading, isAdmin]);

  const loadSubmissions = async () => {
    setIsLoadingData(true);
    try {
      const data = await dataService.getAllItems();
      
      // Filter out events - they have their own section
      // ⚠️ NE filtriramo po page_slug 'clubs' jer ga dijele nightclub VENUES i club EVENTS
      // Umjesto toga koristimo event_type polje za detekciju legacy eventova zaglavljenih u venues tabeli
      const venuesOnly = data.filter(item => {
        const slug = String(item.page_slug || '').toLowerCase();
        if ((item as any).event_type) return false; // legacy event u venues tabeli
        if (['events', 'event', 'exhibition', 'concerts', 'theatre', 'cinema'].includes(slug)) return false;
        return true;
      });
      setSubmissions(venuesOnly as unknown as Submission[]);
      
      // Check console to determine storage mode
      // If we see "💾 Backend not available" message, we're using localStorage
      const checkStorage = localStorage.getItem('banjaluka_submissions');
      setStorageMode(checkStorage !== null ? 'local' : 'supabase');
      
      console.log(`📦 Loaded ${venuesOnly.length} venues (excluded events)`);
    } catch (error) {
      console.error('Error loading submissions:', error);
      setStorageMode('local');
      setError('Error loading submissions');
    } finally {
      setIsLoadingData(false);
    }
  };

  const filteredSubmissions = submissions.filter(submission => {
    if (filter === 'all') return true;
    if (filter === 'active') return submission.status === 'approved' && !inactiveVenueIds.has(submission.id);
    if (filter === 'inactive') return submission.status === 'approved' && inactiveVenueIds.has(submission.id);
    return submission.status === filter;
  });

  // Calculate submissions created this week
  const getSubmissionsThisWeek = () => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return submissions.filter(submission => {
      const submissionDate = new Date(submission.created_at);
      return submissionDate >= oneWeekAgo && submissionDate <= now;
    }).length;
  };

  // Format date based on language
  const formatDate = (dateStr: string) => {
    return formatAppDate(dateStr, language === 'en' ? 'en' : 'sr');
  };

  const getVenueDetailHref = (submission: Submission): string => {
    const pageSlug = String(submission.page_slug || '').toLowerCase();
    if (pageSlug === 'clubs' || pageSlug === 'nightlife') return `/clubs/${submission.id}`;
    if (pageSlug === 'food-and-drink' || pageSlug === 'restaurants' || pageSlug === 'cafes') return `/food-and-drink/${submission.id}`;
    return `/${pageSlug || 'food-and-drink'}/${submission.id}`;
  };

  const isEventSubmission = (submission: Submission): boolean => {
    const eventPageSlugs = ['concerts', 'theatre', 'cinema', 'events', 'event', 'exhibition'];
    return !!((submission as any).event_type || eventPageSlugs.includes(String(submission.page_slug || '').toLowerCase()));
  };

  const getEventDetailHref = (eventLike: { id: string; event_type?: string; page_slug?: string }): string => {
    const categorySlug = getCanonicalEventPageSlug(eventLike.event_type, eventLike.page_slug);
    return `/${categorySlug}/${eventLike.id}`;
  };

  const handleApprove = async (id: string) => {
    const success = await dataService.approveItem(id);
    if (success) {
      // Reload submissions to get updated data
      loadSubmissions();
    } else {
      alert(t('errorApprovingSubmission') || 'Error approving submission');
    }
  };

  const handleReject = (id: string) => {
    setRejectConfirmId(id);
  };

  const handleEdit = (id: string) => {
    // Find the submission to determine its category
    const submission = submissions.find(s => s.id === id);
    if (!submission) {
      console.error('❌ Submission not found:', id);
      return;
    }

    console.log('✏️ [ADMIN] Editing submission:', { id, page_slug: submission.page_slug, title: submission.title });

    // Navigate to appropriate edit page based on page_slug
    // Pass the full submission data via navigation state so we don't need to fetch it again
    // ⚠️ 'clubs' is shared by nightclub VENUES and club EVENTS — use event_type to distinguish
    const isEvent = !!(submission as any).event_type || ['concerts', 'theatre', 'cinema', 'events'].includes(submission.page_slug);
    if (isEvent) {
      // Event categories - use /submit-event/:id
      console.log('➡️ Navigating to /submit-event/' + id);
      navigate(`/submit-event/${id}`, { state: { eventData: submission } });
    } else {
      // Venue categories (restaurants, cafes, nightlife) - use /add-venue/:id
      console.log('➡️ Navigating to /add-venue/' + id);
      navigate(`/add-venue/${id}`, { state: { venueData: submission } });
    }
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmReject = async () => {
    if (rejectConfirmId !== null) {
      const success = await dataService.rejectItem(rejectConfirmId);
      if (success) {
        loadSubmissions();
        setRejectConfirmId(null);
      } else {
        alert(t('errorRejectingSubmission') || 'Error rejecting submission');
      }
    }
  };

  const confirmDelete = async () => {
    if (deleteConfirmId !== null) {
      const success = await dataService.deleteVenue(deleteConfirmId);
      if (success) {
        loadSubmissions();
        setDeleteConfirmId(null);
      } else {
        alert(t('errorDeletingSubmission') || 'Error deleting submission');
      }
    }
  };

  // Load events from backend
  useEffect(() => {
    // Only load if auth is ready AND user is admin
    if (!isLoading && isAdmin) {
      loadEvents();
    }
  }, [isLoading, isAdmin]);

  const loadEvents = async () => {
    setEventsLoading(true);
    try {
      const data = await eventService.getAllEvents();
      setEvents(data as unknown as Event[]);
      
      // Check console to determine storage mode
      // If we see "💾 Backend not available" message, we're using localStorage
      const checkStorage = localStorage.getItem('banjaluka_events');
      setStorageMode(checkStorage !== null ? 'local' : 'supabase');
      
      console.log(`📦 Loaded ${data.length} events`);
    } catch (error) {
      console.error('Error loading events:', error);
      setStorageMode('local');
      setError('Error loading events');
    } finally {
      setEventsLoading(false);
    }
  };

  const filteredEvents = events.filter(event => {
    if (eventFilter === 'all') return true;
    if (eventFilter === 'active') return event.status === 'approved' && !inactiveEventIds.has(event.id);
    if (eventFilter === 'inactive') return event.status === 'approved' && inactiveEventIds.has(event.id);
    return event.status === eventFilter;
  });

  const eventTabCounts = {
    all: events.length,
    pending: events.filter(e => e.status === 'pending').length,
    approved: events.filter(e => e.status === 'approved').length,
    active: events.filter(e => e.status === 'approved' && !inactiveEventIds.has(e.id)).length,
    inactive: events.filter(e => e.status === 'approved' && inactiveEventIds.has(e.id)).length,
  };

  useEffect(() => {
    // Focused regression debug: track where list size changes.
    console.log(
      `[Admin][EventsDebug] raw=${events.length} mapped=${events.length} tabCounts=${JSON.stringify(eventTabCounts)} currentFilter=${eventFilter} filteredVisible=${filteredEvents.length}`
    );
  }, [events, eventFilter, inactiveEventIds, filteredEvents.length, eventTabCounts.active, eventTabCounts.all, eventTabCounts.approved, eventTabCounts.inactive, eventTabCounts.pending]);

  // Calculate events created this week
  const getEventsThisWeek = () => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return events.filter(event => {
      const eventDate = new Date(event.created_at);
      return eventDate >= oneWeekAgo && eventDate <= now;
    }).length;
  };

  const handleEventApprove = async (id: string) => {
    const success = await eventService.approveEvent(id);
    if (success) {
      // Reload events to get updated data
      loadEvents();
    } else {
      alert(t('errorApprovingEvent') || 'Error approving event');
    }
  };

  const handleEventReject = (id: string) => {
    setRejectEventConfirmId(id);
  };

  const handleEventEdit = (id: string) => {
    navigate(`/submit-event/${id}`);
  };

  const handleEventDelete = (id: string) => {
    setDeleteEventConfirmId(id);
  };

  const confirmEventReject = async () => {
    if (rejectEventConfirmId !== null) {
      const success = await eventService.rejectEvent(rejectEventConfirmId);
      if (success) {
        loadEvents();
        setRejectEventConfirmId(null);
      } else {
        alert(t('errorRejectingEvent') || 'Error rejecting event');
      }
    }
  };

  const confirmEventDelete = async () => {
    if (deleteEventConfirmId !== null) {
      const success = await dataService.deleteEvent(deleteEventConfirmId);
      if (success) {
        loadEvents();
        setDeleteEventConfirmId(null);
      } else {
        alert(t('errorDeletingEvent') || 'Error deleting event');
      }
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-secondary)' }}>
      {/* Only show admin content if logged in AND admin - otherwise redirect already happened */}
      {isLoggedIn && isAdmin && (
        <div className="w-full max-w-[1280px] mx-auto px-4 pt-12 pb-12">

          {/* LOCALSTORAGE MODE INFO */}
          {storageMode === 'local' && (
            <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4 mb-5">
              <div className="flex items-start gap-3">
                <span className="text-[24px]">💾</span>
                <div className="flex-1">
                  <h3 className="text-blue-700 font-semibold mb-2">Running in LocalStorage Mode</h3>
                  <p className="text-[14px] text-blue-600 mb-2">
                    The Supabase backend is not available. All data is stored in your browser's localStorage.
                  </p>
                  <ul className="text-[13px] text-blue-600 list-disc list-inside space-y-1 mb-3">
                    <li>✅ All features work normally (create, approve, reject, delete)</li>
                    <li>⚠️ Data is only saved in THIS browser</li>
                    <li>⚠️ Clearing browser data will delete all submissions</li>
                  </ul>
                  <p className="text-[13px] text-blue-700">
                    <strong>To use Supabase backend:</strong> Deploy the Edge Function using Supabase CLI
                  </p>
                  <button
                    onClick={loadSubmissions}
                    className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-[14px] hover:bg-blue-700 transition-colors"
                  >
                    🔄 Check Backend Connection
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TITLE */}
          <section className="bg-white rounded-2xl p-6 shadow-sm mb-5 border border-gray-100">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            {!isEditingProfile ? (
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="relative w-16 h-16 flex-shrink-0">
                  {user?.profileImage ? (
                    <img
                      src={user.profileImage}
                      alt="Profile"
                      className="w-16 h-16 rounded-full object-cover"
                      style={{ border: '2px solid #0E3DC5' }}
                    />
                  ) : (
                    <div
                      className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center"
                      style={{ border: '2px solid #0E3DC5' }}
                    >
                      <User size={32} className="text-[#0E3DC5]" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1">
                  <h1 style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {t('adminPanel')}
                  </h1>
                  <p style={{ fontSize: '16px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                    {user?.name || user?.email}
                  </p>
                  <p className="text-[14px] mb-1" style={{ color: 'var(--text-secondary)' }}>
                    {user?.email}
                  </p>
                  {user?.phone && (
                    <p className="text-[14px] mb-2" style={{ color: 'var(--text-secondary)' }}>
                      📱 {user.phone}
                    </p>
                  )}
                  {!user?.phone && <div className="mb-2"></div>}
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
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-4">
                {/* PROFILE IMAGE AVATAR WITH +/X */}
                <div className="relative w-16 h-16 flex-shrink-0">
                  <input
                    type="file"
                    id="admin-profile-image-upload"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  
                  {imagePreview ? (
                    <>
                      <img
                        src={imagePreview}
                        alt="Profile"
                        className="w-16 h-16 rounded-full object-cover"
                        style={{ border: '2px solid #0E3DC5' }}
                      />
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
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center"
                        style={{ border: '2px solid #0E3DC5' }}
                      >
                        <User size={32} className="text-[#0E3DC5]" />
                      </div>
                      <button
                        onClick={() => document.getElementById('admin-profile-image-upload')?.click()}
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
                    </>
                  )}
                </div>

                {/* TITLE & PROFILE INFO */}
                <div className="flex-1">
                  <h1
                    style={{
                      fontSize: '32px',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      marginBottom: '12px'
                    }}
                  >
                    {t('editProfile')}
                  </h1>

                  <div className="space-y-3 mb-4 max-w-sm">
                    <div>
                      <label className="block text-[13px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
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
                      <label className="block text-[13px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
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
                      <label className="block text-[13px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
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
                          if (!editPhone.trim()) {
                            toast.error(t('profilePhoneRequired'));
                            return;
                          }
                          const digitsOnly = editPhone.replace(/\D/g, '');
                          if (digitsOnly.length < 9) {
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
                          
                          console.log('💾 Saving profile:', { name: editName, email: editEmail, phone: editPhone, profileImage: finalProfileImageUrl });
                          await updateProfile(editName, editEmail, editPhone, finalProfileImageUrl);
                          
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
                      style={{ cursor: uploadingImage ? 'not-allowed' : 'pointer' }}
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
                      style={{ cursor: uploadingImage ? 'not-allowed' : 'pointer' }}
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
                      style={{ color: '#0E3DC5', border: '1px solid #0E3DC5', background: showChangePassword ? '#0E3DC5' : '#FFFFF' }}
                    >
                      <KeyRound size={14} />
                      {t('changePassword')}
                    </button>
                    {/* Master Admin cannot delete their own account */}
                    {!isMasterAdmin && (
                      <button
                        onClick={async () => {
                          if (!showDeleteAccount) {
                            try {
                              const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-a0e1e9cb/auth/admin-count`, {
                                headers: {
                                  'Authorization': `Bearer ${publicAnonKey}`,
                                  'x-auth-token': accessToken || '',
                                },
                              });
                              const data = await res.json();
                              if (data.adminCount <= 1) {
                                toast.error(t('lastAdminError'));
                                return;
                              }
                            } catch (err) {
                              console.error('❌ Error checking admin count:', err);
                              toast.error(t('lastAdminError'));
                              return;
                            }
                          }
                          setShowDeleteAccount(!showDeleteAccount);
                          setShowChangePassword(false);
                          setDeleteConfirmText('');
                        }}
                        onMouseEnter={(e) => { if (!showDeleteAccount) { e.currentTarget.style.background = '#DC2626'; e.currentTarget.style.color = '#fff'; } }}
                        onMouseLeave={(e) => { if (!showDeleteAccount) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#DC2626'; } }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all cursor-pointer"
                        style={{ color: '#DC2626', border: '1px solid #DC2626', background: showDeleteAccount ? '#FEF2F2' : 'transparent' }}
                      >
                        <Trash2 size={14} />
                        {t('deleteAccount')}
                      </button>
                    )}
                  </div>

                  {/* CHANGE PASSWORD FORM */}
                  {showChangePassword && (
                    <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100 max-w-sm">
                      <h3 className="text-[15px] font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                        {t('changePassword')}
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[13px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
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
                          <label className="block text-[13px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
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
                          <label className="block text-[13px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
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
                              console.log('🔐 [change-password] Response status:', response.status);
                              if (!response.ok) {
                                const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
                                console.error('🔐 [change-password] Error response:', errorData);
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
                              console.error('❌ Error changing password:', error);
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
                      <h3 className="text-[15px] font-semibold mb-2" style={{ color: '#DC2626' }}>
                        {t('deleteAccount')}
                      </h3>
                      <p className="text-[13px] mb-3" style={{ color: 'var(--text-secondary)' }}>
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
                                if (errorData.code === 'LAST_ADMIN') {
                                  toast.error(t('lastAdminError'));
                                  return;
                                }
                                throw new Error(errorData.error || 'Failed to delete account');
                              }
                              toast.success(t('accountDeleted'));
                              logout();
                              navigate('/', { replace: true });
                            } catch (error) {
                              console.error('❌ Error deleting account:', error);
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
                </div>
              </div>
            )}

            {/* RIGHT SIDE - CTA Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 lg:mt-0 flex-shrink-0">
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
          </section>

          {/* BANNER AD MANAGEMENT - ADMIN PANEL ZA UPRAVLJANJE */}
          <BannerAdminSection />

          {/* USERS MANAGEMENT - NEW SECTION */}
          <div className="mb-8">
            <UsersAdminSection
              inactiveVenueIds={inactiveVenueIds}
              inactiveEventIds={inactiveEventIds}
            />
          </div>

          {/* VENUES LIST */}
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8">
            {/* HEADER ROW: Title + Select All + Delete Selected */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="m-0 font-bold" style={{ textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>
                {t('venuesList')}
              </h2>
              {filteredSubmissions.length > 0 && (
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-[13px]" style={{ color: 'var(--text-muted)' }}>
                    <input
                      type="checkbox"
                      checked={filteredSubmissions.length > 0 && selectedVenueIds.size === filteredSubmissions.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedVenueIds(new Set(filteredSubmissions.map(v => v.id)));
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
                          console.log('[Admin][BulkDelete][venues] Selected IDs:', idsToDelete);
                          let deleted = 0;
                          let failed = 0;
                          const successfullyDeleted = new Set<string>();
                          for (const id of idsToDelete) {
                            try {
                              console.log('[Admin][BulkDelete][venues] Deleting venue id:', id);
                              const ok = await dataService.deleteVenue(id);
                              if (ok) {
                                deleted++;
                                successfullyDeleted.add(id);
                                console.log('[Admin][BulkDelete][venues] Success for id:', id);
                              } else {
                                failed++;
                                console.error('[Admin][BulkDelete][venues] Failed for id:', id);
                              }
                            } catch (error) {
                              failed++;
                              console.error('[Admin][BulkDelete][venues] Exception for id:', id, error);
                            }
                          }
                          setSubmissions(prev => prev.filter(v => !successfullyDeleted.has(v.id)));
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

            {/* Filteri za objekte */}
            <div className="flex flex-wrap gap-3 mb-5">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-xl border border-gray-100 text-[14px] cursor-pointer transition-all ${
                  filter === 'all' ? 'border-blue-400 bg-blue-50' : 'bg-white'
                }`}
                style={{
                  color: filter === 'all' ? 'var(--blue-primary)' : 'var(--text-primary)'
                }}
              >
                {t('all')} ({submissions.length})
              </button>
              <button
                onClick={() => setFilter('pending')}
                className={`px-4 py-2 rounded-xl border border-gray-100 text-[14px] cursor-pointer transition-all ${
                  filter === 'pending' ? 'border-orange-400 bg-orange-50' : 'bg-white'
                }`}
                style={{
                  color: filter === 'pending' ? 'var(--accent-orange)' : 'var(--text-primary)'
                }}
              >
                {t('pending')} ({submissions.filter(v => v.status === 'pending').length})
              </button>
              <button
                onClick={() => setFilter('approved')}
                className={`px-4 py-2 rounded-xl border border-gray-100 text-[14px] cursor-pointer transition-all ${
                  filter === 'approved' ? 'border-green-400 bg-green-50' : 'bg-white'
                }`}
                style={{
                  color: filter === 'approved' ? '#059669' : 'var(--text-primary)'
                }}
              >
                {t('approved')} ({submissions.filter(v => v.status === 'approved').length})
              </button>
              <button
                onClick={() => setFilter('active')}
                className={`px-4 py-2 rounded-xl border border-gray-100 text-[14px] cursor-pointer transition-all ${
                  filter === 'active' ? 'border-green-400 bg-green-50' : 'bg-white'
                }`}
                style={{
                  color: filter === 'active' ? '#16A34A' : 'var(--text-primary)'
                }}
              >
                {language === 'sr' ? 'Aktivni' : 'Active'} ({submissions.filter(v => v.status === 'approved' && !inactiveVenueIds.has(v.id)).length})
              </button>
              <button
                onClick={() => setFilter('inactive')}
                className={`px-4 py-2 rounded-xl border border-gray-100 text-[14px] cursor-pointer transition-all ${
                  filter === 'inactive' ? 'border-red-400 bg-red-50' : 'bg-white'
                }`}
                style={{
                  color: filter === 'inactive' ? '#DC2626' : 'var(--text-primary)'
                }}
              >
                {language === 'sr' ? 'Neaktivni' : 'Inactive'} ({submissions.filter(v => v.status === 'approved' && inactiveVenueIds.has(v.id)).length})
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {filteredSubmissions.length === 0 ? (
                <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                  {t('noVenuesFound')}
                </div>
              ) : (
                filteredSubmissions.map((submission) => {
                  const isSelected = selectedVenueIds.has(submission.id);
                  const submissionTitle = language === 'en' ? (submission.title_en || submission.title) : submission.title;
                  const detailHref = isEventSubmission(submission)
                    ? getEventDetailHref(submission as unknown as { id: string; event_type?: string; page_slug?: string })
                    : getVenueDetailHref(submission);
                  return (
                  <div
                    key={submission.id}
                    onClick={(event) => {
                      if (!shouldHandleSoftRowClick(event)) return;
                      navigate(detailHref);
                    }}
                    className="border rounded-xl p-4 hover:shadow-md transition-all cursor-pointer"
                    style={{
                      borderColor: isSelected ? '#0E3DC5' : '#F3F4F6',
                      background: isSelected ? '#EFF3FF' : '#FFFFFF'
                    }}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      
                      {/* LEFT - CHECKBOX + INFO */}
                      <div className="flex items-start gap-3 flex-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const next = new Set(selectedVenueIds);
                            if (e.target.checked) next.add(submission.id);
                            else next.delete(submission.id);
                            setSelectedVenueIds(next);
                          }}
                          className="w-4 h-4 rounded accent-[#0E3DC5] cursor-pointer flex-shrink-0 mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h3 className="m-0 leading-tight">
                              <Link
                                to={detailHref}
                                className="rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 hover:underline"
                                style={{ color: 'inherit', textDecorationColor: '#0E3DC5', textUnderlineOffset: '2px' }}
                              >
                                {submissionTitle}
                              </Link>
                            </h3>
                            <span className={`${topBadgeBaseClass} bg-gray-100`}>
                              {t(('venueType' + (submission.venue_type || submission.page_slug || '').split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join('')) as any)}
                            </span>
                            {/* Status badge: Pending (orange) / Approved (blue, grays out if inactive) */}
                            {(() => {
                              const isActive = !inactiveVenueIds.has(submission.id);
                              const isPendingInAllTab = filter === 'all' && submission.status === 'pending';
                              return (
                                <>
                                  <span className={topBadgeBaseClass} style={{
                                    background: submission.status === 'pending'
                                      ? (isPendingInAllTab ? '#FFF1F2' : '#FFF7ED')
                                      : (!isActive ? '#F3F4F6' : 'rgba(14, 61, 197, 0.06)'),
                                    border: submission.status === 'pending'
                                      ? (isPendingInAllTab ? '1px solid #FDBA74' : '1px solid #FDBA74')
                                      : (!isActive ? '1px solid #D1D5DB' : '1px solid rgba(14, 61, 197, 0.25)'),
                                    color: submission.status === 'pending'
                                      ? (isPendingInAllTab ? '#C2410C' : 'var(--accent-orange)')
                                      : (!isActive ? '#9CA3AF' : '#0E3DC5'),
                                    fontWeight: submission.status === 'pending'
                                      ? (isPendingInAllTab ? 700 : 600)
                                      : 600,
                                  }}>
                                    {submission.status === 'pending' ? t('pending') : t('approved')}
                                  </span>
                                  <div className="inline-flex">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleToggleActive(submission.id, true); }}
                                      disabled={togglingActive === submission.id}
                                      className={`${topBadgeBaseClass} rounded-r-none border`}
                                      style={{
                                        background: isActive ? '#F0FDF4' : '#F3F4F6',
                                        borderColor: isActive ? '#86EFAC' : '#D1D5DB',
                                        color: isActive ? '#16A34A' : '#9CA3AF',
                                        opacity: togglingActive === submission.id ? 0.5 : 1,
                                        cursor: togglingActive === submission.id ? 'not-allowed' : 'pointer',
                                      }}
                                    >
                                      {language === 'sr' ? 'Aktivan' : 'Active'}
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleToggleActive(submission.id, false); }}
                                      disabled={togglingActive === submission.id}
                                      className={`${topBadgeBaseClass} rounded-l-none border border-l-0`}
                                      style={{
                                        background: !isActive ? '#FEF2F2' : '#F3F4F6',
                                        borderColor: !isActive ? '#FCA5A5' : '#D1D5DB',
                                        color: !isActive ? '#DC2626' : '#9CA3AF',
                                        opacity: togglingActive === submission.id ? 0.5 : 1,
                                        cursor: togglingActive === submission.id ? 'not-allowed' : 'pointer',
                                      }}
                                    >
                                      {language === 'sr' ? 'Neaktivan' : 'Inactive'}
                                    </button>
                                  </div>
                                </>
                              );
                            })()}
                            {submission.submitted_by && (
                              <span className={topBadgeBaseClass} style={{ background: 'rgba(107,114,128,0.08)', border: '1px solid rgba(107,114,128,0.2)', color: '#6B7280', fontWeight: 500 }}>
                                {language === 'sr' ? 'Dodao:' : 'Added by:'} {submission.submitted_by_name || submission.submitted_by}
                              </span>
                            )}
                            <span className={topBadgeBaseClass} style={{ background: 'rgba(107,114,128,0.06)', border: '1px solid rgba(107,114,128,0.15)', color: '#9CA3AF', fontWeight: 500 }}>
                              📅 {formatDate(submission.created_at)}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-3 text-[14px]" style={{ color: 'var(--text-muted)' }}>
                            {submission.city && <span className="inline-flex items-center gap-1.5"><Building2 size={14} />{submission.city}</span>}
                            {submission.address && <span className="inline-flex items-center gap-1.5"><MapPin size={14} />{submission.address}</span>}
                            {(submission.contact_name || (submission as any).organizer_name) && <span className="inline-flex items-center gap-1.5"><User size={14} />{submission.contact_name || (submission as any).organizer_name}</span>}
                            {(submission.phone || (submission as any).contact_phone || (submission as any).organizer_phone) && <span className="inline-flex items-center gap-1.5"><Phone size={14} />{submission.phone || (submission as any).contact_phone || (submission as any).organizer_phone}</span>}
                            {(submission.contact_email || (submission as any).organizer_email) && <span className="inline-flex items-center gap-1.5"><Mail size={14} />{submission.contact_email || (submission as any).organizer_email}</span>}
                          </div>
                        </div>
                      </div>

                      {/* RIGHT - ACTIONS */}
                      <div className="flex gap-2">
                        {submission.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(submission.id)}
                              className="p-2 rounded-lg border-0 cursor-pointer bg-green-100 hover:bg-green-200 transition-colors"
                              title={t('approve')}
                            >
                              <Check className="w-4 h-4 text-green-700" />
                            </button>
                            <button
                              onClick={() => handleReject(submission.id)}
                              className="p-2 rounded-lg border-0 cursor-pointer bg-red-100 hover:bg-red-200 transition-colors"
                              title={t('reject')}
                            >
                              <X className="w-4 h-4 text-red-700" />
                            </button>
                          </>
                        )}
                        {/* ⭐ Featured toggle */}
                        {submission.status === 'approved' && (
                          <button
                            onClick={() => handleToggleFeatured(submission.id)}
                            disabled={togglingFeatured === submission.id}
                            className="p-2 rounded-lg border-0 cursor-pointer transition-colors"
                            style={{
                              background: featuredVenueIds.has(submission.id) ? '#FEF3C7' : '#F3F4F6',
                              opacity: togglingFeatured === submission.id ? 0.5 : 1,
                            }}
                            title={featuredVenueIds.has(submission.id)
                              ? (language === 'sr' ? 'Ukloni iz istaknutih' : 'Remove from featured')
                              : (language === 'sr' ? 'Dodaj u istaknute' : 'Add to featured')
                            }
                          >
                            <Star
                              className="w-4 h-4"
                              style={{
                                color: featuredVenueIds.has(submission.id) ? '#D97706' : '#9CA3AF',
                                fill: featuredVenueIds.has(submission.id) ? '#D97706' : 'none',
                              }}
                            />
                          </button>
                        )}
                        <Link
                          to={
                            ((submission as any).event_type || ['concerts', 'theatre', 'cinema', 'events', 'event', 'exhibition'].includes(submission.page_slug || ''))
                              ? `/submit-event/${submission.id}`
                              : `/add-venue/${submission.id}`
                          }
                          className="flex items-center gap-2 px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
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
                  </div>
                  );
                })
              )}
            </div>
          </section>

          {/* EVENTS LIST */}
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            {/* HEADER ROW: Title + Select All + Delete Selected */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="m-0 font-bold" style={{ textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>
                {t('eventsList')}
              </h2>
              {filteredEvents.length > 0 && (
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-[13px]" style={{ color: 'var(--text-muted)' }}>
                    <input
                      type="checkbox"
                      checked={filteredEvents.length > 0 && selectedEventIds.size === filteredEvents.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedEventIds(new Set(filteredEvents.map(ev => ev.id)));
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
                          console.log('[Admin][BulkDelete][events] Selected IDs:', idsToDelete);
                          let deleted = 0;
                          let failed = 0;
                          const successfullyDeleted = new Set<string>();
                          for (const id of idsToDelete) {
                            try {
                              console.log('[Admin][BulkDelete][events] Deleting event id:', id);
                              const ok = await dataService.deleteEvent(id);
                              if (ok) {
                                deleted++;
                                successfullyDeleted.add(id);
                                console.log('[Admin][BulkDelete][events] Success for id:', id);
                              } else {
                                failed++;
                                console.error('[Admin][BulkDelete][events] Failed for id:', id);
                              }
                            } catch (error) {
                              failed++;
                              console.error('[Admin][BulkDelete][events] Exception for id:', id, error);
                            }
                          }
                          setEvents(prev => prev.filter(ev => !successfullyDeleted.has(ev.id)));
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

            {/* Filteri za događaje */}
            <div className="flex flex-wrap gap-3 mb-5">
              <button
                onClick={() => setEventFilter('all')}
                className={`px-4 py-2 rounded-xl border border-gray-100 text-[14px] cursor-pointer transition-all ${
                  eventFilter === 'all' ? 'border-blue-400 bg-blue-50' : 'bg-white'
                }`}
                style={{
                  color: eventFilter === 'all' ? 'var(--blue-primary)' : 'var(--text-primary)'
                }}
              >
                {t('all')} ({events.length})
              </button>
              <button
                onClick={() => setEventFilter('pending')}
                className={`px-4 py-2 rounded-xl border border-gray-100 text-[14px] cursor-pointer transition-all ${
                  eventFilter === 'pending' ? 'border-orange-400 bg-orange-50' : 'bg-white'
                }`}
                style={{
                  color: eventFilter === 'pending' ? 'var(--accent-orange)' : 'var(--text-primary)'
                }}
              >
                {t('pending')} ({events.filter(e => e.status === 'pending').length})
              </button>
              <button
                onClick={() => setEventFilter('approved')}
                className={`px-4 py-2 rounded-xl border border-gray-100 text-[14px] cursor-pointer transition-all ${
                  eventFilter === 'approved' ? 'border-green-400 bg-green-50' : 'bg-white'
                }`}
                style={{
                  color: eventFilter === 'approved' ? '#059669' : 'var(--text-primary)'
                }}
              >
                {t('approved')} ({events.filter(e => e.status === 'approved').length})
              </button>
              <button
                onClick={() => setEventFilter('active')}
                className={`px-4 py-2 rounded-xl border border-gray-100 text-[14px] cursor-pointer transition-all ${
                  eventFilter === 'active' ? 'border-green-400 bg-green-50' : 'bg-white'
                }`}
                style={{
                  color: eventFilter === 'active' ? '#16A34A' : 'var(--text-primary)'
                }}
              >
                {language === 'sr' ? 'Aktivni' : 'Active'} ({events.filter(e => e.status === 'approved' && !inactiveEventIds.has(e.id)).length})
              </button>
              <button
                onClick={() => setEventFilter('inactive')}
                className={`px-4 py-2 rounded-xl border border-gray-100 text-[14px] cursor-pointer transition-all ${
                  eventFilter === 'inactive' ? 'border-red-400 bg-red-50' : 'bg-white'
                }`}
                style={{
                  color: eventFilter === 'inactive' ? '#DC2626' : 'var(--text-primary)'
                }}
              >
                {language === 'sr' ? 'Neaktivni' : 'Inactive'} ({events.filter(e => e.status === 'approved' && inactiveEventIds.has(e.id)).length})
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {filteredEvents.length === 0 ? (
                <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                  {t('noEventsFound')}
                </div>
              ) : (
                filteredEvents.map((event) => {
                  const isSelected = selectedEventIds.has(event.id);
                  const eventTitle = language === 'en' ? (event.title_en || event.title) : event.title;
                  const eventTypeLabel = t(((event.event_type || event.page_slug || 'events') as keyof typeof translations));
                  const detailHref = getEventDetailHref(event as { id: string; event_type?: string; page_slug?: string });
                  return (
                  <div
                    key={event.id}
                    onClick={(eventClick) => {
                      if (!shouldHandleSoftRowClick(eventClick)) return;
                      navigate(detailHref);
                    }}
                    className="border rounded-xl p-4 hover:shadow-md transition-all cursor-pointer"
                    style={{
                      borderColor: isSelected ? '#0E3DC5' : '#F3F4F6',
                      background: isSelected ? '#EFF3FF' : '#FFFFFF'
                    }}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      
                      {/* LEFT - CHECKBOX + INFO */}
                      <div className="flex items-start gap-3 flex-1">
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
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h3 className="m-0 leading-tight">
                              <Link
                                to={detailHref}
                                className="rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 hover:underline"
                                style={{ color: 'inherit', textDecorationColor: '#0E3DC5', textUnderlineOffset: '2px' }}
                              >
                                {eventTitle}
                              </Link>
                            </h3>
                            <span className={`${topBadgeBaseClass} bg-gray-100`}>
                              {eventTypeLabel}
                            </span>
                            {/* Status badge: Pending (orange) / Approved (blue, grays out if expired/inactive) */}
                            {(() => {
                              const isExpired = event.start_at 
                                ? new Date(event.end_at || event.start_at) < new Date() 
                                : false;
                              const isEventActive = !inactiveEventIds.has(event.id);
                              const isFullyActive = isEventActive && !isExpired;
                              const isPendingInAllTab = eventFilter === 'all' && event.status === 'pending';
                              return (
                                <>
                                  <span className={topBadgeBaseClass} style={{
                                    background: event.status === 'pending' 
                                      ? (isPendingInAllTab ? '#FFF1F2' : '#FFF7ED')
                                      : (!isFullyActive ? '#F3F4F6' : 'rgba(14, 61, 197, 0.06)'),
                                    border: event.status === 'pending'
                                      ? (isPendingInAllTab ? '1px solid #FDBA74' : '1px solid #FDBA74')
                                      : (!isFullyActive ? '1px solid #D1D5DB' : '1px solid rgba(14, 61, 197, 0.25)'),
                                    color: event.status === 'pending'
                                      ? (isPendingInAllTab ? '#C2410C' : 'var(--accent-orange)')
                                      : (!isFullyActive ? '#9CA3AF' : '#0E3DC5'),
                                    fontWeight: event.status === 'pending'
                                      ? (isPendingInAllTab ? 700 : 600)
                                      : 600,
                                  }}>
                                    {event.status === 'pending' ? t('pending') : t('approved')}
                                  </span>
                                  {event.status === 'approved' && (
                                    <div className="inline-flex">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleToggleEventActive(event.id, true); }}
                                        disabled={togglingEventActive === event.id}
                                        className={`${topBadgeBaseClass} rounded-r-none border`}
                                        style={{
                                          background: isEventActive ? '#F0FDF4' : '#F3F4F6',
                                          borderColor: isEventActive ? '#86EFAC' : '#D1D5DB',
                                          color: isEventActive ? '#16A34A' : '#9CA3AF',
                                          opacity: togglingEventActive === event.id ? 0.5 : 1,
                                          cursor: togglingEventActive === event.id ? 'not-allowed' : 'pointer',
                                        }}
                                      >
                                        {language === 'sr' ? 'Aktivan' : 'Active'}
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleToggleEventActive(event.id, false); }}
                                        disabled={togglingEventActive === event.id}
                                        className={`${topBadgeBaseClass} rounded-l-none border border-l-0`}
                                        style={{
                                          background: !isEventActive ? '#FEF2F2' : '#F3F4F6',
                                          borderColor: !isEventActive ? '#FCA5A5' : '#D1D5DB',
                                          color: !isEventActive ? '#DC2626' : '#9CA3AF',
                                          opacity: togglingEventActive === event.id ? 0.5 : 1,
                                          cursor: togglingEventActive === event.id ? 'not-allowed' : 'pointer',
                                        }}
                                      >
                                        {language === 'sr' ? 'Neaktivan' : 'Inactive'}
                                      </button>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                            {event.submitted_by && (
                              <span className={topBadgeBaseClass} style={{ background: 'rgba(107,114,128,0.08)', border: '1px solid rgba(107,114,128,0.2)', color: '#6B7280', fontWeight: 500 }}>
                                {language === 'sr' ? 'Dodao:' : 'Added by:'} {event.submitted_by_name || event.submitted_by}
                              </span>
                            )}
                            <span className={topBadgeBaseClass} style={{ background: 'rgba(107,114,128,0.06)', border: '1px solid rgba(107,114,128,0.15)', color: '#9CA3AF', fontWeight: 500 }}>
                              📅 {formatDate(event.created_at)}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-3 text-[14px]" style={{ color: 'var(--text-muted)' }}>
                            {event.city && <span className="inline-flex items-center gap-1.5"><Building2 size={14} />{event.city}</span>}
                            {event.address && <span className="inline-flex items-center gap-1.5"><MapPin size={14} />{event.address}</span>}
                            {event.start_at && <span className="inline-flex items-center gap-1.5"><Calendar size={14} />{formatDate(event.start_at)}</span>}
                            {(event.organizer_name || event.contact_name) && <span className="inline-flex items-center gap-1.5"><User size={14} />{event.organizer_name || event.contact_name}</span>}
                            {(event.organizer_phone || event.phone) && <span className="inline-flex items-center gap-1.5"><Phone size={14} />{event.organizer_phone || event.phone}</span>}
                            {(event.organizer_email || event.contact_email) && <span className="inline-flex items-center gap-1.5"><Mail size={14} />{event.organizer_email || event.contact_email}</span>}
                          </div>
                        </div>
                      </div>

                      {/* RIGHT - ACTIONS */}
                      <div className="flex gap-2">
                        {event.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleEventApprove(event.id)}
                              className="p-2 rounded-lg border-0 cursor-pointer bg-green-100 hover:bg-green-200 transition-colors"
                              title={t('approve')}
                            >
                              <Check className="w-4 h-4 text-green-700" />
                            </button>
                            <button
                              onClick={() => handleEventReject(event.id)}
                              className="p-2 rounded-lg border-0 cursor-pointer bg-red-100 hover:bg-red-200 transition-colors"
                              title={t('reject')}
                            >
                              <X className="w-4 h-4 text-red-700" />
                            </button>
                          </>
                        )}
                        {/* ⭐ Featured toggle for events */}
                        {event.status === 'approved' && (
                          <button
                            onClick={() => handleToggleFeatured(event.id)}
                            disabled={togglingFeatured === event.id}
                            className="p-2 rounded-lg border-0 cursor-pointer transition-colors"
                            style={{
                              background: featuredVenueIds.has(event.id) ? '#FEF3C7' : '#F3F4F6',
                              opacity: togglingFeatured === event.id ? 0.5 : 1,
                            }}
                            title={featuredVenueIds.has(event.id)
                              ? (language === 'sr' ? 'Ukloni iz istaknutih' : 'Remove from featured')
                              : (language === 'sr' ? 'Dodaj u istaknute' : 'Add to featured')
                            }
                          >
                            <Star
                              className="w-4 h-4"
                              style={{
                                color: featuredVenueIds.has(event.id) ? '#D97706' : '#9CA3AF',
                                fill: featuredVenueIds.has(event.id) ? '#D97706' : 'none',
                              }}
                            />
                          </button>
                        )}
                        <Link
                          to={`/submit-event/${event.id}`}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
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
                  </div>
                  );
                })
              )}
            </div>
          </section>

        </div>
      )}

      {/* Delete Confirm Dialog */}
      {deleteConfirmId !== null && (
        <ConfirmDialog
          isOpen={true}
          title={t('deleteVenue')}
          message={t('confirmDeleteVenue')}
          confirmText={t('delete')}
          variant="danger"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirmId(null)}
        />
      )}

      {/* Reject Confirm Dialog */}
      {rejectConfirmId !== null && (
        <ConfirmDialog
          isOpen={true}
          title={t('rejectVenue')}
          message={t('confirmRejectVenue')}
          confirmText={t('reject')}
          variant="warning"
          onConfirm={confirmReject}
          onCancel={() => setRejectConfirmId(null)}
        />
      )}
      
      {/* Delete Event Confirm Dialog */}
      {deleteEventConfirmId !== null && (
        <ConfirmDialog
          isOpen={true}
          title={t('deleteEvent')}
          message={t('confirmDeleteEvent')}
          confirmText={t('delete')}
          variant="danger"
          onConfirm={confirmEventDelete}
          onCancel={() => setDeleteEventConfirmId(null)}
        />
      )}

      {/* Reject Event Confirm Dialog */}
      {rejectEventConfirmId !== null && (
        <ConfirmDialog
          isOpen={true}
          title={t('rejectEvent')}
          message={t('confirmRejectEvent')}
          confirmText={t('reject')}
          variant="warning"
          onConfirm={confirmEventReject}
          onCancel={() => setRejectEventConfirmId(null)}
        />
      )}

      {/* Generic Pending Confirm Dialog (bulk delete, clear all, etc.) */}
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