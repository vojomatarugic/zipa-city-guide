import { useT } from '../hooks/useT';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useParams, useLocation } from 'react-router';
import { useLocation as useSelectedCity } from '../contexts/LocationContext';
import { VenueForm } from '../components/VenueForm';
import { NotificationDialog } from '../components/NotificationDialog';
import * as dataService from '../utils/dataService';
import { parseCuisineSrSelectionsFromDb, serializeCuisineForDb } from '../utils/venueCuisineTaxonomy';
import { parseVenueTagKeysFromDb, type VenueTagKey } from '../utils/venueTagLabels';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { listingDocumentTitle } from '../utils/documentTitle';

// Mapira venue_type → page_slug (za DB)
// ⚠️  Record<VenueType, ...> (ne Record<string, ...>) — TypeScript ODBIJA kompajliranje
//     ako postoji VenueType koji nema mapiranje. Nemoguće zaboraviti.
const VENUE_TYPE_TO_CATEGORY: Record<dataService.VenueType, dataService.ItemCategory> = {
  restaurant:   'food-and-drink',
  cafe:         'food-and-drink',
  bar:          'food-and-drink',
  pub:          'food-and-drink',
  brewery:      'food-and-drink',
  kafana:       'food-and-drink',
  fast_food:    'food-and-drink',
  cevabdzinica: 'food-and-drink',
  pizzeria:     'food-and-drink',
  dessert_shop: 'food-and-drink',
  nightclub:    'clubs',
  other:        'food-and-drink',
};

// Stare plural kategorije → ispravan venue_type (za stare venue-e bez venue_type)
const CATEGORY_TO_VENUE_TYPE: Record<string, string> = {
  'food-and-drink': 'restaurant',
  restaurants: 'restaurant',  // backward compat za stare podatke
  cafes:       'cafe',
  clubs:       'nightclub',
  cinema:      'other',
  attractions: 'other',
};

const VALID_VENUE_TYPES = Object.keys(VENUE_TYPE_TO_CATEGORY);

export function AddVenuePage() {
  const { t } = useT(); // translation hook
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { selectedCity } = useSelectedCity();
  const { user, isAdmin } = useAuth();

  useDocumentTitle(listingDocumentTitle(t('addVenue'), selectedCity));
  const [show_notification, set_show_notification] = useState(false);
  const [existing_venue, set_existing_venue] = useState<dataService.Item | null>(null);
  const [loading, set_loading] = useState(false);
  const [is_saving, set_is_saving] = useState(false);

  // Sprječava višestruko učitavanje
  const has_loaded_ref = useRef(false);

  // EDIT MODE — učitaj postojeći venue
  useEffect(() => {
    if (id && !has_loaded_ref.current) {
      console.log('🔧 EDIT MODE - Loading venue:', id);
      set_loading(true);
      has_loaded_ref.current = true;

      const venue_from_state = (location.state as any)?.venueData;

      if (venue_from_state) {
        console.log('✅ Venue loaded from navigation state:', venue_from_state);
        set_existing_venue(venue_from_state);
        set_loading(false);
      } else {
        console.log('⚠️ No navigation state - fetching from backend...');
        dataService.getVenueById(id).then((venue) => {
          if (venue) {
            set_existing_venue(venue);
            console.log('✅ Venue loaded for editing:', venue);
          } else {
            console.error('❌ Venue not found');
            alert(t('venueNotFoundOrNoAccess') || 'Venue not found or you do not have access');
            navigate(-1);
          }
          set_loading(false);
        }).catch((err) => {
          console.error('❌ Error loading venue:', err);
          alert(t('errorLoadingVenue'));
          set_loading(false);
          navigate(-1);
        });
      }
    }
  }, [id]);

  // ✅ Pripremi initial_data za VenueForm — sve snake_case, direktno iz Item
  // 🔥 useMemo sprječava kreiranje novog objekta na svakom renderovanju,
  //    što bi inače triggerovalo useEffect([initial_data]) u VenueForm-u
  //    i resetovalo formu nazad na originalne vrijednosti.
  const memoized_initial_data = useMemo(() => {
    if (!existing_venue) return undefined;

    const resolved_venue_type = (
      existing_venue.venue_type && VALID_VENUE_TYPES.includes(existing_venue.venue_type)
        ? existing_venue.venue_type
        : CATEGORY_TO_VENUE_TYPE[existing_venue.page_slug] || 'restaurant'
    ) as dataService.VenueType;

    return {
      venue_type:    resolved_venue_type,
      title:         existing_venue.title         || '',
      description:   existing_venue.description   || '',
      description_en: existing_venue.description_en || '',
      address:       existing_venue.address        || '',
      city:          existing_venue.city           || '',
      phone:         existing_venue.phone          || '',
      website:       existing_venue.website        || '',
      facebook:      '',
      instagram:     '',
      opening_hours:    existing_venue.opening_hours    || '',
      opening_hours_en: existing_venue.opening_hours_en || '',
      cuisine_sr_selected: parseCuisineSrSelectionsFromDb(
        existing_venue.cuisine,
        existing_venue.cuisine_en
      ),
      venue_tag_keys: parseVenueTagKeysFromDb(existing_venue.tags),
      image:         existing_venue.image          || '',
      contact_name:  existing_venue.contact_name   || '',
      contact_phone: existing_venue.contact_phone  || '',
      contact_email: existing_venue.contact_email  || '',
      submitted_by_email: existing_venue.submitted_by || '',
    };
  }, [existing_venue]);

  const handle_submit = async (form_data: {
    venue_type:    dataService.VenueType;
    title:         string;
    description:   string;
    description_en: string;
    address:       string;
    city:          string;
    phone:         string;
    website:       string;
    facebook:      string;
    instagram:     string;
    opening_hours: string;
    opening_hours_en: string;
    cuisine_sr_selected: string[];
    venue_tag_keys: VenueTagKey[];
    image:         string;
    contact_name:  string;
    contact_phone: string;
    contact_email: string;
    submitted_by_email: string;
    assign_user_id?: string;
  }) => {
    // ✅ TypeScript garantuje da je venue_type validan VenueType,
    //    a Record<VenueType, ItemCategory> garantuje da mapiranje postoji —
    //    page_slug ne može biti undefined.
    const page_slug = VENUE_TYPE_TO_CATEGORY[form_data.venue_type];

    const { cuisine, cuisine_en } = serializeCuisineForDb(form_data.cuisine_sr_selected);
    const tags_payload =
      form_data.venue_tag_keys.length > 0 ? form_data.venue_tag_keys : null;

    if (!page_slug) {
      console.error(`❌ [AddVenuePage] Nepoznat venue_type: "${form_data.venue_type}" — nema mapiranja u VENUE_TYPE_TO_CATEGORY. Submission blokiran.`);
      alert(`Greška: tip lokala "${form_data.venue_type}" nije mapiran na stranicu. Kontaktirajte administratora.`);
      return;
    }

    // ✅ newItem je potpuno snake_case — direktno ide na backend
    const new_item: Omit<dataService.Item, 'id' | 'created_at' | 'is_custom' | 'status'> = {
      page_slug,
      venue_type:       form_data.venue_type,
      title:            form_data.title,
      title_en:         form_data.title,
      description:      form_data.description,
      description_en:   form_data.description_en || form_data.description,
      date:             'Ongoing',
      city:             form_data.city,
      address:          form_data.address,
      image:            form_data.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
      opening_hours:    form_data.opening_hours,
      opening_hours_en: form_data.opening_hours_en,
      cuisine:          cuisine || null,
      cuisine_en:       cuisine_en || null,
      tags:             tags_payload,
      contact_name:     form_data.contact_name,
      contact_phone:    form_data.contact_phone,
      contact_email:    form_data.contact_email,
      website:          form_data.website,
      phone:            form_data.phone,
    };

    const payload_with_assign = form_data.assign_user_id
      ? { ...new_item, assign_user_id: form_data.assign_user_id }
      : new_item;

    try {
      set_is_saving(true);

      if (id && existing_venue) {
        // EDIT MODE
        try {
          const result = await dataService.updateVenue(id, payload_with_assign);
          if (result) {
            set_show_notification(true);
            console.log('✅ Venue updated successfully!');
          } else {
            alert(t('errorUpdatingVenue') || 'Error updating venue. Please try again.');
          }
        } catch (err) {
          console.error('❌ updateVenue:', err);
          alert(err instanceof Error ? err.message : (t('errorUpdatingVenue') || 'Error updating venue.'));
        }
      } else {
        // CREATE MODE (admin: include assign_user_id so server can verify id ↔ email)
        try {
          const created = await dataService.createItem(payload_with_assign);

          if (!created?.id) {
            console.error('❌ createItem returned null — venue was NOT saved to database');
            alert(t('errorSubmittingVenue') || 'Greška: objekat nije sačuvan. Pokušajte ponovo ili provjerite konzolu za detalje.');
            return;
          }

          console.log('✅ Venue created with id:', created.id);

          if (isAdmin) {
            const approved = await dataService.approveItem(created.id);
            if (approved) {
              console.log('✅ Venue auto-approved (admin created):', created.id);
            } else {
              console.warn('⚠️ Auto-approve failed — venue je pending, odobri ručno u admin panelu');
            }
          }

          set_show_notification(true);
          console.log('✅ Venue saved', isAdmin ? '(auto-approved)' : '(PENDING — čeka admin odobrenje)');
        } catch (err) {
          console.error('❌ createItem:', err);
          alert(err instanceof Error ? err.message : (t('errorSubmittingVenue') || 'Error submitting venue.'));
        }
      }
    } catch (error) {
      console.error('❌ Error submitting venue:', error);
      alert(t('errorSubmittingVenue') || 'Error submitting venue. Please try again.');
    } finally {
      set_is_saving(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-secondary)' }}>
      <div className="w-full max-w-[900px] mx-auto px-4 py-6 pb-12" style={{ paddingRight: '80px' }}>

        {/* NASLOV */}
        <section className="bg-white rounded-2xl p-6 shadow-sm mb-5 border border-gray-100">
          <h1 className="mb-2">{id ? t('editVenue') : t('addVenue')}</h1>
          <p className="text-[15px] m-0" style={{ color: 'var(--text-secondary)' }}>
            {id ? t('editVenueDesc') : t('addVenueDesc')}
          </p>
        </section>

        {/* LOADING */}
        {loading ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-3 border-gray-200 border-t-[#0E3DC5] rounded-full animate-spin" />
              <p style={{ color: 'var(--text-secondary)' }}>{t('loading')}...</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>
                {t('serverWarmup')}
              </p>
            </div>
          </div>
        ) : (
          <VenueForm
            onSubmit={handle_submit}
            onCancel={() => navigate(isAdmin ? '/admin' : '/my-panel')}
            is_admin={isAdmin}
            is_submitting={is_saving}
            submit_button_text={id ? t('saveChanges') : t('addVenue')}
            initial_data={memoized_initial_data}
            user_email={user?.email || ''}
          />
        )}
      </div>

      <NotificationDialog
        isOpen={show_notification}
        title={id ? t('venueUpdatedSuccess') : t('venueSentForApproval')}
        message={id ? t('venueUpdatedMessage') : t('venuePendingApproval')}
        onClose={() => {
          set_show_notification(false);
          navigate(isAdmin ? '/admin' : '/my-panel');
        }}
      />
    </div>
  );
}