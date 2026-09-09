/**
 * Display formatting shared by the overview and the visit ledger.
 *
 * Presentation only - nothing here decides anything. The API is the single
 * source of every number these functions render, and every amount arrives as
 * integer cents.
 */
import type { RestaurantTag } from './types';

/**
 * Whole cents -> "$18.50", by string surgery so no float ever rounds a total.
 * Null renders as an em dash: the amount is unknown, not zero.
 */
export function formatCents(cents: number | null): string {
  if (cents === null) return '—';
  const sign = cents < 0 ? '−' : '';
  const absolute = Math.abs(cents);
  const dollars = Math.trunc(absolute / 100).toLocaleString('en-US');
  return `${sign}$${dollars}.${String(absolute % 100).padStart(2, '0')}`;
}

/**
 * The same, but a positive value keeps its `+`. Used for month-over-month
 * change, where "$42" and "+$42" mean different things.
 *
 * Negatives use a true minus sign (U+2212), which lines up with digits;
 * a hyphen sits too high and too short next to tabular numerals.
 */
export function formatSignedCents(cents: number): string {
  return cents > 0 ? `+${formatCents(cents)}` : formatCents(cents);
}

/** "2026-09" -> "September 2026". */
export function formatMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const name = new Date(Date.UTC(year, monthNumber - 1, 1)).toLocaleString('en-US', {
    month: 'long',
    timeZone: 'UTC',
  });
  return `${name} ${year}`;
}

/**
 * "2026-09-08" -> "Sep 8, 2026". Parsed as UTC and printed as UTC, so a
 * calendar date never shifts a day on the way to the screen.
 */
export function formatVisitDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** The stored tag value ("quick-bite") as a chip reads it ("Quick bite"). */
export function formatTag(tag: RestaurantTag): string {
  const words = tag.split('-').join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "4.5" -> "4.5★"-adjacent text. Null when the restaurant was never rated. */
export function formatRating(rating: number | null): string | null {
  return rating === null ? null : rating.toFixed(1);
}
