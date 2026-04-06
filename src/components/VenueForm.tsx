import React, { useState as useLocalState, useRef, useEffect } from 'react';
import { Building2, MapPin, Phone, Globe, Users, Clock, Image as ImageIcon, Utensils, Tag, X, Search, User, Loader2, UserCheck, Pencil } from 'lucide-react';
import { useT } from '../hooks/useT';
import { CustomDropdown } from './CustomDropdown';
import { WorkingHoursSelector } from './WorkingHoursSelector';
import { ImageUpload } from './ImageUpload';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import type { VenueType } from '../utils/dataService';
import { VENUE_CUISINE_ROWS } from '../utils/venueCuisineTaxonomy';
import { venueTagOptionsForLang, type VenueTagKey } from '../utils/venueTagLabels';

interface SuggestedUser {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: string;
}

// ✅ SVA POLJA SU SNAKE_CASE — konzistentno sa DB i Item interfejsom
interface VenueFormData {
  venue_type: VenueType;
  title: string;
  description: string;
  description_en: string;
  address: string;
  city: string;
  phone: string;
  website: string;
  facebook: string;
  instagram: string;
  opening_hours: string;
  opening_hours_en: string;
  /** Canonical SR labels from {@link VENUE_CUISINE_ROWS}, max 2. */
  cuisine_sr_selected: string[];
  /** Normalized tag keys for DB `tags`, max 2. */
  venue_tag_keys: VenueTagKey[];
  image: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  submitted_by_email: string;
  map_url?: string;
  assign_user_id?: string;
}

interface VenueFormProps {
  onSubmit: (formData: VenueFormData) => void;
  onCancel: () => void;
  submit_button_text?: string;
  is_admin?: boolean;
  is_submitting?: boolean;
  initial_data?: Omit<VenueFormData, 'assign_user_id'>;
  user_email?: string;
}

export function VenueForm({ onSubmit, onCancel, submit_button_text, initial_data, is_admin, is_submitting, user_email }: VenueFormProps) {
  const { t, language } = useT();

  const roleLabels: Record<string, string> = {
    user: t('user'),
    admin: t('admin'),
  };

  const [form_data, set_form_data] = useLocalState<Omit<VenueFormData, 'assign_user_id'>>({
    venue_type: '' as VenueType, // prazno dok korisnik ne odabere — forma ne dozvoljava submit bez selekcije
    title: '',
    description: '',
    description_en: '',
    address: '',
    city: 'Banja Luka',
    phone: '',
    website: '',
    facebook: '',
    instagram: '',
    opening_hours: '',
    opening_hours_en: '',
    cuisine_sr_selected: [],
    venue_tag_keys: [],
    image: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    submitted_by_email: '',
    map_url: '',
  });

  // 🔥 Admin autosuggest state
  const [suggested_users, set_suggested_users] = useLocalState<SuggestedUser[]>([]);
  const [show_suggestions, set_show_suggestions] = useLocalState(false);
  const [email_search_query, set_email_search_query] = useLocalState('');
  const [selected_user_id, set_selected_user_id] = useLocalState<string | null>(null);
  const [is_searching, set_is_searching] = useLocalState(false);
  const suggest_ref = useRef<HTMLDivElement>(null);
  const search_timeout_ref = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ✅ Creator section: collapsed by default in EDIT mode when creator is already assigned
  const [creator_edit_mode, set_creator_edit_mode] = useLocalState(false);
  const [resolved_creator_name, set_resolved_creator_name] = useLocalState<string | null>(null);

  const [cuisine_menu_open, set_cuisine_menu_open] = useLocalState(false);
  const cuisine_wrap_ref = useRef<HTMLDivElement>(null);
  const [tags_menu_open, set_tags_menu_open] = useLocalState(false);
  const tags_wrap_ref = useRef<HTMLDivElement>(null);

  const cuisine_options = VENUE_CUISINE_ROWS.map((row) => ({
    value: row.sr,
    label: language === 'en' ? row.en : row.sr,
  }));
  const tag_options = venueTagOptionsForLang(language);

  // 🔥 POPULATE FORM WITH INITIAL DATA IF PROVIDED
  useEffect(() => {
    if (initial_data) {
      set_form_data({
        ...initial_data,
        opening_hours_en: initial_data.opening_hours_en ?? '',
      });
      // submitted_by_email is populated from initial_data (set by AddVenuePage from DB submitted_by field)
      set_email_search_query(initial_data.submitted_by_email || '');

      // 🔥 AUTO-LOOKUP: If admin editing and we have submitted_by_email, fetch user profile
      if (is_admin && initial_data.submitted_by_email) {
        (async () => {
          try {
            const access_token = await get_access_token_for_search();
            const headers: Record<string, string> = {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json',
            };
            if (access_token) {
              headers['x-auth-token'] = access_token;
            }
            const response = await fetch(
              `https://${projectId}.supabase.co/functions/v1/make-server-a0e1e9cb/users/search?q=${encodeURIComponent(initial_data.submitted_by_email)}`,
              { headers }
            );
            if (response.ok) {
              const data = await response.json();
              const matched_user = (data.users || []).find(
                (u: SuggestedUser) => u.email === initial_data.submitted_by_email
              );
              if (matched_user) {
                set_selected_user_id(matched_user.id);
                set_resolved_creator_name(matched_user.name || 'Bez imena');
              }
            }
          } catch (err) {
            console.warn('⚠️ Auto-lookup user failed:', err);
          }
        })();
      }
    }
  }, [initial_data]);

  // Auto-populate submitted_by_email from user_email prop (for CREATE mode)
  useEffect(() => {
    if (user_email && !initial_data && !form_data.submitted_by_email) {
      set_form_data(prev => ({ ...prev, submitted_by_email: user_email }));
    }
  }, [user_email]);

  useEffect(() => {
    if (!cuisine_menu_open) return;
    const onDown = (e: MouseEvent) => {
      if (cuisine_wrap_ref.current && !cuisine_wrap_ref.current.contains(e.target as Node)) {
        set_cuisine_menu_open(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [cuisine_menu_open]);

  useEffect(() => {
    if (!tags_menu_open) return;
    const onDown = (e: MouseEvent) => {
      if (tags_wrap_ref.current && !tags_wrap_ref.current.contains(e.target as Node)) {
        set_tags_menu_open(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [tags_menu_open]);

  // 🔍 Admin: Search users by email with debounce
  useEffect(() => {
    if (!is_admin || email_search_query.length < 2 || selected_user_id) {
      set_suggested_users([]);
      return;
    }

    if (search_timeout_ref.current) {
      clearTimeout(search_timeout_ref.current);
    }

    search_timeout_ref.current = setTimeout(async () => {
      set_is_searching(true);
      try {
        const access_token = await get_access_token_for_search();
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        };
        if (access_token) {
          headers['x-auth-token'] = access_token;
        }

        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-a0e1e9cb/users/search?q=${encodeURIComponent(email_search_query)}`,
          { headers }
        );

        if (response.ok) {
          const data = await response.json();
          set_suggested_users(data.users || []);
          set_show_suggestions((data.users || []).length > 0);
        }
      } catch (error) {
        console.error('Error searching users:', error);
      } finally {
        set_is_searching(false);
      }
    }, 300);

    return () => {
      if (search_timeout_ref.current) clearTimeout(search_timeout_ref.current);
    };
  }, [email_search_query, is_admin, selected_user_id]);

  // Close suggestions on outside click
  useEffect(() => {
    const handle_click_outside = (e: MouseEvent) => {
      if (suggest_ref.current && !suggest_ref.current.contains(e.target as Node)) {
        set_show_suggestions(false);
      }
    };
    document.addEventListener('mousedown', handle_click_outside);
    return () => document.removeEventListener('mousedown', handle_click_outside);
  }, []);

  async function get_access_token_for_search(): Promise<string | null> {
    try {
      const { supabase } = await import('../utils/supabaseClient');
      const { data } = await supabase.auth.getSession();
      return data?.session?.access_token || null;
    } catch {
      return null;
    }
  }

  const handle_select_user = (user: SuggestedUser) => {
    set_email_search_query(user.email);
    set_selected_user_id(user.id);
    set_form_data({
      ...form_data,
      submitted_by_email: user.email,
    });
    set_show_suggestions(false);
    set_suggested_users([]);
  };

  const handle_submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (is_admin) {
      const read_only_creator = !!(initial_data?.submitted_by_email && !creator_edit_mode);
      if (!read_only_creator && !selected_user_id) {
        alert(t('mustSelectRegisteredUser'));
        return;
      }
    }
    onSubmit({
      ...form_data,
      ...(is_admin && selected_user_id ? { assign_user_id: selected_user_id } : {}),
    });
  };

  const handle_change = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    set_form_data({
      ...form_data,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <form onSubmit={handle_submit} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">

      {/* POSLOVNI PODACI */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
          <Building2 className="w-5 h-5" style={{ color: '#0E3DC5' }} />
          <h2 className="m-0" style={{ textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>{t('businessInfo')}</h2>
        </div>

        {/* venue_type */}
        <div className="mb-4">
          <label
            className="block text-[13px] mb-2"
            style={{ color: 'var(--text-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}
          >
            {t('venueType')} <span style={{ color: 'var(--accent-orange)' }}>*</span>
          </label>
          <CustomDropdown
            value={form_data.venue_type}
            onChange={(value) => set_form_data({ ...form_data, venue_type: value as VenueType })}
            placeholder={t('selectVenueType')}
            required
            options={[
              { value: 'bar'           as VenueType, label: t('venueTypeBar')          || 'Bar',             emoji: '🍸' },
              { value: 'brewery'       as VenueType, label: t('venueTypeBrewery')      || 'Pivnica',         emoji: '🍺' },
              { value: 'cafe'          as VenueType, label: t('venueTypeCafe')         || 'Kafić',           emoji: '☕' },
              { value: 'cevabdzinica'  as VenueType, label: t('venueTypeCevabdzinica') || 'Ćevabdžinica',   emoji: '🥩' },
              { value: 'dessert_shop'  as VenueType, label: t('venueTypeDessertShop')  || 'Slastičarna',     emoji: '🍰' },
              { value: 'fast_food'     as VenueType, label: t('venueTypeFastFood')     || 'Fast food',       emoji: '🍔' },
              { value: 'kafana'        as VenueType, label: t('venueTypeKafana')       || 'Kafana',          emoji: '🎶' },
              { value: 'nightclub'     as VenueType, label: t('venueTypeNightclub')    || 'Noćni klub',      emoji: '🎵' },
              { value: 'other'         as VenueType, label: t('venueTypeOther')        || 'Ostalo',          emoji: '📍' },
              { value: 'pizzeria'      as VenueType, label: t('venueTypePizzeria')     || 'Picerija',        emoji: '🍕' },
              { value: 'pub'           as VenueType, label: t('venueTypePub')          || 'Pub',             emoji: '🍻' },
              { value: 'restaurant'    as VenueType, label: t('venueTypeRestaurant')   || 'Restoran',        emoji: '🍽' },
            ]}
          />
        </div>

        {/* title */}
        <div className="mb-4">
          <label
            className="block text-[13px] mb-2"
            style={{ color: 'var(--text-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}
          >
            {t('fullVenueName')} <span style={{ color: 'var(--accent-orange)' }}>*</span>
          </label>
          <input
            type="text"
            name="title"
            value={form_data.title}
            onChange={handle_change}
            required
            placeholder={t('venueNamePlaceholder')}
            className="w-full px-4 py-3 rounded-lg border transition-all"
            style={{ borderColor: '#E5E9F0', fontSize: '14px', color: 'var(--text-primary)' }}
          />
        </div>

        {/* description */}
        <div className="mb-4">
          <label
            className="block text-[13px] mb-2"
            style={{ color: 'var(--text-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}
          >
            {t('description')} <span style={{ color: 'var(--accent-orange)' }}>*</span>
          </label>
          <textarea
            name="description"
            value={form_data.description}
            onChange={handle_change}
            required
            placeholder={t('descriptionPlaceholder')}
            rows={4}
            className="w-full px-4 py-3 rounded-lg border transition-all"
            style={{ borderColor: '#E5E9F0', fontSize: '14px', color: 'var(--text-primary)', resize: 'vertical' }}
          />
        </div>

        {/* description_en */}
        <div className="mb-4">
          <label
            className="block text-[13px] mb-2"
            style={{ color: 'var(--text-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}
          >
            {t('descriptionEn')} <span style={{ color: 'var(--accent-orange)' }}>*</span>
          </label>
          <textarea
            name="description_en"
            value={form_data.description_en}
            onChange={handle_change}
            required
            placeholder={t('descriptionEnPlaceholder')}
            rows={4}
            className="w-full px-4 py-3 rounded-lg border transition-all"
            style={{ borderColor: '#E5E9F0', fontSize: '14px', color: 'var(--text-primary)', resize: 'vertical' }}
          />
        </div>

        {/* city */}
        <div className="mb-4">
          <label
            className="block text-[13px] mb-2"
            style={{ color: 'var(--text-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}
          >
            {t('city')} <span style={{ color: 'var(--accent-orange)' }}>*</span>
          </label>
          <input
            type="text"
            name="city"
            value={form_data.city}
            onChange={handle_change}
            required
            placeholder={t('cityPlaceholder')}
            className="w-full px-4 py-3 rounded-lg border transition-all"
            style={{ borderColor: '#E5E9F0', fontSize: '14px', color: 'var(--text-primary)' }}
          />
        </div>

        {/* address */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4" style={{ color: '#0E3DC5' }} />
            <label
              className="text-[13px] m-0"
              style={{ color: 'var(--text-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}
            >
              {t('streetAndNumber')} <span style={{ color: 'var(--accent-orange)' }}>*</span>
            </label>
          </div>
          <input
            type="text"
            name="address"
            value={form_data.address}
            onChange={handle_change}
            required
            placeholder={t('addressPlaceholder')}
            className="w-full px-4 py-3 rounded-lg border transition-all"
            style={{ borderColor: '#E5E9F0', fontSize: '14px', color: 'var(--text-primary)' }}
          />
          {/* map_url — Google Maps ili drugi link koji se prikazuje kao klikabilna adresa na kartici */}
          <div className="mt-2">
            <input
              type="url"
              name="map_url"
              value={form_data.map_url || ''}
              onChange={handle_change}
              placeholder="https://maps.google.com/?q=... (link za Google Maps)"
              className="w-full px-4 py-3 rounded-lg border transition-all"
              style={{ borderColor: '#E5E9F0', fontSize: '13px', color: 'var(--text-primary)' }}
            />
            <p className="mt-1 m-0" style={{ fontSize: '11px', color: '#9CA3AF' }}>
              Opcionalno — adresa na kartici će biti klikabilna ako uneseš link
            </p>
          </div>
        </div>

        {/* website */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-4 h-4" style={{ color: '#0E3DC5' }} />
            <label
              className="text-[13px] m-0"
              style={{ color: 'var(--text-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}
            >
              {t('websiteLink')}
            </label>
          </div>
          <input
            type="url"
            name="website"
            value={form_data.website}
            onChange={handle_change}
            placeholder={t('websitePlaceholder')}
            className="w-full px-4 py-3 rounded-lg border transition-all"
            style={{ borderColor: '#E5E9F0', fontSize: '14px', color: 'var(--text-primary)' }}
          />
        </div>

        {/* facebook / instagram */}
        <div className="mb-4">
          <label
            className="block text-[13px] mb-2"
            style={{ color: 'var(--text-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}
          >
            {t('socialLinks')}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="url"
              name="facebook"
              value={form_data.facebook}
              onChange={handle_change}
              placeholder={t('facebookLinkPlaceholder')}
              className="px-4 py-3 rounded-lg border transition-all"
              style={{ borderColor: '#E5E9F0', fontSize: '14px', color: 'var(--text-primary)' }}
            />
            <input
              type="url"
              name="instagram"
              value={form_data.instagram}
              onChange={handle_change}
              placeholder={t('instagramLinkPlaceholder')}
              className="px-4 py-3 rounded-lg border transition-all"
              style={{ borderColor: '#E5E9F0', fontSize: '14px', color: 'var(--text-primary)' }}
            />
          </div>
        </div>

        {/* opening_hours */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4" style={{ color: '#0E3DC5' }} />
            <label
              className="text-[13px] m-0"
              style={{ color: 'var(--text-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}
            >
              {t('workingHours')} <span style={{ color: 'var(--accent-orange)' }}>*</span>
            </label>
          </div>
          <WorkingHoursSelector
            value_sr={form_data.opening_hours}
            value_en={form_data.opening_hours_en}
            onChange={(opening_hours, opening_hours_en) =>
              set_form_data((prev) => ({ ...prev, opening_hours, opening_hours_en }))
            }
          />
        </div>

        {/* Kuhinja — max 2 controlled options */}
        <div className="mb-4" ref={cuisine_wrap_ref}>
          <div className="flex items-center gap-2 mb-2">
            <Utensils className="w-4 h-4" style={{ color: '#0E3DC5' }} />
            <label
              className="text-[13px] m-0"
              style={{ color: 'var(--text-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}
            >
              {t('cuisine')}
            </label>
          </div>
          {(() => {
            const selected = form_data.cuisine_sr_selected;
            const selected_set = new Set(selected);
            const at_max = selected.length >= 2;

            const set_selected = (next: string[]) => {
              set_form_data((prev) => ({ ...prev, cuisine_sr_selected: next.slice(0, 2) }));
            };

            const remove_at = (index: number) => {
              const next = [...selected];
              next.splice(index, 1);
              set_selected(next);
            };

            const add_value = (sr: string) => {
              if (selected.length >= 2 || selected_set.has(sr)) return;
              set_selected([...selected, sr]);
              set_cuisine_menu_open(false);
            };

            return (
              <div className="relative">
                <button
                  type="button"
                  className="w-full px-3 py-2 rounded-lg border transition-all flex flex-wrap gap-2 items-center min-h-[48px] text-left cursor-pointer"
                  style={{ borderColor: '#E5E9F0', background: 'white' }}
                  onClick={() => set_cuisine_menu_open((o) => !o)}
                >
                  {selected.length === 0 && (
                    <span style={{ fontSize: '14px', color: '#9CA3AF' }}>{t('cuisinePlaceholder')}</span>
                  )}
                  {selected.map((sr, i) => {
                    const opt = cuisine_options.find((o) => o.value === sr);
                    return (
                      <span
                        key={`${sr}-${i}`}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium"
                        style={{ backgroundColor: '#EEF1FB', color: '#0E3DC5' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {opt?.label ?? sr}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            remove_at(i);
                          }}
                          className="ml-0.5 hover:opacity-70 transition-opacity border-0 bg-transparent p-0 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    );
                  })}
                </button>
                {cuisine_menu_open && (
                  <div
                    className="absolute left-0 right-0 z-50 mt-1 max-h-[240px] overflow-y-auto rounded-lg border bg-white shadow-lg"
                    style={{ borderColor: '#E5E9F0', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
                  >
                    {cuisine_options
                      .filter((o) => !selected_set.has(o.value))
                      .map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          disabled={at_max}
                          className="w-full text-left px-4 py-2.5 border-0 text-[14px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{
                            color: 'var(--text-primary)',
                            background: 'white',
                            borderBottom: '1px solid #F3F4F6',
                          }}
                          onMouseEnter={(e) => {
                            if (!at_max) e.currentTarget.style.background = '#F0F4FF';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'white';
                          }}
                          onClick={() => !at_max && add_value(o.value)}
                        >
                          {o.label}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Oznaka — max 2 controlled keys → DB `tags` */}
        <div className="mb-4" ref={tags_wrap_ref}>
          <div className="flex items-center gap-2 mb-2">
            <Tag className="w-4 h-4" style={{ color: '#0E3DC5' }} />
            <label
              className="text-[13px] m-0"
              style={{ color: 'var(--text-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}
            >
              {t('venueTag')}
            </label>
          </div>
          {(() => {
            const selected = form_data.venue_tag_keys;
            const selected_set = new Set(selected);
            const at_max = selected.length >= 2;

            const set_keys = (next: VenueTagKey[]) => {
              set_form_data((prev) => ({ ...prev, venue_tag_keys: next.slice(0, 2) }));
            };

            const remove_at = (index: number) => {
              const next = [...selected];
              next.splice(index, 1);
              set_keys(next);
            };

            const add_key = (key: VenueTagKey) => {
              if (selected.length >= 2 || selected_set.has(key)) return;
              set_keys([...selected, key]);
              set_tags_menu_open(false);
            };

            return (
              <div className="relative">
                <button
                  type="button"
                  className="w-full px-3 py-2 rounded-lg border transition-all flex flex-wrap gap-2 items-center min-h-[48px] text-left cursor-pointer"
                  style={{ borderColor: '#E5E9F0', background: 'white' }}
                  onClick={() => set_tags_menu_open((o) => !o)}
                >
                  {selected.length === 0 && (
                    <span style={{ fontSize: '14px', color: '#9CA3AF' }}>{t('venueTagPlaceholder')}</span>
                  )}
                  {selected.map((key, i) => {
                    const opt = tag_options.find((o) => o.key === key);
                    return (
                      <span
                        key={`${key}-${i}`}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium"
                        style={{ backgroundColor: '#EEF1FB', color: '#0E3DC5' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {opt?.label ?? key}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            remove_at(i);
                          }}
                          className="ml-0.5 hover:opacity-70 transition-opacity border-0 bg-transparent p-0 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    );
                  })}
                </button>
                {tags_menu_open && (
                  <div
                    className="absolute left-0 right-0 z-50 mt-1 max-h-[240px] overflow-y-auto rounded-lg border bg-white shadow-lg"
                    style={{ borderColor: '#E5E9F0', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
                  >
                    {tag_options
                      .filter((o) => !selected_set.has(o.key))
                      .map((o) => (
                        <button
                          key={o.key}
                          type="button"
                          disabled={at_max}
                          className="w-full text-left px-4 py-2.5 border-0 text-[14px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{
                            color: 'var(--text-primary)',
                            background: 'white',
                            borderBottom: '1px solid #F3F4F6',
                          }}
                          onMouseEnter={(e) => {
                            if (!at_max) e.currentTarget.style.background = '#F0F4FF';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'white';
                          }}
                          onClick={() => !at_max && add_key(o.key)}
                        >
                          {o.label}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* image */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <ImageIcon className="w-4 h-4" style={{ color: '#0E3DC5' }} />
            <label
              className="text-[13px] m-0"
              style={{ color: 'var(--text-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}
            >
              {t('addImage') || 'Dodaj sliku/e'} <span style={{ color: 'var(--accent-orange)' }}>*</span>
            </label>
          </div>
          <ImageUpload
            value={form_data.image}
            onChange={(url) => handle_change({ target: { name: 'image', value: url } } as React.ChangeEvent<HTMLInputElement>)}
            required
          />
        </div>
      </div>

      {/* KONTAKT OSOBA — organizator/vlasnik (ne mora biti registrovan) */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
          <Users className="w-5 h-5" style={{ color: '#0E3DC5' }} />
          <h2 className="m-0" style={{ textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>{t('contactPerson')}</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* contact_name */}
          <div>
            <label
              className="block text-[13px] mb-2"
              style={{ color: 'var(--text-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}
            >
              {t('name')}
            </label>
            <input
              type="text"
              name="contact_name"
              value={form_data.contact_name}
              onChange={handle_change}
              placeholder={t('namePlaceholder')}
              className="w-full px-4 py-3 rounded-lg border transition-all"
              style={{ borderColor: '#E5E9F0', fontSize: '14px', color: 'var(--text-primary)' }}
            />
          </div>

          {/* contact_email */}
          <div>
            <label
              className="block text-[13px] mb-2"
              style={{ color: 'var(--text-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}
            >
              {t('email')}
            </label>
            <input
              type="email"
              name="contact_email"
              value={form_data.contact_email}
              onChange={handle_change}
              placeholder={t('emailContactPlaceholder') || 'kontakt@example.com'}
              className="w-full px-4 py-3 rounded-lg border transition-all"
              style={{ borderColor: '#E5E9F0', fontSize: '14px', color: 'var(--text-primary)' }}
            />
          </div>

          {/* contact_phone */}
          <div>
            <label
              className="block text-[13px] mb-2"
              style={{ color: 'var(--text-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}
            >
              {t('contactPhone')} <span style={{ color: 'var(--accent-orange)' }}>*</span>
            </label>
            <input
              type="tel"
              name="contact_phone"
              value={form_data.contact_phone}
              onChange={handle_change}
              required
              placeholder="+387 65 123 456"
              className="w-full px-4 py-3 rounded-lg border transition-all"
              style={{ borderColor: '#E5E9F0', fontSize: '14px', color: 'var(--text-primary)' }}
            />
          </div>
        </div>
      </div>

      {/* PRIJAVIO/LA — registrovani korisnik (submitted_by) */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
          <UserCheck className="w-5 h-5" style={{ color: '#0E3DC5' }} />
          <h2 className="m-0" style={{ textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>{t('createdBy')}</h2>
        </div>
        <p className="text-[13px] mb-4 m-0" style={{ color: 'var(--text-secondary)' }}>
          {t('submittedByDesc')}
        </p>

        {is_admin ? (
          /* Admin: read-only prikaz kreatora u EDIT modu, search u CREATE modu ili kad admin klikne "Promijeni" */
          <>
            {/* ✅ EDIT MODE sa postojećim kreatorom — kompaktni read-only prikaz */}
            {initial_data?.submitted_by_email && !creator_edit_mode ? (
              <div style={{ maxWidth: '400px' }}>
                <div
                  className="flex items-center gap-3 px-4 py-3 rounded-lg border"
                  style={{
                    borderColor: '#0E3DC5',
                    backgroundColor: 'rgba(14, 61, 197, 0.02)',
                    boxShadow: '0 0 0 2px rgba(14, 61, 197, 0.08)',
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #60A5FA 0%, #0E3DC5 100%)' }}
                  >
                    <span style={{ color: 'white', fontSize: '13px', fontWeight: 600 }}>
                      {(resolved_creator_name || form_data.submitted_by_email || '?')[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    {resolved_creator_name && (
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }} className="truncate">
                        {resolved_creator_name}
                      </div>
                    )}
                    <div style={{ fontSize: '13px', color: '#6B7280' }} className="truncate">
                      {form_data.submitted_by_email}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      set_creator_edit_mode(true);
                      set_selected_user_id(null);
                      set_email_search_query('');
                      set_form_data((prev) => ({ ...prev, submitted_by_email: '' }));
                      set_resolved_creator_name(null);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-0 cursor-pointer transition-all flex-shrink-0"
                    style={{
                      background: 'rgba(14, 61, 197, 0.06)',
                      color: '#0E3DC5',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(14, 61, 197, 0.12)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(14, 61, 197, 0.06)'; }}
                  >
                    <Pencil className="w-3 h-3" />
                    {t('change')}
                  </button>
                </div>
              </div>
            ) : (
              /* CREATE MODE ili admin kliknuo "Promijeni" — search UI */
              <div ref={suggest_ref} style={{ position: 'relative', maxWidth: '400px' }}>

                <label
                  className="block text-[13px] mb-2"
                  style={{ color: 'var(--text-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}
                >
                  {t('email')} <span style={{ color: 'var(--accent-orange)' }}>*</span>
                  <span style={{ fontSize: '10px', color: '#0E3DC5', marginLeft: '8px', fontWeight: 500, textTransform: 'none', letterSpacing: '0' }}>
                    — {t('searchRegisteredUsers') || 'Pretrazi registrovane korisnike'}
                  </span>
                </label>

                <div style={{ position: 'relative' }}>
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                    style={{ color: '#9CA3AF', pointerEvents: 'none' }}
                  />
                  <input
                    type="text"
                    value={email_search_query}
                    onChange={(e) => {
                      set_email_search_query(e.target.value);
                      set_selected_user_id(null);
                      if (e.target.value.length >= 2) set_show_suggestions(true);
                    }}
                    onFocus={() => {
                      if (suggested_users.length > 0) set_show_suggestions(true);
                    }}
                    required
                    placeholder={t('searchByEmailOrName') || 'Pretrazi po emailu ili imenu...'}
                    className="w-full py-3 rounded-lg border transition-all"
                    style={{
                      paddingLeft: '36px',
                      paddingRight: is_searching ? '36px' : '16px',
                      borderColor: selected_user_id ? '#0E3DC5' : '#E5E9F0',
                      fontSize: '14px',
                      color: 'var(--text-primary)',
                      boxShadow: selected_user_id ? '0 0 0 2px rgba(14, 61, 197, 0.1)' : 'none',
                    }}
                  />
                  {is_searching && (
                    <div
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 rounded-full animate-spin"
                      style={{ borderColor: '#0E3DC5', borderTopColor: 'transparent' }}
                    />
                  )}
                </div>

                {/* Selected user badge */}
                {selected_user_id && email_search_query && (
                  <div
                    className="flex items-center gap-2 mt-2 px-3 py-1.5 rounded-lg"
                    style={{ background: 'rgba(14, 61, 197, 0.06)', border: '1px solid rgba(14, 61, 197, 0.15)' }}
                  >
                    <UserCheck className="w-3.5 h-3.5" style={{ color: '#0E3DC5' }} />
                    <span style={{ fontSize: '12px', color: '#0E3DC5', fontWeight: 500 }}>
                      {t('assignedTo') || 'Pridruzeno korisniku'}: {email_search_query}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        set_selected_user_id(null);
                        set_email_search_query('');
                        set_form_data({ ...form_data, submitted_by_email: '' });
                      }}
                      className="ml-auto cursor-pointer border-0 bg-transparent p-0"
                    >
                      <X className="w-3.5 h-3.5" style={{ color: '#6B7280' }} />
                    </button>
                  </div>
                )}

                {/* Suggestions dropdown */}
                {show_suggestions && suggested_users.length > 0 && (
                  <div
                    className="absolute w-full rounded-lg border overflow-hidden"
                    style={{
                      top: '100%', left: 0, marginTop: '4px',
                      background: 'white', borderColor: '#E5E9F0',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                      zIndex: 50, maxHeight: '240px', overflowY: 'auto',
                    }}
                  >
                    {suggested_users.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        className="w-full text-left px-4 py-3 border-0 cursor-pointer flex items-center gap-3"
                        style={{ background: 'white', borderBottom: '1px solid #F3F4F6' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#F0F4FF'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}
                        onClick={() => handle_select_user(u)}
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, #60A5FA 0%, #0E3DC5 100%)' }}
                        >
                          <span style={{ color: 'white', fontSize: '12px', fontWeight: 600 }}>
                            {(u.name || u.email || '?')[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }} className="truncate">
                            {u.name || 'Bez imena'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6B7280' }} className="truncate">{u.email}</div>
                        </div>
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] flex-shrink-0"
                          style={{
                            background: u.role === 'admin' ? 'rgba(14, 61, 197, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                            color: u.role === 'admin' ? '#0E3DC5' : '#6B7280',
                            fontWeight: 600, textTransform: 'uppercase',
                          }}
                        >
                          {roleLabels[(u.role || '').toLowerCase()] || u.role}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          /* Regular user: read-only — auto-populated from session */
          <div style={{ maxWidth: '400px' }}>
            <label
              className="block text-[13px] mb-2"
              style={{ color: 'var(--text-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}
            >
              {t('email')}
            </label>
            <div
              className="flex items-center gap-2 w-full px-4 py-3 rounded-lg border"
              style={{ borderColor: '#0E3DC5', backgroundColor: 'rgba(14, 61, 197, 0.02)', boxShadow: '0 0 0 2px rgba(14, 61, 197, 0.08)' }}
            >
              <UserCheck className="w-4 h-4 flex-shrink-0" style={{ color: '#0E3DC5' }} />
              <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                {form_data.submitted_by_email || '—'}
              </span>
            </div>
            <p className="mt-1.5 m-0" style={{ fontSize: '11px', color: '#9CA3AF' }}>
              {t('registeredUser')}
            </p>
          </div>
        )}
      </div>

      {/* SUBMIT BUTTONS */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-3 rounded-lg border cursor-pointer transition-all"
          style={{ borderColor: '#E5E9F0', fontSize: '14px', color: 'var(--text-primary)', background: 'white' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #FCA5A5 0%, #DC2626 100%)';
            e.currentTarget.style.color = '#FFFFFF';
            e.currentTarget.style.borderColor = 'transparent';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'white';
            e.currentTarget.style.color = 'var(--text-primary)';
            e.currentTarget.style.borderColor = '#E5E9F0';
          }}
        >
          {t('cancel')}
        </button>
        <button
          type="submit"
          disabled={is_submitting}
          className="px-6 py-3 rounded-lg border-0 text-white transition-opacity flex items-center gap-2"
          style={{
            background: is_submitting
              ? 'linear-gradient(135deg, #93AADB 0%, #6B8DD6 100%)'
              : 'linear-gradient(135deg, #60A5FA 0%, #0E3DC5 100%)',
            fontSize: '14px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            cursor: is_submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {is_submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {is_submitting ? 'Čuvanje...' : (submit_button_text || t('submit'))}
        </button>
      </div>
    </form>
  );
}