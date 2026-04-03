import type { CSSProperties } from 'react';
import { buildVenueBadgeLabels } from '../utils/cuisineLabels';
import type { TranslationKey } from '../utils/translations';

const BADGE_ON_DARK: CSSProperties = {
  background: 'rgba(255,255,255,0.18)',
  color: 'rgba(255,255,255,0.95)',
  border: '1px solid rgba(255,255,255,0.35)',
};

type Props = {
  venue_type?: string;
  cuisine?: string;
  t: (key: TranslationKey) => string;
  className?: string;
  /** Hero / dark backgrounds */
  variant?: 'default' | 'onDark';
};

/** Up to 3 badges: translated venue_type, then up to 2 cuisine values (never merged). */
const CLASS_VENUE_TYPE =
  'text-xs px-2 py-1 rounded border font-medium bg-stone-100 text-stone-700 border-stone-200';
const CLASS_CUISINE =
  'text-xs px-2 py-1 rounded border font-normal bg-white/70 text-stone-500 border-stone-200';

export function VenueBadgeRow({ venue_type, cuisine, t, className, variant = 'default' }: Props) {
  const labels = buildVenueBadgeLabels(venue_type, cuisine, t);
  if (labels.length === 0) return null;
  const hasVenueType = Boolean((venue_type || '').trim());
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
