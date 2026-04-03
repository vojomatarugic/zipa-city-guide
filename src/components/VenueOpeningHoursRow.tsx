import type { CSSProperties } from 'react';
import { Clock } from 'lucide-react';
import { splitOpeningHoursDisplaySegments } from '../utils/openingHoursDisplay';

type Props = {
  hoursText: string;
  clockSize?: number;
  className?: string;
  gapClassName?: string;
  clockClassName?: string;
  iconStyle?: CSSProperties;
  textClassName?: string;
  textStyle?: CSSProperties;
};

/**
 * One clock icon, first segment on the same row; further segments stack and align with text start.
 */
export function VenueOpeningHoursRow({
  hoursText,
  clockSize = 14,
  className = '',
  gapClassName = 'gap-2',
  clockClassName = 'shrink-0 mt-0.5',
  iconStyle,
  textClassName = 'text-sm',
  textStyle,
}: Props) {
  const segments = splitOpeningHoursDisplaySegments(hoursText);
  if (segments.length === 0) return null;

  const mergedIcon: CSSProperties = { color: '#6B7280', ...iconStyle };
  const mergedText: CSSProperties = { color: '#6B7280', ...textStyle };

  return (
    <div className={`flex items-start ${gapClassName} ${className}`.trim()}>
      <Clock size={clockSize} className={clockClassName} style={mergedIcon} />
      <div className={`flex min-w-0 flex-col gap-0.5 ${textClassName}`.trim()} style={mergedText}>
        {segments.map((line, i) => (
          <span key={i} className="block">
            {line}
          </span>
        ))}
      </div>
    </div>
  );
}
