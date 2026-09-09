import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { handleError } from '@/lib/errors';
import {
  centsFromNumericString,
  dateOnly,
  type MonthSpending,
  type RestaurantSpending,
  type SpendingInsights,
} from '@/lib/types';
import { parseMonthKey } from '@/lib/validation';

// The handler reads `?month=` off the request, so there is nothing to
// prerender. Saying so up front keeps `next build` from attempting a static
// pass that can only fail.
export const dynamic = 'force-dynamic';

/**
 * Everything the overview page needs to talk about money, in two aggregate
 * queries: the selected month against the one before it, and each restaurant's
 * all-time visit history.
 *
 * Nothing here is stored or cached. Both totals are recomputed from the `visits`
 * rows on every request, so no derived number can drift out of step with the
 * ledger that produced it.
 */

/**
 * A month bucket as SQL hands it back. `visitCount` counts every visit;
 * `pricedCount` counts only the ones carrying an amount, because
 * `visits."amountSpent"` is nullable and an unpriced visit must not drag an
 * average toward zero.
 */
type Bucket = { visitCount: number; pricedCount: number; totalAmountCents: number };

const EMPTY_BUCKET: Bucket = { visitCount: 0, pricedCount: 0, totalAmountCents: 0 };

/** SUM over an empty group is NULL, and `pg` reports every count as a string. */
function toBucket(row: Record<string, unknown> | undefined): Bucket {
  if (!row) return EMPTY_BUCKET;
  return {
    visitCount: Number(row.visitCount),
    pricedCount: Number(row.pricedCount),
    totalAmountCents: centsFromNumericString(row.totalAmountSpent) ?? 0,
  };
}

/** Rounded to the nearest whole cent, or null when there is nothing to average. */
function averageCents(totalCents: number, count: number): number | null {
  return count > 0 ? Math.round(totalCents / count) : null;
}

function toMonthSpending(bucket: Bucket): MonthSpending {
  return {
    totalAmountCents: bucket.totalAmountCents,
    visitCount: bucket.visitCount,
    averageVisitCents: averageCents(bucket.totalAmountCents, bucket.pricedCount),
  };
}

/**
 * Percent change against the previous month, to two decimals.
 *
 * Null when the previous total is zero: there is no baseline, and both `0/0`
 * and `x/0` would put NaN or Infinity into the response body.
 */
function percentDelta(currentCents: number, previousCents: number): number | null {
  if (previousCents === 0) return null;
  return Math.round(((currentCents - previousCents) / previousCents) * 10000) / 100;
}

/**
 * GET /api/spending/insights?month=YYYY-MM
 *
 * `month` is required and validated by the same `parseMonthKey` the visit
 * ledger uses, so both endpoints answer a missing or malformed month the same
 * way.
 */
export async function GET(req: Request) {
  try {
    const month = parseMonthKey(new URL(req.url).searchParams.get('month'));
    const monthStart = `${month}-01`;

    // Half-open ranges over the two months, bucketed in one pass. The bare
    // `date` column keeps the comparison sargable and no timezone arithmetic
    // happens in JS.
    const monthsQuery = pool.query(
      `SELECT
         (date >= $1::date) AS "isCurrent",
         COUNT(*)                          AS "visitCount",
         COUNT("amountSpent")              AS "pricedCount",
         COALESCE(SUM("amountSpent"), 0)   AS "totalAmountSpent"
       FROM visits
       WHERE date >= ($1::date - INTERVAL '1 month')
         AND date <  ($1::date + INTERVAL '1 month')
       GROUP BY 1`,
      [monthStart]
    );

    // All-time per restaurant, not this month's: "what a visit here usually
    // costs" is a question one month of data answers badly. Restaurants with no
    // visits are absent rather than zero-filled - the UI says so explicitly
    // instead of showing an invented average.
    const restaurantsQuery = pool.query(
      `WITH totals AS (
         SELECT "restaurantId",
                COUNT(*)                        AS "visitCount",
                COUNT("amountSpent")            AS "pricedCount",
                COALESCE(SUM("amountSpent"), 0) AS "totalAmountSpent"
         FROM visits
         GROUP BY "restaurantId"
       ), latest AS (
         SELECT DISTINCT ON ("restaurantId")
                "restaurantId", date, "amountSpent"
         FROM visits
         ORDER BY "restaurantId", date DESC, id DESC
       )
       SELECT totals."restaurantId",
              totals."visitCount",
              totals."pricedCount",
              totals."totalAmountSpent",
              latest.date          AS "lastVisitDate",
              latest."amountSpent" AS "lastAmountSpent"
       FROM totals
       JOIN latest USING ("restaurantId")
       ORDER BY totals."restaurantId"`
    );

    const [months, restaurants] = await Promise.all([monthsQuery, restaurantsQuery]);

    const current = toBucket(months.rows.find((row) => row.isCurrent === true));
    const previous = toBucket(months.rows.find((row) => row.isCurrent === false));

    const body: SpendingInsights = {
      month,
      current: toMonthSpending(current),
      previous: toMonthSpending(previous),
      comparison: {
        amountDeltaCents: current.totalAmountCents - previous.totalAmountCents,
        percentDelta: percentDelta(current.totalAmountCents, previous.totalAmountCents),
      },
      restaurants: restaurants.rows.map(toRestaurantSpending),
    };

    return NextResponse.json(body);
  } catch (err) {
    return handleError(err);
  }
}

function toRestaurantSpending(row: Record<string, unknown>): RestaurantSpending {
  const totalAmountCents = centsFromNumericString(row.totalAmountSpent) ?? 0;
  const pricedCount = Number(row.pricedCount);

  return {
    restaurantId: Number(row.restaurantId),
    visitCount: Number(row.visitCount),
    averageVisitCents: averageCents(totalAmountCents, pricedCount),
    totalAmountCents,
    lastVisitDate: dateOnly(row.lastVisitDate),
    lastAmountCents: centsFromNumericString(row.lastAmountSpent),
  };
}
