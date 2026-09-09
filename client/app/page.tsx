import Link from 'next/link';
import { RestaurantLibrary } from '@/components/RestaurantLibrary';
import { SpendingSnapshot } from '@/components/SpendingSnapshot';
import { getRestaurantProfiles, getSpendingInsights } from '@/lib/apiClient';
import { formatMonth } from '@/lib/format';
import { currentMonthKey, isMonthKey } from '@/lib/validation';

/**
 * The overview: what a month cost, and every restaurant that could add to it.
 *
 * A server component that reads the month from the URL, then gets everything
 * over HTTP like every other page here - no Server Actions and no database
 * access from a page. Two collection-level calls cover the whole screen: the
 * enriched restaurant list and the month's spending insights.
 */

/** A failure the page can show instead of a Next.js error screen. */
function LoadFailure({ month }: { month: string }) {
  return (
    <div
      role="alert"
      className="rounded-card border border-tomato/40 bg-tomato/5 p-6 text-sm text-tomato-ink"
    >
      <h2 className="font-display text-lg font-semibold">
        Could not load the ledger
      </h2>
      <p className="mt-1">
        The API did not answer for {formatMonth(month)}. Check that the dev server
        and the Postgres container are both running, then reload.
      </p>
    </div>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  // The API refuses to guess a month, so the page picks the default. A junk
  // `?month=` in the URL falls back to today's month rather than erroring.
  const requested = searchParams.month;
  const month = requested && isMonthKey(requested) ? requested : currentMonthKey();

  const data = await Promise.all([
    getRestaurantProfiles(),
    getSpendingInsights(month),
  ]).catch(() => null);

  if (data === null) {
    return <LoadFailure month={month} />;
  }

  const [restaurants, insights] = data;

  return (
    <div>
      <section className="mb-10">
        <p className="font-display text-lg italic text-clay">
          Remember the meal. Understand the spend.
        </p>
        <p className="mt-2 max-w-2xl text-sm text-clay">
          Keep the places worth returning to, log what a visit actually cost, and see
          the month add up.{' '}
          <Link
            href="/visits"
            className="font-medium text-tomato-ink underline underline-offset-2"
          >
            Open the visit ledger
          </Link>{' '}
          to record one.
        </p>
      </section>

      <SpendingSnapshot month={month} insights={insights} />

      <RestaurantLibrary
        restaurants={restaurants}
        spending={insights.restaurants}
        monthTotalCents={insights.current.totalAmountCents}
        month={month}
      />
    </div>
  );
}
