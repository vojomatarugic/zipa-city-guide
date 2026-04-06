import type { CSSProperties } from 'react';
import {
  buildVenueHeroSecondaryBadgeLabels,
  buildVenueListingBadgeLabels,
} from '../utils/venueCuisineTaxonomy';
import type { TranslationKey } from '../utils/translations';

const BADGE_ON_DARK: CSSProperties = {
  background: 'rgba(255,255,255,0.18)',
  color: 'rgba(255,255,255,0.95)',
  border: '1px solid rgba(255,255,255,0.35)',
};

type Props = {
  venue_type?: string;
  cuisine?: string;
  cuisine_en?: string;
  tags?: string | string[] | null;
  language: 'sr' | 'en';
  t: (key: TranslationKey) => string;
  className?: string;
  /** Hero / dark backgrounds */
  variant?: 'default' | 'onDark';
  /**
   * Venue detail heroes: cuisine + oznaka only; render venue_type separately via {@link VenueHeroVenueTypeLabel}.
   */
  cuisineOnly?: boolean;
};

/** Up to 3 badges: translated venue_type, then up to 2 cuisine values (never merged). */
const CLASS_VENUE_TYPE =
  'text-xs px-2 py-1 rounded border font-medium bg-stone-100 text-stone-700 border-stone-200';
const CLASS_CUISINE =
  'text-xs px-2 py-1 rounded border font-normal bg-white/70 text-stone-500 border-stone-200';

/** Small uppercase eyebrow above the venue title on detail heroes (not a badge). */
export function VenueHeroVenueTypeLabel({
  venue_type,
  t,
  accentColor,
}: {
  venue_type?: string | null;
  t: (key: TranslationKey) => string;
  accentColor: string;
}) {
  const vt = (venue_type || '').trim();
  if (!vt) return null;
  const label = t(vt as TranslationKey);
  return (
    <p
      style={{
        fontSize: '13px',
        fontWeight: 600,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: accentColor,
        margin: 0,
        marginBottom: '10px',
        textShadow: '0 1px 3px rgba(0,0,0,0.35)',
      }}
    >
      {label}
    </p>
  );
}

export function VenueBadgeRow({
  venue_type,
  cuisine,
  cuisine_en,
  tags,
  language,
  t,
  className,
  variant = 'default',
  cuisineOnly = false,
}: Props) {
  const labels = cuisineOnly
    ? buildVenueHeroSecondaryBadgeLabels({ cuisine, cuisine_en, tags, lang: language })
    : buildVenueListingBadgeLabels({
        venue_type,
        cuisine,
        cuisine_en,
        tags,
        lang: language,
        tVenueType: (key) => t(key as TranslationKey),
      });
  if (labels.length === 0) return null;
  const hasVenueType = Boolean((venue_type || '').trim()) && !cuisineOnly;
  return (
    <div className={className ?? 'flex flex-wrap items-center gap-2 mb-2'}>
      {labels.map((text, i) => {
        const isVenueTypeBadge = hasVenueType && i === 0;
        return (
          <span
            key={`${text}-${i}`}
            className={
              variant === 'default'
                ? isVenueTypeBadge
                  ? CLASS_VENUE_TYPE
                  : CLASS_CUISINE
                : 'text-xs font-medium px-2 py-1 rounded'
            }
            style={variant === 'onDark' ? BADGE_ON_DARK : undefined}
          >
            {text}
          </span>
        );
      })}
    </div>
  );
}
