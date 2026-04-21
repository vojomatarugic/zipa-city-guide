import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router';
import { useLocation as useSelectedCity } from '../contexts/LocationContext';
import { Calendar, MapPin, Phone, Mail, Globe, DollarSign, User, Clock, UserCheck, Search, X, Pencil, Plus, Trash2, Image as ImageIcon } from 'lucide-react';
import { useT } from '../hooks/useT';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { CustomDropdown } from '../components/CustomDropdown';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ImageUpload } from '../components/ImageUpload';
import DatePickerImport from 'react-datepicker';
import type { DatePickerProps } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const DatePicker = DatePickerImport as React.ComponentType<DatePickerProps>;
import { enUS } from 'date-fns/locale';
import { publicAnonKey } from '../utils/supabase/info';
import { apiUrl } from '../config/apiBase';
import * as dataService from '../utils/dataService';
import { scheduleLocalDayKey, getEventScheduleSlots } from '../utils/eventService';
import {
  mapDbRowToFormModel,
  mapDbRowToUiEvent,
  mapFormModelToEventApiPayload,
  type EventDbRow,
  type EventFormModel,
} from '../shared/eventSchema';
import { toast } from 'sonner@2.0.3';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { listingDocumentTitle } from '../utils/documentTitle';

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

function newScheduleTermId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `term-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type ScheduleTimeEntry = {
  id: string;
  startTime: string;
  endTime: string;
};

type ScheduleDateBlock = {
  id: string;
  selectedDate: Date | null;
  times: ScheduleTimeEntry[];
};

function emptyTimeEntry(): ScheduleTimeEntry {
  return {
    id: newScheduleTermId(),
    startTime: '',
    endTime: '',
  };
}

function emptyScheduleDateBlock(): ScheduleDateBlock {
  return {
    id: newScheduleTermId(),
    selectedDate: null,
    times: [emptyTimeEntry()],
  };
}

function formatWeekdayLabel(d: Date | null, language: string): string {
  if (!d || isNaN(d.getTime())) return '—';
  const loc = language === 'sr' ? 'sr-Latn' : 'en-US';
  const s = d.toLocaleDateString(loc, { weekday: 'long' });
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '—';
}

/** Build ISO datetimes from one date + one time row; returns null if incomplete. */
function buildScheduleIsoFromParts(
  selectedDate: Date | null,
  time: ScheduleTimeEntry
): { start_at: string; end_at: string | null } | null {
  if (!selectedDate || !time.startTime || time.startTime.length !== 5) return null;
  const [startHrs, startMins] = time.startTime.split(':').map(Number);
  const startDateTime = new Date(selectedDate);
  startDateTime.setHours(startHrs || 0, startMins || 0, 0, 0);
  const start_at = startDateTime.toISOString();
  let end_at: string | null = null;
  if (time.endTime && time.endTime.length === 5) {
    const [endHrs, endMins] = time.endTime.split(':').map(Number);
    const endDateTime = new Date(selectedDate);
    endDateTime.setHours(endHrs || 0, endMins || 0, 0, 0);
    end_at = endDateTime.toISOString();
  }
  return { start_at, end_at };
}

function timeFromIsoForForm(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '';
  }
}

/** Group API schedule rows by local calendar day for edit UI (films: several times same day). */
function groupSlotsIntoDateBlocks(
  slots: { start_at: string; end_at?: string | null }[]
): ScheduleDateBlock[] {
  const byDay = new Map<string, { start_at: string; end_at?: string | null }[]>();
  for (const s of slots) {
    const key = scheduleLocalDayKey(s.start_at);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(s);
  }
  const keys = Array.from(byDay.keys()).sort();
  return keys.map((key) => {
    const daySlots = byDay.get(key)!;
    daySlots.sort(
      (a, b) =>
        new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
    );
    const first = daySlots[0];
    let parsed: Date | null = null;
    try {
      const d = new Date(first.start_at);
      if (!isNaN(d.getTime())) parsed = d;
    } catch {
      parsed = null;
    }
    return {
      id: newScheduleTermId(),
      selectedDate: parsed,
      times: daySlots.map((s) => ({
        id: newScheduleTermId(),
        startTime: timeFromIsoForForm(s.start_at),
        endTime: timeFromIsoForForm(s.end_at ?? null),
      })),
    };
  });
}

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
  const { selectedCity } = useSelectedCity();
  const { user, isAdmin } = useAuth();

  const notifySubmitBlockingError = (message: string) => {
    toast.error(message);
  };

  useDocumentTitle(listingDocumentTitle(t('submitEvent'), selectedCity));

  // 🔥 PREVENT MULTIPLE LOADS - only load once when in edit mode
  const hasLoadedRef = useRef(false);

  const [formData, setFormData] = useState<EventFormModel>({
    eventType: '',
    image: '',
    eventName: '',
    eventNameEn: '',
    venue: '',
    city: '',
    address: '',
    mapUrl: '',
    description: '',
    descriptionEn: '',
    ticketLink: '',
    priceType: 'free',
    price: '',
    organizerName: '',
    organizerPhone: '',
    organizerEmail: '',
    submittedByEmail: '',
  });

  const [scheduleDateBlocks, setScheduleDateBlocks] = useState<ScheduleDateBlock[]>([
    emptyScheduleDateBlock(),
  ]);
  const [timeError, setTimeError] = useState<string>('');
  const [addressError, setAddressError] = useState<string>('');
  const [eventNameEnError, setEventNameEnError] = useState<string>('');
  const [descriptionEnError, setDescriptionEnError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [existingEvent, setExistingEvent] = useState<dataService.Item | null>(null);
  const [isInvalidUserModalOpen, setIsInvalidUserModalOpen] = useState(false);

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
            `${apiUrl('/users/search')}?q=${encodeURIComponent(formData.submittedByEmail)}`,
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
          `${apiUrl('/users/search')}?q=${encodeURIComponent(emailSearchQuery)}`,
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

  // Clear stale row / latch when switching create ↔ edit or between event ids (load effect runs next).
  useEffect(() => {
    if (!id) {
      hasLoadedRef.current = false;
      setExistingEvent(null);
      return;
    }
    hasLoadedRef.current = false;
    setExistingEvent(null);
  }, [id]);

  // 🔥 LOAD EXISTING EVENT IF IN EDIT MODE
  useEffect(() => {
    if (id && !hasLoadedRef.current) {
      console.log('🔧 EDIT MODE - Loading event:', id);
      setLoading(true);
      
      // 🔥 FIRST CHECK: Do we have event data in navigation state? (from Admin Panel)
      const eventFromState = (location.state as any)?.eventData;
      
      // ✅ Helper: extract all fields from event (handles both tables' column naming)
      const populateFromEvent = (event: EventDbRow) => {
        console.log('📋 [EDIT] Raw event data keys:', Object.keys(event));
        console.log('📋 [EDIT] Raw event data:', JSON.stringify(event, null, 2));

        const normalizedEvent = mapDbRowToUiEvent(event);
        const slots = getEventScheduleSlots(normalizedEvent as dataService.Item);
        if (slots.length > 0) {
          setScheduleDateBlocks(groupSlotsIntoDateBlocks(slots));
        } else {
          setScheduleDateBlocks([emptyScheduleDateBlock()]);
        }

        setExistingEvent(normalizedEvent as dataService.Item);
        setFormData(mapDbRowToFormModel(normalizedEvent));

        console.log(
          '✅ [EDIT] Form populated — venue:',
          normalizedEvent.venue_name || '',
          '| city:',
          normalizedEvent.city || '',
          '| address:',
          normalizedEvent.address || ''
        );
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
            toast.error(t('eventNotFound'));
            navigate(isAdmin ? '/admin' : '/my-panel');
          }
          setLoading(false);
          hasLoadedRef.current = true;
        }).catch((err) => {
          console.error('❌ Error loading event:', err);
          toast.error(t('errorLoadingEvent'));
          navigate(isAdmin ? '/admin' : '/my-panel');
          setLoading(false);
          hasLoadedRef.current = true;
        });
      }
    }
  }, [id, navigate, t, location.state, isAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("🔥 HANDLE SUBMIT TRIGGERED");
    console.log('🟦 [SubmitEventPage] handleSubmit START', {
      mode: id ? 'edit' : 'create',
      isEditMode: !!id,
      id: id ?? null,
      existingEventId: existingEvent?.id ?? null,
      loading,
    });
    const logSubmitBlock = (reason: string, details?: unknown) => {
      console.error('⛔ [SubmitEventPage] submit blocked:', reason, details ?? '');
    };
    try {
      console.log("before validation");
      console.log('🟦 [SubmitEventPage] before validation', {
        mode: id ? 'edit' : 'create',
        isEditMode: !!id,
        id: id ?? null,
      });

      setEventNameEnError('');
      setDescriptionEnError('');
      if (!formData.eventNameEn.trim()) {
        setEventNameEnError(t('eventNameEnRequired'));
        logSubmitBlock('eventNameEn missing');
        return;
      }
      if (!formData.descriptionEn.trim()) {
        setDescriptionEnError(t('eventDescriptionEnRequired'));
        logSubmitBlock('descriptionEn missing');
        return;
      }

    // —— Schedule date blocks + times: validate; allow edit fallback to existing start_at ——
    const hasExistingStartAt = !!(existingEvent?.start_at);
    const partialSchedule = scheduleDateBlocks.some((block) => {
      const anyStart = block.times.some((t) => !!t.startTime);
      const incompleteStart = block.times.some(
        (t) => !!t.startTime && t.startTime.length !== 5
      );
      const incompleteEnd = block.times.some(
        (t) => !!t.endTime && t.endTime.length !== 5
      );
      const endWithoutStart = block.times.some(
        (t) =>
          t.endTime?.length === 5 &&
          (!t.startTime || t.startTime.length !== 5)
      );
      const timeWithoutDate = !block.selectedDate && anyStart;
      const dateButNoCompleteTime =
        !!block.selectedDate &&
        !block.times.some((t) => t.startTime.length === 5) &&
        anyStart;
      const dateButAllTimesEmpty =
        !!block.selectedDate &&
        !block.times.some((t) => t.startTime.length === 5) &&
        !anyStart;
      return (
        timeWithoutDate ||
        incompleteStart ||
        incompleteEnd ||
        endWithoutStart ||
        dateButNoCompleteTime ||
        dateButAllTimesEmpty
      );
    });
    if (partialSchedule) {
      setTimeError(
        language === 'sr'
          ? 'Za svaki datum unesite vrijeme početka (HH:MM) za barem jedan termin; popunite sve započete redove.'
          : 'For each date, add at least one start time (HH:MM); complete every row you started.'
      );
      logSubmitBlock('partial schedule detected', scheduleDateBlocks);
      return;
    }

    for (const block of scheduleDateBlocks) {
      for (const time of block.times) {
        if (!time.startTime || time.startTime.length !== 5) continue;
        const [sh, sm] = time.startTime.split(':').map(Number);
        if (sh > 23 || sm > 59) {
          setTimeError(
            language === 'sr'
              ? 'Neispravno vrijeme početka (00:00 - 23:59)'
              : 'Invalid start time (00:00 - 23:59)'
          );
          logSubmitBlock('invalid start time', time);
          return;
        }
        if (time.endTime) {
          if (time.endTime.length !== 5) {
            setTimeError(
              language === 'sr'
                ? 'Vrijeme kraja mora biti u formatu HH:MM (npr. 21:00)'
                : 'End time must be in HH:MM format (e.g. 21:00)'
            );
            logSubmitBlock('invalid end time format', time);
            return;
          }
          const [eh, em] = time.endTime.split(':').map(Number);
          if (eh > 23 || em > 59) {
            setTimeError(
              language === 'sr'
                ? 'Neispravno vrijeme kraja (00:00 - 23:59)'
                : 'Invalid end time (00:00 - 23:59)'
            );
            logSubmitBlock('invalid end time value', time);
            return;
          }
        }
      }
    }

    const builtSlots: { start_at: string; end_at: string | null }[] = [];
    for (const block of scheduleDateBlocks) {
      for (const time of block.times) {
        const slot = buildScheduleIsoFromParts(block.selectedDate, time);
        if (slot) builtSlots.push(slot);
      }
    }
    builtSlots.sort(
      (a, b) =>
        new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
    );

    if (builtSlots.length === 0 && !(id && hasExistingStartAt)) {
      notifySubmitBlockingError(
        t('pleaseSelectDateAndTime') ||
          'Molimo izaberite datum i vrijeme početka događaja.'
      );
      logSubmitBlock('no schedule slots and no existing start_at');
      return;
    }

    setTimeError('');

    if (!formData.venue.trim()) {
      notifySubmitBlockingError(language === 'sr'
        ? 'Unesite naziv lokacije / mjesto održavanja.'
        : 'Please enter the location name / venue.');
      logSubmitBlock('venue missing');
      return;
    }
    if (!formData.city.trim()) {
      notifySubmitBlockingError(language === 'sr'
        ? 'Unesite grad.'
        : 'Please enter the city.');
      logSubmitBlock('city missing');
      return;
    }

    const addressTrimmed = formData.address.trim();
    if (!addressTrimmed) {
      setAddressError(language === 'sr'
        ? 'Unesite ulicu i kućni broj.'
        : 'Please enter street and number.');
      logSubmitBlock('address missing');
      return;
    }
    if (!/\d/.test(addressTrimmed)) {
      setAddressError(language === 'sr'
        ? 'Adresa mora sadržavati kućni broj'
        : 'Address must contain a street number');
      logSubmitBlock('address missing street number', addressTrimmed);
      return;
    }

    setAddressError(''); // Clear any address errors before submission

    if (isAdmin) {
      const readOnlyCreator = !!(id && formData.submittedByEmail && !creatorEditMode);
      if (!readOnlyCreator && !selectedUserId) {
        setIsInvalidUserModalOpen(true);
        logSubmitBlock('admin has no selected user');
        return;
      }
    } else if (!user?.email) {
      notifySubmitBlockingError(t('loginRequiredSubmit') || 'You must be logged in to submit.');
      logSubmitBlock('anonymous non-admin submit');
      return;
    }
    
    // Validate mutual dependency: price ↔ ticket link
    if (formData.priceType === 'paid' && !formData.ticketLink.trim()) {
      notifySubmitBlockingError(language === 'sr'
        ? 'Ako je događaj plaćen, morate unijeti link za kupovinu karata.'
        : 'If the event has a price, you must provide a ticket purchase link.');
      logSubmitBlock('paid event without ticket link');
      return;
    }

    // ===== CONVERT schedule terms → ISO (first term mirrors legacy start_at / end_at) =====
    let startAt: string | null;
    let endAt: string | null = null;

    if (builtSlots.length > 0) {
      startAt = builtSlots[0].start_at;
      endAt = builtSlots[0].end_at;
    } else if (id && existingEvent?.start_at) {
      startAt = existingEvent.start_at;
      endAt = existingEvent.end_at || null;
      console.log(
        '📋 [EDIT] Using existing start_at from event:',
        existingEvent?.start_at
      );
    } else {
      notifySubmitBlockingError(
        t('pleaseSelectDateAndTime') ||
          'Molimo izaberite datum i vrijeme početka događaja.'
      );
      logSubmitBlock('unable to derive start_at/end_at');
      return;
    }

    const legacyDateStr =
      scheduleDateBlocks[0]?.selectedDate != null
        ? scheduleDateBlocks[0].selectedDate!.toISOString().split('T')[0]
        : builtSlots[0]
          ? new Date(builtSlots[0].start_at).toISOString().split('T')[0]
          : existingEvent?.start_at
            ? new Date(existingEvent.start_at).toISOString().split('T')[0]
            : undefined;

    // Full list of screenings; persisted by edge function into `event_schedules` (jsonb). Null clears extras on update.
    const event_schedules_value =
      builtSlots.length > 0 ? builtSlots : null;

    // Create event submission object
      console.log("after validation");
      console.log('🟦 [SubmitEventPage] after validation', {
        mode: id ? 'edit' : 'create',
        isEditMode: !!id,
        id: id ?? null,
        builtSlotsCount: builtSlots.length,
        hasExistingStartAt,
      });

      const payload = mapFormModelToEventApiPayload(formData);
      const newEvent: Omit<
      dataService.Item,
      'id' | 'created_at' | 'is_custom' | 'status' | 'page_slug'
    > & {
      assign_user_id?: string;
    } = {
      ...payload,
      date: legacyDateStr,
      // ===== ISO datetime fields =====
      start_at: startAt,
      end_at: endAt,
      event_type: formData.eventType,
      event_schedules: event_schedules_value,
      // ===== Admin assign user =====
      ...(isAdmin && selectedUserId ? { assign_user_id: selectedUserId } : {}),
    };
      console.log('🟦 [SubmitEventPage] payload ready', {
        id: id ?? null,
        mode: id ? 'edit' : 'create',
        isEditMode: !!id,
        payload: newEvent,
      });

      // 🔥 EDIT MODE - UPDATE EVENT
      if (id) {
        console.log("CALLING updateEvent");
        console.log('🟨 [SubmitEventPage] before updateEvent', {
          id,
          mode: 'edit',
          isEditMode: true,
          payload: newEvent,
        });
        console.log("FINAL PAYLOAD", newEvent);
        const result = await dataService.updateEvent(id, newEvent);
        console.log('🟩 [SubmitEventPage] after updateEvent', {
          id,
          success: !!result,
          result,
        });
        if (result) {
          console.log('🟩 [SubmitEventPage] submit success', { id, mode: 'edit' });
          toast.success(t('eventUpdatedSuccess'), { description: t('eventUpdatedMessage') });
          navigate(isAdmin ? '/admin' : '/my-panel');
          console.log('✅ Event updated successfully!');
        } else {
          notifySubmitBlockingError(t('errorUpdatingEvent') || 'Error updating event. Please try again.');
        }
      } else {
        // CREATE MODE - CREATE NEW EVENT
        const result = await dataService.createItem(newEvent);
        if (result) {
          console.log('🟩 [SubmitEventPage] submit success', { mode: 'create', resultId: result.id });
          toast.success(t('dialogNoticeTitle'), { description: t('eventWillBeAdded') });
          navigate(isAdmin ? '/admin' : '/my-panel');
          console.log('✅ Event created successfully:', result);
        } else {
          notifySubmitBlockingError(t('errorSubmittingEvent') || 'Greška prilikom kreiranja dešavanja. Pokušajte ponovo.');
          console.error('❌ createItem returned null — event was NOT created');
        }
      }
    } catch (error) {
      console.error('🟥 [SubmitEventPage] submit error', error);
      console.error('❌ Error creating event submission:', error);
      notifySubmitBlockingError(
        error instanceof Error
          ? error.message
          : (t('errorSubmittingEvent') || 'Error submitting event. Please try again.')
      );
    } finally {
      console.log('🟦 [SubmitEventPage] handleSubmit END', {
        mode: id ? 'edit' : 'create',
        isEditMode: !!id,
        id: id ?? null,
      });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'eventNameEn') setEventNameEnError('');
    if (name === 'descriptionEn') setDescriptionEnError('');
    setFormData((prev) => {
      const next = { ...prev, [name]: value } as typeof prev;
      if (name === 'priceType' && value === 'free') {
        next.ticketLink = '';
      }
      return next;
    });
  };

  const handleTimeInputForEntry = (
    blockId: string,
    timeId: string,
    field: 'startTime' | 'endTime',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    let value = e.target.value.replace(/\D/g, '');

    if (value.length >= 2) {
      const hours = value.substring(0, 2);
      const minutes = value.substring(2, 4);
      value = hours + (minutes ? ':' + minutes : '');
    }

    if (value.length === 5) {
      const [hours, minutes] = value.split(':').map(Number);
      if (hours > 23 || minutes > 59) {
        setTimeError(
          language === 'sr'
            ? 'Neispravno vrijeme (00:00 - 23:59)'
            : 'Invalid time (00:00 - 23:59)'
        );
        return;
      }
      setTimeError('');
    } else if (value.length > 0 && value.length < 5) {
      setTimeError('');
    }

    setScheduleDateBlocks((prev) =>
      prev.map((block) =>
        block.id !== blockId
          ? block
          : {
              ...block,
              times: block.times.map((row) =>
                row.id === timeId ? { ...row, [field]: value } : row
              ),
            }
      )
    );
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
        <form
          onSubmit={handleSubmit}
          noValidate
          onInvalidCapture={(e) => {
            const target = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
            console.error('🟥 [SubmitEventPage] native validation blocked submit', {
              mode: id ? 'edit' : 'create',
              isEditMode: !!id,
              id: id ?? null,
              fieldName: target?.name ?? '(no-name)',
              fieldType: (target as HTMLInputElement)?.type ?? '(unknown)',
              value: target?.value ?? '',
              required: Boolean(target?.required),
              validity: target?.validity
                ? {
                    valueMissing: target.validity.valueMissing,
                    typeMismatch: target.validity.typeMismatch,
                    patternMismatch: target.validity.patternMismatch,
                    tooShort: target.validity.tooShort,
                    tooLong: target.validity.tooLong,
                    valid: target.validity.valid,
                  }
                : null,
            });
          }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
        >
          
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

            {/* Datumi i vremena: više datuma, više vremena po datumu */}
            <div className="mb-4 rounded-xl border border-[#E5E9F0] bg-[#FAFBFC] p-4">
              <div className="mb-3 flex items-center gap-2">
                <Clock className="h-5 w-5 flex-shrink-0" style={{ color: '#0E3DC5' }} />
                <span
                  className="text-[13px] font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t('eventScheduleSection')}{' '}
                  <span style={{ color: 'var(--accent-orange)' }}>*</span>
                </span>
              </div>
              <div className="flex flex-col gap-4">
                {scheduleDateBlocks.map((block, blockIdx) => (
                  <div
                    key={block.id}
                    className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span
                        className="text-xs font-semibold uppercase tracking-wide"
                        style={{ color: '#64748b' }}
                      >
                        {t('eventDate')} {blockIdx + 1}
                      </span>
                      {scheduleDateBlocks.length > 1 && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md border-0 bg-transparent p-1.5 text-red-600 hover:bg-red-50"
                          aria-label={language === 'sr' ? 'Ukloni datum' : 'Remove date'}
                          onClick={() =>
                            setScheduleDateBlocks((prev) => {
                              const next = prev.filter((b) => b.id !== block.id);
                              return next.length === 0
                                ? [emptyScheduleDateBlock()]
                                : next;
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
                      <div>
                        <label
                          className="mb-2 block text-[13px]"
                          style={{
                            color: 'var(--text-primary)',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}
                        >
                          {t('eventDate')}
                        </label>
                        <DatePicker
                          selected={block.selectedDate}
                          onChange={(date) => {
                            setScheduleDateBlocks((prev) =>
                              prev.map((b) =>
                                b.id === block.id
                                  ? { ...b, selectedDate: date }
                                  : b
                              )
                            );
                          }}
                          locale={language === 'sr' ? (srLatn as any) : enUS}
                          dateFormat={
                            language === 'sr' ? 'dd.MM.yyyy' : 'MM/dd/yyyy'
                          }
                          placeholderText={
                            language === 'sr' ? 'dd.mm.gggg' : 'mm/dd/yyyy'
                          }
                          calendarStartDay={1}
                          className="w-full rounded-lg border border-[#E5E9F0] px-4 py-3 text-[14px] text-[var(--text-primary)] transition-all"
                          wrapperClassName="w-full"
                          calendarClassName="custom-datepicker-calendar"
                        />
                        <p
                          className="mb-0 mt-2 text-[13px]"
                          style={{ color: '#64748b' }}
                        >
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {t('scheduleWeekdayHint')}:
                          </span>{' '}
                          {formatWeekdayLabel(block.selectedDate, language)}
                        </p>
                      </div>
                      <div>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span
                            className="block text-[13px]"
                            style={{
                              color: 'var(--text-primary)',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}
                          >
                            {t('eventTime')}
                          </span>
                        </div>
                        <div className="flex flex-col gap-3">
                          {block.times.map((timeRow) => (
                            <div
                              key={timeRow.id}
                              className="rounded-md border border-[#EEF2F7] bg-[#FAFBFC] p-3"
                            >
                              {block.times.length > 1 && (
                                <div className="mb-2 flex items-center justify-end">
                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-1 rounded-md border-0 bg-transparent p-1 text-red-600 hover:bg-red-50"
                                    aria-label={
                                      language === 'sr'
                                        ? 'Ukloni vrijeme'
                                        : 'Remove time'
                                    }
                                    onClick={() =>
                                      setScheduleDateBlocks((prev) =>
                                        prev.map((b) => {
                                          if (b.id !== block.id) return b;
                                          if (b.times.length <= 1) {
                                            return {
                                              ...b,
                                              times: [
                                                {
                                                  ...b.times[0],
                                                  startTime: '',
                                                  endTime: '',
                                                },
                                              ],
                                            };
                                          }
                                          return {
                                            ...b,
                                            times: b.times.filter(
                                              (t) => t.id !== timeRow.id
                                            ),
                                          };
                                        })
                                      )
                                    }
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label
                                    className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide"
                                    style={{ color: '#64748b' }}
                                  >
                                    {t('startTime')}
                                  </label>
                                  <input
                                    type="text"
                                    value={timeRow.startTime}
                                    onChange={(e) =>
                                      handleTimeInputForEntry(
                                        block.id,
                                        timeRow.id,
                                        'startTime',
                                        e
                                      )
                                    }
                                    placeholder="--:--"
                                    maxLength={5}
                                    className="w-full rounded-lg border px-3 py-2.5 text-center transition-all"
                                    style={{
                                      borderColor: timeError
                                        ? '#DC2626'
                                        : '#E5E9F0',
                                      fontSize: '14px',
                                      color: 'var(--text-primary)',
                                    }}
                                  />
                                </div>
                                <div>
                                  <label
                                    className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide"
                                    style={{ color: '#64748b' }}
                                  >
                                    {t('endTime')}
                                  </label>
                                  <input
                                    type="text"
                                    value={timeRow.endTime}
                                    onChange={(e) =>
                                      handleTimeInputForEntry(
                                        block.id,
                                        timeRow.id,
                                        'endTime',
                                        e
                                      )
                                    }
                                    placeholder="--:--"
                                    maxLength={5}
                                    className="w-full rounded-lg border px-3 py-2.5 text-center transition-all"
                                    style={{
                                      borderColor: timeError
                                        ? '#DC2626'
                                        : '#E5E9F0',
                                      fontSize: '14px',
                                      color: 'var(--text-primary)',
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-2.5 text-[13px] font-semibold transition-colors"
                          style={{
                            borderColor: '#0E3DC5',
                            color: '#0E3DC5',
                            background: 'rgba(14, 61, 197, 0.04)',
                          }}
                          onClick={() =>
                            setScheduleDateBlocks((prev) =>
                              prev.map((b) =>
                                b.id === block.id
                                  ? {
                                      ...b,
                                      times: [...b.times, emptyTimeEntry()],
                                    }
                                  : b
                              )
                            )
                          }
                        >
                          <Plus className="h-4 w-4" />
                          {t('addAnotherTimeRow')}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed py-3 text-[14px] font-semibold transition-colors"
                style={{
                  borderColor: '#0E3DC5',
                  color: '#0E3DC5',
                  background: 'rgba(14, 61, 197, 0.04)',
                }}
                onClick={() =>
                  setScheduleDateBlocks((prev) => [
                    ...prev,
                    emptyScheduleDateBlock(),
                  ])
                }
              >
                <Plus className="h-4 w-4" />
                {t('addAnotherDateBlock')}
              </button>
            </div>
            {timeError && (
              <p className="text-sm mt-2 m-0" style={{ color: '#DC2626' }}>
                ⚠️ {timeError}
              </p>
            )}

            {/* Lokacija / naziv mjesta */}
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
                {t('eventLocationVenueName')} <span style={{ color: 'var(--accent-orange)' }}>*</span>
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

            {/* Grad */}
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
                {t('city')} <span style={{ color: 'var(--accent-orange)' }}>*</span>
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                required
                placeholder={t('eventCityPlaceholder')}
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
                placeholder={t('eventStreetAndNumberPlaceholder')}
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
              <div className="mt-2">
                <input
                  type="url"
                  name="mapUrl"
                  value={formData.mapUrl}
                  onChange={handleChange}
                  placeholder="https://maps.google.com/?q=... (link za Google Maps)"
                  className="w-full px-4 py-3 rounded-lg border transition-all"
                  style={{
                    borderColor: '#E5E9F0',
                    fontSize: '13px',
                    color: 'var(--text-primary)'
                  }}
                />
                <p className="mt-1 m-0" style={{ fontSize: '11px', color: '#9CA3AF' }}>
                  Opcionalno — adresa na kartici ce biti klikabilna ako uneses link
                </p>
              </div>
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

            {/* Cijena - besplatno/plaćeno (prije linka za karte — jasniji tok) */}
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

            {/* Link ka ticketima — onemogućen za slobodan ulaz */}
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
                disabled={formData.priceType === 'free'}
                placeholder={t('ticketLinkPlaceholder')}
                className={`w-full px-4 py-3 rounded-lg border transition-all ${formData.priceType === 'free' ? 'opacity-50 cursor-not-allowed' : ''}`}
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
              {formData.priceType === 'free' && (
                <p className="text-xs mt-1 m-0" style={{ color: '#9CA3AF' }}>
                  {language === 'sr'
                    ? 'Link za karte nije potreban za slobodan ulaz.'
                    : 'Ticket link is not used for free entry.'}
                </p>
              )}
            </div>

            {/* Slika — ista pozicija kao VenueForm (kraj glavne sekcije, prije kontakta/organizatora) */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <ImageIcon className="w-4 h-4" style={{ color: '#0E3DC5' }} />
                <label
                  className="text-[13px] m-0"
                  style={{
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {t('addImage') || 'Dodaj sliku/e'} <span style={{ color: 'var(--accent-orange)' }}>*</span>
                </label>
              </div>
              <ImageUpload
                value={formData.image}
                onChange={(url) => setFormData((prev) => ({ ...prev, image: url }))}
                required
              />
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
              disabled={loading}
              className="px-6 py-3 rounded-lg border-0 text-white cursor-pointer hover:opacity-90 transition-opacity"
              style={{
                background: 'linear-gradient(135deg, #60A5FA 0%, #0E3DC5 100%)',
                fontSize: '14px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                opacity: loading ? 0.55 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {id ? t('saveChanges') : t('submitEvent')}
            </button>
          </div>
        </form>
      </div>

      {isInvalidUserModalOpen && (
        <ConfirmDialog
          isOpen={true}
          title={t('invalidUserSelectionTitle')}
          message={t('invalidUserSelectionMessage')}
          confirmText={t('okButton')}
          showCancel={false}
          variant="danger"
          onConfirm={() => setIsInvalidUserModalOpen(false)}
          onCancel={() => setIsInvalidUserModalOpen(false)}
        />
      )}
    </div>
  );
}