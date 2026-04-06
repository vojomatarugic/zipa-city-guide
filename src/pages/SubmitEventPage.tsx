import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router';
import { Calendar, MapPin, Phone, Mail, Globe, Tag, DollarSign, User, CalendarIcon, Clock, UserCheck, Search, X, Pencil } from 'lucide-react';
import { useT } from '../hooks/useT';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { CustomDropdown } from '../components/CustomDropdown';
import { NotificationDialog } from '../components/NotificationDialog';
import DatePickerImport from 'react-datepicker';
import type { DatePickerProps } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const DatePicker = DatePickerImport as React.ComponentType<DatePickerProps>;
import { enUS } from 'date-fns/locale';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import * as dataService from '../utils/dataService';

// Custom srpski latinica locale
const srLatn = {
  code: 'sr-Latn',
  formatDistance: () => '',
  formatRelative: () => '',
  localize: {
    ordinalNumber: (n: number) => String(n),
    era: () => '',
    quarter: () => '',
    month: (n: number) => {
      const months = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun', 'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
      return months[n];
    },
    day: (n: number) => {
      // Kada weekStartsOn=1 (PON), react-datepicker očekuje: PON=0, UTO=1, SRI=2, ČET=3, PET=4, SUB=5, NED=6
      const days = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'];
      return days[n];
    },
    dayPeriod: () => '',
  },
  formatLong: {
    date: () => 'dd.MM.yyyy',
    time: () => 'HH:mm',
    dateTime: () => 'dd.MM.yyyy HH:mm',
  },
  match: {
    ordinalNumber: () => ({ value: 0, rest: '' }),
    era: () => ({ value: 0, rest: '' }),
    quarter: () => ({ value: 0, rest: '' }),
    month: () => ({ value: 0, rest: '' }),
    day: () => ({ value: 0, rest: '' }),
    dayPeriod: () => ({ value: 0, rest: '' }),
  },
  options: {
    weekStartsOn: 1 as const,
    firstWeekContainsDate: 1,
  },
};

export function SubmitEventPage() {
  const { t } = useT();
  const roleLabels: Record<string, string> = {
    user: t('user'),
    admin: t('admin'),
  };
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { user, isAdmin } = useAuth();
  
  // 🔥 PREVENT MULTIPLE LOADS - only load once when in edit mode
  const hasLoadedRef = useRef(false);

  // 🔥 SANITIZE legacy event_type values that are no longer valid in DB
  const VALID_EVENT_TYPES = ['cinema', 'club', 'concert', 'conference', 'exhibition', 'festival', 'gastro', 'kids', 'other', 'sport', 'standup', 'theatre', 'workshop'];
  const sanitizeEventType = (type: string | undefined | null): string => {
    if (!type) return '';
    if (VALID_EVENT_TYPES.includes(type)) return type;
    // Map legacy types to valid ones
    if (type === 'nightlife') return 'club';
    if (type === 'music') return 'concert';
    return 'other';
  };

  const [formData, setFormData] = useState({
    eventType: '',
    eventName: '',
    eventNameEn: '',
    eventDate: '',
    eventTime: '',
    startTime: '',
    endTime: '',
    venue: '',
    address: '',
    description: '',
    descriptionEn: '',
    ticketLink: '',
    priceType: 'free',
    price: '',
    organizerName: '',
    organizerPhone: '',
    organizerEmail: '',
    submittedByEmail: ''
  });

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [timeError, setTimeError] = useState<string>('');
  const [addressError, setAddressError] = useState<string>('');
  const [eventNameEnError, setEventNameEnError] = useState<string>('');
  const [descriptionEnError, setDescriptionEnError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [existingEvent, setExistingEvent] = useState<dataService.Item | null>(null);

  // 🔥 Admin user search/assign state
  interface SuggestedUser { id: string; email: string; name: string; phone: string; role: string; }
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [emailSearchQuery, setEmailSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [creatorEditMode, setCreatorEditMode] = useState(false);
  const [resolvedCreatorName, setResolvedCreatorName] = useState<string | null>(null);
  const suggestRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Non-admin CREATE: submitted_by is always the logged-in user (read-only in UI).
  // Admins must pick a registered user from search — do not pre-fill their own email as "creator".
  useEffect(() => {
    if (user?.email && !id && !isAdmin && !formData.submittedByEmail) {
      setFormData(prev => ({ ...prev, submittedByEmail: user.email || '' }));
    }
  }, [user?.email, id, isAdmin]);

  // 🔥 Admin: auto-populate emailSearchQuery + resolve user in EDIT mode
  useEffect(() => {
    if (id && formData.submittedByEmail && isAdmin) {
      setEmailSearchQuery(formData.submittedByEmail);
      // Auto-lookup user
      (async () => {
        try {
          const { supabase } = await import('../utils/supabaseClient');
          const { data } = await supabase.auth.getSession();
          const accessToken = data?.session?.access_token || null;
          const headers: Record<string, string> = {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          };
          if (accessToken) headers['x-auth-token'] = accessToken;
          const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-a0e1e9cb/users/search?q=${encodeURIComponent(formData.submittedByEmail)}`,
            { headers }
          );
          if (response.ok) {
            const d = await response.json();
            const matched = (d.users || []).find((u: SuggestedUser) => u.email === formData.submittedByEmail);
            if (matched) {
              setSelectedUserId(matched.id);
              setResolvedCreatorName(matched.name || 'Bez imena');
            }
          }
        } catch (err) {
          console.warn('⚠️ Auto-lookup user failed:', err);
        }
      })();
    }
  }, [id, formData.submittedByEmail, isAdmin]);

  // 🔍 Admin: Search users by email with debounce
  useEffect(() => {
    if (!isAdmin || emailSearchQuery.length < 2 || selectedUserId) {
      setSuggestedUsers([]);
      return;
    }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { supabase } = await import('../utils/supabaseClient');
        const { data } = await supabase.auth.getSession();
        const accessToken = data?.session?.access_token || null;
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        };
        if (accessToken) headers['x-auth-token'] = accessToken;
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-a0e1e9cb/users/search?q=${encodeURIComponent(emailSearchQuery)}`,
          { headers }
        );
        if (response.ok) {
          const d = await response.json();
          setSuggestedUsers(d.users || []);
          setShowSuggestions((d.users || []).length > 0);
        }
      } catch (error) {
        console.error('Error searching users:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [emailSearchQuery, isAdmin, selectedUserId]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectUser = (u: SuggestedUser) => {
    setEmailSearchQuery(u.email);
    setSelectedUserId(u.id);
    setFormData({ ...formData, submittedByEmail: u.email });
    setShowSuggestions(false);
    setSuggestedUsers([]);
  };

  // 🔥 LOAD EXISTING EVENT IF IN EDIT MODE
  useEffect(() => {
    if (id && !hasLoadedRef.current) {
      console.log('🔧 EDIT MODE - Loading event:', id);
      setLoading(true);
      
      // 🔥 FIRST CHECK: Do we have event data in navigation state? (from Admin Panel)
      const eventFromState = (location.state as any)?.eventData;
      
      // ✅ Helper: extract all fields from event (handles both tables' column naming)
      const populateFromEvent = (event: any) => {
        console.log('📋 [EDIT] Raw event data keys:', Object.keys(event));
        console.log('📋 [EDIT] Raw event data:', JSON.stringify(event, null, 2));
        
        // Derive date from start_at if date is missing
        let eventDate = event.date || '';
        if (!eventDate && event.start_at) {
          try {
            eventDate = new Date(event.start_at).toISOString().split('T')[0];
            console.log('📋 [EDIT] Derived date from start_at:', eventDate);
          } catch (e) { /* ignore */ }
        }
        
        // Derive start time from start_at
        let startTime = '';
        if (event.start_at) {
          try {
            startTime = new Date(event.start_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
          } catch (e) { /* ignore */ }
        }
        
        // Derive end time from end_at
        let endTime = '';
        if (event.end_at) {
          try {
            endTime = new Date(event.end_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
          } catch (e) { /* ignore */ }
        }
        
        // Venue name — check multiple possible column names
        const venueName = event.venue_name || (event as any).venue || '';
        
        // Address
        const address = event.address || '';
        
        // Ticket link
        const ticketLink = event.ticket_link || '';
        
        setExistingEvent(event);
        
        setFormData({
          eventType: sanitizeEventType(event.event_type || (event as any).venue_type || ''),
          eventName: event.title || '',
          eventNameEn: event.title_en || '',
          eventDate,
          eventTime: event.event_time || '',
          startTime,
          endTime,
          venue: venueName,
          address,
          description: event.description || '',
          descriptionEn: event.description_en || '',
          ticketLink,
          priceType: event.price === 'Free' || event.price === 'Besplatno' ? 'free' : (event.price ? 'paid' : 'free'),
          price: event.price && event.price !== 'Free' && event.price !== 'Besplatno' ? event.price : '',
          organizerName: event.organizer_name || (event as any).contact_name || '',
          organizerPhone: event.organizer_phone || (event as any).phone || '',
          organizerEmail: event.organizer_email || (event as any).contact_email || event.submitted_by || '',
          submittedByEmail: event.submitted_by || ''
        });
        
        // Set selected date — derive from start_at if date missing
        const dateForPicker = eventDate || (event.start_at ? new Date(event.start_at).toISOString().split('T')[0] : '');
        if (dateForPicker) {
          try {
            const parsed = new Date(dateForPicker);
            if (!isNaN(parsed.getTime())) {
              setSelectedDate(parsed);
              console.log('📋 [EDIT] selectedDate set to:', parsed.toISOString());
            }
          } catch (e) { /* ignore */ }
        }
        
        console.log('✅ [EDIT] Form populated — venue:', venueName, '| address:', address, '| date:', eventDate, '| startTime:', startTime);
      };
      
      if (eventFromState) {
        console.log('✅ Event loaded from navigation state (bypassing backend):', eventFromState);
        populateFromEvent(eventFromState);
        
        setLoading(false);
        hasLoadedRef.current = true;
      } else {
        // 🔥 FALLBACK: Fetch from backend if no state data
        console.log('⚠️ No navigation state - fetching from backend...');
        dataService.getEventById(id).then((event) => {
          if (event) {
            console.log('✅ Event loaded for editing from backend:', event);
            populateFromEvent(event);
          } else {
            console.error('❌ ❌ Event not found');
            setShowNotification(true);
          }
          setLoading(false);
          hasLoadedRef.current = true;
        }).catch((err) => {
          console.error('❌ Error loading event:', err);
          alert(t('errorLoadingEvent'));
          setLoading(false);
          hasLoadedRef.current = true;
          navigate(-1);
        });
      }
    }
  }, [id, navigate, t, location.state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setEventNameEnError('');
    setDescriptionEnError('');
    if (!formData.eventNameEn.trim()) {
      setEventNameEnError(t('eventNameEnRequired'));
      return;
    }
    if (!formData.descriptionEn.trim()) {
      setDescriptionEnError(t('eventDescriptionEnRequired'));
      return;
    }

    // Validate required fields — in edit mode, allow keeping existing start_at if user didn't change
    const hasExistingStartAt = !!(existingEvent?.start_at);
    if (!selectedDate || !formData.startTime) {
      if (id && hasExistingStartAt) {
        // Edit mode: keep existing date/time if user didn't touch them
        console.log('📋 [EDIT] Using existing start_at from event:', existingEvent?.start_at);
      } else {
        alert(t('pleaseSelectDateAndTime') || 'Molimo izaberite datum i vrijeme početka događaja.');
        return;
      }
    }

    // Validate startTime format (must be exactly HH:MM) — skip if using existing start_at
    if (formData.startTime && formData.startTime.length !== 5) {
      setTimeError(language === 'sr' 
        ? 'Vrijeme početka mora biti u formatu HH:MM (npr. 19:00)' 
        : 'Start time must be in HH:MM format (e.g. 19:00)');
      return;
    }

    if (formData.startTime) {
      const [startHours, startMinutes] = formData.startTime.split(':').map(Number);
      if (startHours > 23 || startMinutes > 59) {
        setTimeError(language === 'sr' 
          ? 'Neispravno vrijeme početka (00:00 - 23:59)' 
          : 'Invalid start time (00:00 - 23:59)');
        return;
      }
    }

    // Validate endTime format if provided
    if (formData.endTime) {
      if (formData.endTime.length !== 5) {
        setTimeError(language === 'sr' 
          ? 'Vrijeme kraja mora biti u formatu HH:MM (npr. 21:00)' 
          : 'End time must be in HH:MM format (e.g. 21:00)');
        return;
      }

      const [endHours, endMinutes] = formData.endTime.split(':').map(Number);
      if (endHours > 23 || endMinutes > 59) {
        setTimeError(language === 'sr' 
          ? 'Neispravno vrijeme kraja (00:00 - 23:59)' 
          : 'Invalid end time (00:00 - 23:59)');
        return;
      }
    }

    setTimeError(''); // Clear any errors before submission

    // Validate address contains a number
    if (!/\d/.test(formData.address)) {
      setAddressError(language === 'sr'
        ? 'Adresa mora sadržavati kućni broj'
        : 'Address must contain a street number');
      return;
    }

    setAddressError(''); // Clear any address errors before submission

    if (isAdmin) {
      const readOnlyCreator = !!(id && formData.submittedByEmail && !creatorEditMode);
      if (!readOnlyCreator && !selectedUserId) {
        alert(t('mustSelectRegisteredUser'));
        return;
      }
    } else if (!user?.email) {
      alert(t('loginRequiredSubmit') || 'You must be logged in to submit.');
      return;
    }
    
    // Validate mutual dependency: price ↔ ticket link
    if (formData.priceType === 'paid' && !formData.ticketLink.trim()) {
      alert(language === 'sr'
        ? 'Ako je događaj plaćen, morate unijeti link za kupovinu karata.'
        : 'If the event has a price, you must provide a ticket purchase link.');
      return;
    }
    if (formData.ticketLink.trim() && formData.priceType === 'free') {
      alert(language === 'sr'
        ? 'Ako ste unijeli link za karte, morate postaviti cijenu (odaberite "Plaćeni ulaz").'
        : 'If you provided a ticket link, you must set a price (select "Paid entry").');
      return;
    }

    // Map eventType to page_slug
    const pageSlugMap: Record<string, dataService.ItemCategory> = {
      'concert': 'concerts',
      'festival': 'events',
      'theatre': 'theatre',
      'standup': 'events',
      'cinema': 'cinema',
      'club': 'clubs',
      'exhibition': 'events',
      'sport': 'events',
      'gastro': 'events',
      'conference': 'events',
      'workshop': 'events',
      'kids': 'events',
      'other': 'events',
    };

    const page_slug = pageSlugMap[formData.eventType] || 'events';

    // ===== CONVERT DATE + TIME TO ISO DATETIME =====
    let startAt: string;
    let endAt: string | null = null;
    
    if (selectedDate && formData.startTime) {
      // User provided date + time → build ISO datetime
      const [startHrs, startMins] = formData.startTime.split(':').map(Number);
      const startDateTime = new Date(selectedDate);
      startDateTime.setHours(startHrs || 0, startMins || 0, 0, 0);
      startAt = startDateTime.toISOString();
      
      if (formData.endTime) {
        const [endHrs, endMins] = formData.endTime.split(':').map(Number);
        const endDateTime = new Date(selectedDate);
        endDateTime.setHours(endHrs || 0, endMins || 0, 0, 0);
        endAt = endDateTime.toISOString();
      }
    } else if (id && existingEvent?.start_at) {
      // Edit mode fallback: use existing start_at/end_at
      startAt = existingEvent.start_at;
      endAt = existingEvent.end_at || null;
    } else {
      alert(t('pleaseSelectDateAndTime') || 'Molimo izaberite datum i vrijeme početka događaja.');
      return;
    }

    // Create event submission object
    const newEvent: Omit<dataService.Item, 'id' | 'created_at' | 'is_custom' | 'status'> & { assign_user_id?: string } = {
      page_slug,
      title: formData.eventName,
      title_en: formData.eventNameEn,
      description: formData.description,
      description_en: formData.descriptionEn,
      date: formData.eventDate, // Keep for backward compatibility
      city: 'Banja Luka',
      image: 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800',
      price: formData.priceType === 'free' ? 'Free' : formData.price,
      price_en: formData.priceType === 'free' ? 'Free' : (() => {
        const numMatch = formData.price.match(/[\d.,]+/);
        const numVal = numMatch ? parseFloat(numMatch[0].replace(',', '.')) : 0;
        return numVal > 0 ? `≈${(numVal / 1.95583).toFixed(2)} €` : formData.price;
      })(),
      submitted_by: (isAdmin ? formData.submittedByEmail.trim() : (user?.email || '').trim()),
      event_time: formData.eventTime,
      venue_name: formData.venue,
      ticket_link: formData.ticketLink,
      organizer_name: formData.organizerName,
      organizer_phone: formData.organizerPhone,
      organizer_email: formData.organizerEmail,
      address: formData.address,
      // ===== ISO datetime fields =====
      start_at: startAt,
      end_at: endAt,
      event_type: formData.eventType,
      // ===== Admin assign user =====
      ...(isAdmin && selectedUserId ? { assign_user_id: selectedUserId } : {}),
    };

    try {
      // 🔥 EDIT MODE - UPDATE EVENT
      if (id && existingEvent) {
        const result = await dataService.updateEvent(id, newEvent);
        if (result) {
          setShowNotification(true);
          console.log('✅ Event updated successfully!');
        } else {
          alert(t('errorUpdatingEvent') || 'Error updating event. Please try again.');
        }
      } else {
        // CREATE MODE - CREATE NEW EVENT
        const result = await dataService.createItem(newEvent);
        if (result) {
          setShowNotification(true);
          console.log('✅ Event created successfully:', result);
        } else {
          alert(t('errorSubmittingEvent') || 'Greška prilikom kreiranja dešavanja. Pokušajte ponovo.');
          console.error('❌ createItem returned null — event was NOT created');
        }
      }
    } catch (error) {
      console.error('❌ Error creating event submission:', error);
      alert(
        error instanceof Error
          ? error.message
          : (t('errorSubmittingEvent') || 'Error submitting event. Please try again.')
      );
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'eventNameEn') setEventNameEnError('');
    if (name === 'descriptionEn') setDescriptionEnError('');
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleTimeInput = (e: React.ChangeEvent<HTMLInputElement>, field: 'startTime' | 'endTime') => {
    let value = e.target.value.replace(/\D/g, ''); // Remove non-digits
    
    if (value.length >= 2) {
      const hours = value.substring(0, 2);
      const minutes = value.substring(2, 4);
      value = hours + (minutes ? ':' + minutes : '');
    }
    
    // Validate time format when complete (HH:MM = 5 characters)
    if (value.length === 5) {
      const [hours, minutes] = value.split(':').map(Number);
      
      if (hours > 23 || minutes > 59) {
        setTimeError(language === 'sr' 
          ? 'Neispravno vrijeme (00:00 - 23:59)' 
          : 'Invalid time (00:00 - 23:59)');
        return; // Don't update if invalid
      } else {
        setTimeError(''); // Clear error on valid input
      }
    } else if (value.length > 0 && value.length < 5) {
      setTimeError(''); // Clear error while typing
    }
    
    setFormData({
      ...formData,
      [field]: value
    });
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-secondary)' }}>
      <div className="w-full max-w-[900px] mx-auto px-4 py-6 pb-12" style={{ paddingRight: '80px' }}>
        
        {/* TITLE */}
        <section className="bg-white rounded-2xl p-6 shadow-sm mb-5 border border-gray-100">
          <h1 className="mb-2">{id ? t('editEvent') : t('submitEvent')}</h1>
          <p className="text-[15px] m-0" style={{ color: 'var(--text-secondary)' }}>
            {id ? t('editEventDesc') : t('submitEventDesc')}
          </p>
        </section>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          
          {/* PODACI O DEŠAVANJU */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
              <Calendar className="w-5 h-5" style={{ color: '#0E3DC5' }} />
              <h2 className="m-0" style={{ textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>{t('eventInfo')}</h2>
            </div>

            {/* Tip dešavanja - DROPDOWN */}
            <div className="mb-4">
              <label 
                className="block text-[13px] mb-2" 
                style={{ 
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                {t('eventType')} <span style={{ color: 'var(--accent-orange)' }}>*</span>
              </label>
              <CustomDropdown
                value={formData.eventType}
                onChange={(value) => setFormData({ ...formData, eventType: value })}
                placeholder={t('selectEventType')}
                required
                options={[
                  { value: 'cinema', label: t('filmScreening'), emoji: '🎬' },
                  { value: 'club', label: t('clubEvent'), emoji: '🪩' },
                  { value: 'concert', label: t('concert'), emoji: '🎵' },
                  { value: 'conference', label: t('conference'), emoji: '🎓' },
                  { value: 'exhibition', label: t('exhibition'), emoji: '🖼️' },
                  { value: 'festival', label: t('festival'), emoji: '🎪' },
                  { value: 'gastro', label: t('gastro'), emoji: '🍽️' },
                  { value: 'kids', label: t('kids'), emoji: '🧸' },
                  { value: 'other', label: t('other'), emoji: '📍' },
                  { value: 'sport', label: t('sport'), emoji: '⚽' },
                  { value: 'standup', label: 'Stand-up', emoji: '🎤' },
                  { value: 'theatre', label: t('theatre'), emoji: '🎭' },
                  { value: 'workshop', label: t('workshop'), emoji: '🔧' }
                ]}
              />
            </div>

            {/* Naziv dešavanja */}
            <div className="mb-4">
              <label 
                className="block text-[13px] mb-2" 
                style={{ 
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                {t('eventName')} <span style={{ color: 'var(--accent-orange)' }}>*</span>
              </label>
              <input
                type="text"
                name="eventName"
                value={formData.eventName}
                onChange={handleChange}
                required
                placeholder={t('eventNamePlaceholder')}
                className="w-full px-4 py-3 rounded-lg border transition-all"
                style={{
                  borderColor: '#E5E9F0',
                  fontSize: '14px',
                  color: 'var(--text-primary)'
                }}
              />
            </div>

            {/* Naziv dešavanja (engleski) */}
            <div className="mb-4">
              <label 
                className="block text-[13px] mb-2" 
                style={{ 
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                {t('eventNameEnglish')} <span style={{ color: 'var(--accent-orange)' }}>*</span>
              </label>
              <input
                type="text"
                name="eventNameEn"
                value={formData.eventNameEn}
                onChange={handleChange}
                required
                aria-invalid={!!eventNameEnError}
                placeholder={t('eventNameEnPlaceholder')}
                className="w-full px-4 py-3 rounded-lg border transition-all"
                style={{
                  borderColor: eventNameEnError ? '#DC2626' : '#E5E9F0',
                  fontSize: '14px',
                  color: 'var(--text-primary)'
                }}
              />
              {eventNameEnError && (
                <p className="text-sm mt-2 m-0" style={{ color: '#DC2626' }}>
                  ⚠️ {eventNameEnError}
                </p>
              )}
            </div>

            {/* Datum i vrijeme */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label 
                  className="block text-[13px] mb-2" 
                  style={{ 
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  {t('eventDate')} <span style={{ color: 'var(--accent-orange)' }}>*</span>
                </label>
                <DatePicker
                  selected={selectedDate}
                  onChange={(date) => {
                    setSelectedDate(date);
                    setFormData({ ...formData, eventDate: date ? date.toISOString().split('T')[0] : '' });
                  }}
                  required
                  locale={language === 'sr' ? srLatn as any : enUS}
                  dateFormat={language === 'sr' ? 'dd.MM.yyyy' : 'MM/dd/yyyy'}
                  placeholderText={language === 'sr' ? 'dd.mm.gggg' : 'mm/dd/yyyy'}
                  calendarStartDay={1}
                  className="w-full px-4 py-3 rounded-lg border transition-all"
                  wrapperClassName="w-full"
                  calendarClassName="custom-datepicker-calendar"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label 
                    className="block text-[13px] mb-2" 
                    style={{ 
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}
                  >
                    {t('startTime')} <span style={{ color: 'var(--accent-orange)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="startTime"
                    value={formData.startTime}
                    onChange={(e) => handleTimeInput(e, 'startTime')}
                    required
                    placeholder="--:--"
                    maxLength={5}
                    className="w-full px-3 py-3 rounded-lg border transition-all text-center"
                    style={{
                      borderColor: timeError ? '#DC2626' : '#E5E9F0',
                      fontSize: '14px',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>
                <div>
                  <label 
                    className="block text-[13px] mb-2" 
                    style={{ 
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}
                  >
                    {t('endTime')}
                  </label>
                  <input
                    type="text"
                    name="endTime"
                    value={formData.endTime}
                    onChange={(e) => handleTimeInput(e, 'endTime')}
                    placeholder="--:--"
                    maxLength={5}
                    className="w-full px-3 py-3 rounded-lg border transition-all text-center"
                    style={{
                      borderColor: timeError ? '#DC2626' : '#E5E9F0',
                      fontSize: '14px',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>
              </div>
            </div>
            {timeError && (
              <p className="text-sm mt-2 m-0" style={{ color: '#DC2626' }}>
                ⚠️ {timeError}
              </p>
            )}

            {/* Mjesto */}
            <div className="mb-4">
              <label 
                className="block text-[13px] mb-2" 
                style={{ 
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                {t('eventVenue')} <span style={{ color: 'var(--accent-orange)' }}>*</span>
              </label>
              <input
                type="text"
                name="venue"
                value={formData.venue}
                onChange={handleChange}
                required
                placeholder={t('eventVenuePlaceholder')}
                className="w-full px-4 py-3 rounded-lg border transition-all"
                style={{
                  borderColor: '#E5E9F0',
                  fontSize: '14px',
                  color: 'var(--text-primary)'
                }}
              />
            </div>

            {/* Adresa */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4" style={{ color: '#0E3DC5' }} />
                <label 
                  className="text-[13px] m-0" 
                  style={{ 
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  {t('streetAndNumber')} <span style={{ color: 'var(--accent-orange)' }}>*</span>
                </label>
              </div>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                required
                placeholder={t('addressPlaceholder')}
                className="w-full px-4 py-3 rounded-lg border transition-all"
                style={{
                  borderColor: addressError ? '#DC2626' : '#E5E9F0',
                  fontSize: '14px',
                  color: 'var(--text-primary)'
                }}
              />
              {addressError && (
                <p className="text-sm mt-2 m-0" style={{ color: '#DC2626' }}>
                  ⚠️ {addressError}
                </p>
              )}
            </div>

            {/* Opis */}
            <div className="mb-4">
              <label 
                className="block text-[13px] mb-2" 
                style={{ 
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                {t('eventDescription')} <span style={{ color: 'var(--accent-orange)' }}>*</span>
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                required
                placeholder={t('eventDescriptionPlaceholder')}
                rows={4}
                className="w-full px-4 py-3 rounded-lg border transition-all resize-none"
                style={{
                  borderColor: '#E5E9F0',
                  fontSize: '14px',
                  color: 'var(--text-primary)'
                }}
              />
            </div>

            {/* Opis (engleski) */}
            <div className="mb-4">
              <label 
                className="block text-[13px] mb-2" 
                style={{ 
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                {t('eventDescriptionEnglish')} <span style={{ color: 'var(--accent-orange)' }}>*</span>
              </label>
              <textarea
                name="descriptionEn"
                value={formData.descriptionEn}
                onChange={handleChange}
                required
                aria-invalid={!!descriptionEnError}
                placeholder={t('eventDescriptionEnPlaceholder')}
                rows={4}
                className="w-full px-4 py-3 rounded-lg border transition-all resize-none"
                style={{
                  borderColor: descriptionEnError ? '#DC2626' : '#E5E9F0',
                  fontSize: '14px',
                  color: 'var(--text-primary)'
                }}
              />
              {descriptionEnError && (
                <p className="text-sm mt-2 m-0" style={{ color: '#DC2626' }}>
                  ⚠️ {descriptionEnError}
                </p>
              )}
            </div>

            {/* Link ka ticketima */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-4 h-4" style={{ color: '#0E3DC5' }} />
                <label 
                  className="text-[13px] m-0" 
                  style={{ 
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  {t('ticketLink')}
                </label>
              </div>
              <input
                type="url"
                name="ticketLink"
                value={formData.ticketLink}
                onChange={handleChange}
                placeholder={t('ticketLinkPlaceholder')}
                className="w-full px-4 py-3 rounded-lg border transition-all"
                style={{
                  borderColor: (formData.priceType === 'paid' && !formData.ticketLink.trim()) ? '#DC2626' : '#E5E9F0',
                  fontSize: '14px',
                  color: 'var(--text-primary)'
                }}
              />
              {formData.priceType === 'paid' && !formData.ticketLink.trim() && (
                <p className="text-xs mt-1 m-0" style={{ color: '#DC2626' }}>
                  ⚠️ {language === 'sr' ? 'Obavezno za plaćene događaje' : 'Required for paid events'}
                </p>
              )}
              {formData.ticketLink.trim() && formData.priceType === 'free' && (
                <p className="text-xs mt-1 m-0" style={{ color: '#F59E0B' }}>
                  ⚠️ {language === 'sr' ? 'Ako ste unijeli link za karte, morate odabrati "Plaćeni ulaz"' : 'If you entered a ticket link, you must select "Paid entry"'}
                </p>
              )}
            </div>

            {/* Cijena - besplatno/plaćeno */}
            <div className="mb-4">
              <label 
                className="block text-[13px] mb-2" 
                style={{ 
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                {t('ticketPrice')}
              </label>
              <div className="flex gap-4 mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="priceType"
                    value="free"
                    checked={formData.priceType === 'free'}
                    onChange={handleChange}
                    style={{ accentColor: '#0E3DC5' }}
                  />
                  <span className="text-[14px]" style={{ color: 'var(--text-primary)' }}>
                    {t('freeEntry')}
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="priceType"
                    value="paid"
                    checked={formData.priceType === 'paid'}
                    onChange={handleChange}
                    style={{ accentColor: '#0E3DC5' }}
                  />
                  <span className="text-[14px]" style={{ color: 'var(--text-primary)' }}>
                    {t('paidEntry')}
                  </span>
                </label>
              </div>
              
              {formData.priceType === 'paid' && (
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" style={{ color: '#0E3DC5' }} />
                  <input
                    type="text"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    placeholder={language === 'sr' ? 'npr. 10 KM' : 'e.g. 10 KM'}
                    className="flex-1 px-4 py-3 rounded-lg border transition-all"
                    style={{
                      borderColor: '#E5E9F0',
                      fontSize: '14px',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>
              )}
              {formData.priceType === 'paid' && (() => {
                const numMatch = formData.price.match(/[\d.,]+/);
                const numVal = numMatch ? parseFloat(numMatch[0].replace(',', '.')) : 0;
                const eurVal = numVal > 0 ? (numVal / 1.95583).toFixed(2) : null;
                return eurVal ? (
                  <p className="text-xs mt-1 ml-6 m-0" style={{ color: '#0E3DC5' }}>
                    ≈ {eurVal} € ({language === 'sr' ? 'automatski preračunato' : 'auto-converted'})
                  </p>
                ) : null;
              })()}
            </div>
          </div>

          {/* ORGANIZATOR */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
              <User className="w-5 h-5" style={{ color: '#0E3DC5' }} />
              <h2 className="m-0" style={{ textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>{t('organizerInfo')}</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Ime */}
              <div>
                <label 
                  className="block text-[13px] mb-2" 
                  style={{ 
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  {t('name')} <span style={{ color: 'var(--accent-orange)' }}>*</span>
                </label>
                <input
                  type="text"
                  name="organizerName"
                  value={formData.organizerName}
                  onChange={handleChange}
                  required
                  placeholder={t('namePlaceholder')}
                  className="w-full px-4 py-3 rounded-lg border transition-all"
                  style={{
                    borderColor: '#E5E9F0',
                    fontSize: '14px',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              {/* Telefon */}
              <div>
                <label 
                  className="block text-[13px] mb-2" 
                  style={{ 
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  {t('contactPhone')} <span style={{ color: 'var(--accent-orange)' }}>*</span>
                </label>
                <input
                  type="tel"
                  name="organizerPhone"
                  value={formData.organizerPhone}
                  onChange={handleChange}
                  required
                  placeholder="+387 65 123 456"
                  className="w-full px-4 py-3 rounded-lg border transition-all"
                  style={{
                    borderColor: '#E5E9F0',
                    fontSize: '14px',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              {/* Email */}
              <div>
                <label 
                  className="block text-[13px] mb-2" 
                  style={{ 
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  {t('email')}
                </label>
                <input
                  type="email"
                  name="organizerEmail"
                  value={formData.organizerEmail}
                  onChange={handleChange}
                  placeholder={t('emailContactPlaceholder')}
                  className="w-full px-4 py-3 rounded-lg border transition-all"
                  style={{
                    borderColor: '#E5E9F0',
                    fontSize: '14px',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>
            </div>
          </div>

          {/* PRIJAVIO/LA — registrovani korisnik (submitted_by) */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
              <UserCheck className="w-5 h-5" style={{ color: '#0E3DC5' }} />
              <h2 className="m-0" style={{ textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>{t('submittedBy')}</h2>
            </div>
            <p className="text-[13px] mb-4 m-0" style={{ color: 'var(--text-secondary)' }}>
              {t('submittedByDesc')}
            </p>

            {isAdmin ? (
              <>
                {id && formData.submittedByEmail && !creatorEditMode ? (
                  <div style={{ maxWidth: '400px' }}>
                    <div className="flex items-center gap-3 px-4 py-3 rounded-lg border" style={{ borderColor: '#0E3DC5', backgroundColor: 'rgba(14, 61, 197, 0.02)', boxShadow: '0 0 0 2px rgba(14, 61, 197, 0.08)' }}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #60A5FA 0%, #0E3DC5 100%)' }}>
                        <span style={{ color: 'white', fontSize: '13px', fontWeight: 600 }}>{(resolvedCreatorName || formData.submittedByEmail || '?')[0].toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        {resolvedCreatorName && <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }} className="truncate">{resolvedCreatorName}</div>}
                        <div style={{ fontSize: '13px', color: '#6B7280' }} className="truncate">{formData.submittedByEmail}</div>
                      </div>
                      <button type="button" onClick={() => { setCreatorEditMode(true); setSelectedUserId(null); setEmailSearchQuery(''); setFormData((prev) => ({ ...prev, submittedByEmail: '' })); setResolvedCreatorName(null); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-0 cursor-pointer transition-all flex-shrink-0" style={{ background: 'rgba(14, 61, 197, 0.06)', color: '#0E3DC5', fontSize: '12px', fontWeight: 600 }} onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(14, 61, 197, 0.12)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(14, 61, 197, 0.06)'; }}>
                        <Pencil className="w-3 h-3" />
                        {t('change')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div ref={suggestRef} style={{ position: 'relative', maxWidth: '400px' }}>
                    <label className="block text-[13px] mb-2" style={{ color: 'var(--text-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {t('email')} <span style={{ color: 'var(--accent-orange)' }}>*</span>
                      <span style={{ fontSize: '10px', color: '#0E3DC5', marginLeft: '8px', fontWeight: 500, textTransform: 'none', letterSpacing: '0' }}>— {t('searchRegisteredUsers') || 'Pretrazi registrovane korisnike'}</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#9CA3AF', pointerEvents: 'none' }} />
                      <input type="text" value={emailSearchQuery} onChange={(e) => { setEmailSearchQuery(e.target.value); setSelectedUserId(null); if (e.target.value.length >= 2) setShowSuggestions(true); }} onFocus={() => { if (suggestedUsers.length > 0) setShowSuggestions(true); }} required placeholder={t('searchByEmailOrName') || 'Pretrazi po emailu ili imenu...'} className="w-full py-3 rounded-lg border transition-all" style={{ paddingLeft: '36px', paddingRight: isSearching ? '36px' : '16px', borderColor: selectedUserId ? '#0E3DC5' : '#E5E9F0', fontSize: '14px', color: 'var(--text-primary)', boxShadow: selectedUserId ? '0 0 0 2px rgba(14, 61, 197, 0.1)' : 'none' }} />
                      {isSearching && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: '#0E3DC5', borderTopColor: 'transparent' }} />}
                    </div>
                    {selectedUserId && emailSearchQuery && (
                      <div className="flex items-center gap-2 mt-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(14, 61, 197, 0.06)', border: '1px solid rgba(14, 61, 197, 0.15)' }}>
                        <UserCheck className="w-3.5 h-3.5" style={{ color: '#0E3DC5' }} />
                        <span style={{ fontSize: '12px', color: '#0E3DC5', fontWeight: 500 }}>{t('assignedTo') || 'Pridruzeno korisniku'}: {emailSearchQuery}</span>
                        <button type="button" onClick={() => { setSelectedUserId(null); setEmailSearchQuery(''); setFormData({ ...formData, submittedByEmail: '' }); }} className="ml-auto cursor-pointer border-0 bg-transparent p-0"><X className="w-3.5 h-3.5" style={{ color: '#6B7280' }} /></button>
                      </div>
                    )}
                    {showSuggestions && suggestedUsers.length > 0 && (
                      <div className="absolute w-full rounded-lg border overflow-hidden" style={{ top: '100%', left: 0, marginTop: '4px', background: 'white', borderColor: '#E5E9F0', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 50, maxHeight: '240px', overflowY: 'auto' }}>
                        {suggestedUsers.map((u) => (
                          <button key={u.id} type="button" className="w-full text-left px-4 py-3 border-0 cursor-pointer flex items-center gap-3" style={{ background: 'white', borderBottom: '1px solid #F3F4F6' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#F0F4FF'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }} onClick={() => handleSelectUser(u)}>
                            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #60A5FA 0%, #0E3DC5 100%)' }}>
                              <span style={{ color: 'white', fontSize: '12px', fontWeight: 600 }}>{(u.name || u.email || '?')[0].toUpperCase()}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }} className="truncate">{u.name || 'Bez imena'}</div>
                              <div style={{ fontSize: '12px', color: '#6B7280' }} className="truncate">{u.email}</div>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] flex-shrink-0" style={{ background: u.role === 'admin' ? 'rgba(14, 61, 197, 0.1)' : 'rgba(107, 114, 128, 0.1)', color: u.role === 'admin' ? '#0E3DC5' : '#6B7280', fontWeight: 600, textTransform: 'uppercase' }}>{roleLabels[(u.role || '').toLowerCase()] || u.role}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div style={{ maxWidth: '400px' }}>
                <label className="block text-[13px] mb-2" style={{ color: 'var(--text-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('email')}</label>
                <div className="flex items-center gap-2 w-full px-4 py-3 rounded-lg border" style={{ borderColor: '#0E3DC5', backgroundColor: 'rgba(14, 61, 197, 0.02)', boxShadow: '0 0 0 2px rgba(14, 61, 197, 0.08)' }}>
                  <UserCheck className="w-4 h-4 flex-shrink-0" style={{ color: '#0E3DC5' }} />
                  <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{formData.submittedByEmail || '—'}</span>
                </div>
                <p className="mt-1.5 m-0" style={{ fontSize: '11px', color: '#9CA3AF' }}>{t('registeredUser')}</p>
              </div>
            )}
          </div>

          {/* SUBMIT BUTTON */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate(isAdmin ? '/admin' : '/my-panel')}
              className="px-6 py-3 rounded-lg border cursor-pointer transition-all"
              style={{
                borderColor: '#E5E9F0',
                fontSize: '14px',
                color: 'var(--text-primary)',
                background: 'white'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #FCA5A5 0%, #DC2626 100%)';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                e.currentTarget.style.color = '#FFFFFF';
                e.currentTarget.style.borderColor = 'transparent';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'white';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.borderColor = '#E5E9F0';
              }}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="px-6 py-3 rounded-lg border-0 text-white cursor-pointer hover:opacity-90 transition-opacity"
              style={{
                background: 'linear-gradient(135deg, #60A5FA 0%, #0E3DC5 100%)',
                fontSize: '14px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
              }}
            >
              {id ? t('saveChanges') : t('submitEvent')}
            </button>
          </div>
        </form>
      </div>

      <NotificationDialog
        isOpen={showNotification}
        title={id ? t('eventUpdatedSuccess') : t('dialogNoticeTitle')}
        message={id ? t('eventUpdatedMessage') : t('eventWillBeAdded')}
        onClose={() => {
          setShowNotification(false);
          navigate(isAdmin ? '/admin' : '/my-panel');
        }}
      />
    </div>
  );
}