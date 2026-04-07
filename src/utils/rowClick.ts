import type { MouseEvent } from 'react';

const INTERACTIVE_SELECTOR =
  'a, button, input, textarea, select, label, [role="button"], [data-no-row-click]';

/**
 * Guard for "soft-clickable row" UX.
 * Returns true only when click originated from non-interactive content.
 */
export function shouldHandleSoftRowClick(event: MouseEvent<HTMLElement>): boolean {
  if (event.defaultPrevented) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;

  const target = event.target;
  if (!(target instanceof Element)) return false;

  return !target.closest(INTERACTIVE_SELECTOR);
}
