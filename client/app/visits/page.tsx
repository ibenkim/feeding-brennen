import Link from 'next/link';
import { getRestaurants, getVisitsForMonth } from '@/lib/apiClient';
import { formatCents, formatMonth, formatVisitDate } from '@/lib/format';
import { currentMonthKey, isMonthKey } from '@/lib/validation';
import { LogVisitForm } from './LogVisitForm';

// Server component. Reads the month from the URL so the page is shareable and
// the browser's back button works, then gets both lists over HTTP like every
// other page here - no direct database access, no Server Actions.
//
// `?restaurant=` is optional and only preselects the form's dropdown - it comes
// from the "Log Visit" button on an overview card, so the two pages join up.
// The behaviour of this page is otherwise unchanged; only its styling moved to
// the Warm Dining Ledger palette.

export default async function VisitsPage({
  searchParams,
}: {
  searchParams: { month?: string; restaurant?: string };
}) {
  // The API refuses to guess a month, so the page picks the default. A junk
  // `?month=` in the URL falls back to today's month rather than erroring.
  const requested = searchParams.month;
  const month = requested && isMonthKey(requested) ? requested : currentMonthKey();

  const [restaurants, { visits, summary }] = await Promise.all([
    getRestaurants(),
    getVisitsForMonth(month),
  ]);

  const preselected =
    searchParams.restaurant && /^\d+$/.test(searchParams.restaurant)
      ? searchParams.restaurant
      : '';

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h2 className="font-display text-xl font-semibold text-espresso">
            Visit Ledger
          </h2>
          <p className="mt-0.5 text-sm text-clay">
            Every meal you logged, one month at a time.
          </p>
        </div>
        <Link
          href="/"
          className="text-sm font-medium text-tomato-ink underline underline-offset-2"
        >
          Back to overview
        </Link>
      </div>

      <LogVisitForm
        restaurants={restaurants}
        selectedMonth={month}
        initialRestaurantId={preselected}
      />

      <section className="rounded-card border border-rule bg-parchment p-5 shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-espresso">
              {formatMonth(month)}
            </h3>
            <p className="tabular mt-1 text-sm text-clay">
              {summary.visitCount} {summary.visitCount === 1 ? 'visit' : 'visits'} ·{' '}
              <span className="font-semibold text-espresso">
                {formatCents(summary.totalAmountCents)}
              </span>{' '}
              spent
            </p>
          </div>

          {/* A plain GET form: the month lives in the URL, so this needs no JS. */}
          <form method="get" action="/visits" className="flex items-end gap-2">
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-clay">
                Month
              </span>
              <input
                type="month"
                name="month"
                defaultValue={month}
                className="rounded border border-rule bg-parchment px-2 py-1.5 text-sm text-espresso"
              />
            </label>
            <button
              type="submit"
              className="rounded border border-rule bg-parchment px-3 py-1.5 text-sm font-medium text-espresso hover:bg-cream"
            >
              Show
            </button>
          </form>
        </div>
      </section>

      {visits.length === 0 ? (
        <p className="rounded-card border border-dashed border-rule-strong bg-parchment/60 p-8 text-center text-sm text-clay">
          No visits logged for {formatMonth(month)} yet. Log one above, or pick a
          different month.
        </p>
      ) : (
        <ul className="space-y-3">
          {visits.map((visit) => (
            <li
              key={visit.id}
              className="rounded-card border border-rule bg-parchment p-4 shadow-card"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <span className="font-display text-base font-semibold text-espresso">
                  {visit.restaurantName}
                </span>
                <span className="tabular text-sm font-semibold text-espresso">
                  {formatCents(visit.amountCents)}
                </span>
              </div>
              <div className="mt-1 text-sm text-clay">
                {formatVisitDate(visit.visitedOn)}
                {visit.note ? ` · ${visit.note}` : ''}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
