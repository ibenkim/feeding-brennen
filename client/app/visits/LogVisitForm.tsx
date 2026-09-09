'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiRequestError, createVisit } from '@/lib/apiClient';
import type { Restaurant } from '@/lib/types';

// The one interactive piece: it POSTs to /api/visits and then asks the server
// component above to re-render with fresh data.

const DOLLARS = /^\d+(?:\.\d{1,2})?$/;

/**
 * "18.5" -> 1850. Returns null for anything the API wouldn't accept, including
 * a third decimal place: rounding money the user didn't type is worse than
 * making them fix it.
 */
function centsFromDollars(input: string): number | null {
  const trimmed = input.trim();
  if (!DOLLARS.test(trimmed)) return null;

  const [dollars, fraction = ''] = trimmed.split('.');
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, '0'));
  return cents > 0 ? cents : null;
}

/** Today in the browser's timezone, as YYYY-MM-DD. */
function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

type Failure = { message: string; details: string[] };

export function LogVisitForm({
  restaurants,
  selectedMonth,
  initialRestaurantId = '',
}: {
  restaurants: Restaurant[];
  selectedMonth: string;
  /** Preselected from `?restaurant=` when arriving from an overview card. */
  initialRestaurantId?: string;
}) {
  const router = useRouter();

  const [restaurantId, setRestaurantId] = useState(initialRestaurantId);
  const [visitedOn, setVisitedOn] = useState(today);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setFailure(null);

    const parsedId = Number(restaurantId);
    if (!Number.isInteger(parsedId) || parsedId < 1) {
      setFailure({ message: 'Pick a restaurant.', details: [] });
      return;
    }

    const amountCents = centsFromDollars(amount);
    if (amountCents === null) {
      setFailure({
        message: 'Enter an amount in dollars, at most two decimal places (e.g. 18.50).',
        details: [],
      });
      return;
    }

    setPending(true);
    try {
      const visit = await createVisit({
        restaurantId: parsedId,
        visitedOn,
        amountCents,
        note: note.trim() === '' ? null : note,
      });

      setAmount('');
      setNote('');

      // A visit logged outside the month on screen would otherwise vanish, so
      // follow it to its own month.
      const visitMonth = visit.visitedOn.slice(0, 7);
      if (visitMonth !== selectedMonth) {
        router.push(`/visits?month=${visitMonth}`);
      }
      // Drops the client router cache so the list and total are re-fetched.
      router.refresh();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setFailure({ message: err.message, details: err.details });
      } else {
        setFailure({
          message: 'Could not reach the API. Is the dev server still running?',
          details: [],
        });
      }
    } finally {
      setPending(false);
    }
  }

  const inputClass =
    'w-full rounded border border-rule bg-parchment px-2.5 py-1.5 text-sm text-espresso placeholder:text-clay/60';
  const labelClass =
    'mb-1 block text-xs font-medium uppercase tracking-wider text-clay';

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-card border border-rule bg-parchment p-5 shadow-card"
    >
      <h3 className="font-display text-lg font-semibold text-espresso">Log a visit</h3>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm sm:col-span-3">
          <span className={labelClass}>Restaurant</span>
          <select
            value={restaurantId}
            onChange={(e) => setRestaurantId(e.target.value)}
            className={inputClass}
            required
          >
            <option value="">Select a restaurant...</option>
            {restaurants.map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>
                {restaurant.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className={labelClass}>Date</span>
          <input
            type="date"
            value={visitedOn}
            onChange={(e) => setVisitedOn(e.target.value)}
            className={inputClass}
            required
          />
        </label>

        <label className="text-sm">
          <span className={labelClass}>Amount (USD)</span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="18.50"
            className={inputClass}
            required
          />
        </label>

        <label className="text-sm">
          <span className={labelClass}>Note (optional)</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Lunch"
            maxLength={500}
            className={inputClass}
          />
        </label>
      </div>

      {failure && (
        <div
          role="alert"
          className="rounded border border-tomato/40 bg-tomato/5 p-3 text-sm text-tomato-ink"
        >
          <p className="font-medium">{failure.message}</p>
          {failure.details.length > 0 && (
            <ul className="mt-1 list-inside list-disc">
              {failure.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-tomato-deep px-3.5 py-2 text-sm font-medium text-white motion-safe:transition-colors hover:bg-tomato-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Log visit'}
      </button>
    </form>
  );
}
