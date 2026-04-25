import {
  buildVenueHeroSecondaryBadgeLabels,
  buildVenueListingBadgeLabels,
} from '../utils/venueCuisineTaxonomy';
import type { TranslationKey, translations } from '../utils/translations';
import { formatVenueTypeForBadge } from '../utils/displayTypeLabels';
import {
  getBadgeTextColorForPageSlug,
  LISTING_BADGE_SURFACE_CLASS,
} from '../utils/categoryThemes';

type Props = {
  venue_type?: string;
  cuisine?: string;
  cuisine_en?: string;
  tags?: string | string[] | null;
  language: 'sr' | 'en';
  t: (key: TranslationKey) => string;
  className?: string;
  /** When listing would show no badges, render this single label (e.g. category). */
  listingFallback?: string;
  /** Text ink; if omitted, derived from {@link pageSlug} via {@link getBadgeTextColorForPageSlug}. */
  textColor?: string;
  /** Used with {@link getBadgeTextColorForPageSlug} when {@link textColor} is not passed. */
  pageSlug?: string;
  /**
   * Venue detail heroes: cuisine + oznaka only; render venue_type separately via {@link VenueHeroVenueTypeLabel}.
   */
  cuisineOnly?: boolean;
};

/** Small uppercase eyebrow above the venue title on detail heroes (not a badge). */
export function VenueHeroVenueTypeLabel({
  venue_type,
  t,
  accentColor,
  tone = 'onDark',
}: {
  venue_type?: string | null;
  t: (key: TranslationKey) => string;
  accentColor: string;
  /** `onLight`: no shadow — use under the main image on detail pages. */
  tone?: 'onDark' | 'onLight';
}) {
  const vt = (venue_type || '').trim();
  if (!vt) return null;
  const label = formatVenueTypeForBadge(vt, t as (key: keyof typeof translations) => string);
  return (
    <p
      style={{
        fontSize: '13px',
        fontWeight: 600,
        letterSpacing: '0.02em',
        color: accentColor,
        margin: 0,
        marginBottom: '10px',
        ...(tone === 'onDark'
          ? { textShadow: '0 1px 3px rgba(0,0,0,0.35)' }
          : {}),
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
  listingFallback,
  cuisineOnly = false,
  textColor,
  pageSlug,
}: Props) {
  let labels = cuisineOnly
    ? buildVenueHeroSecondaryBadgeLabels({ cuisine, cuisine_en, tags, lang: language })
    : buildVenueListingBadgeLabels({
        venue_type,
        cuisine,
        cuisine_en,
        tags,
        lang: language,
        tVenueType: (key) => t(key as TranslationKey),
      });
  const fallbackTrimmed = (listingFallback || '').trim();
  const usedFallbackOnly = labels.length === 0 && Boolean(fallbackTrimmed);
  if (usedFallbackOnly) {
    labels = [fallbackTrimmed];
  }
  if (labels.length === 0) return null;

  const ink =
    textColor ??
    (pageSlug ? getBadgeTextColorForPageSlug(pageSlug) : undefined) ??
    '#6B7280';

  return (
    <div className={className ?? 'flex flex-wrap items-center gap-2 mb-2'}>
      {labels.map((text, i) => (
        <span
          key={`${text}-${i}`}
          className={LISTING_BADGE_SURFACE_CLASS}
          style={{ color: ink }}
        >
          {text}
        </span>
      ))}
    </div>
  );
}
