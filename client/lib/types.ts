/**
 * The data shapes the API speaks, in one place.
 *
 * Both sides of the boundary import from here: the route handlers in
 * `app/api/` that produce these objects, and `lib/apiClient.ts` that consumes
 * them. Neither side owns the definition.
 *
 * Alongside each interface is a `toX()` mapper that converts a raw database row
 * into that shape. You need them because `pg` does not hand back the types you
 * might expect:
 *
 *   - `NUMERIC` columns (`rating`, `amountSpent`) arrive as **strings**
 *     ("4.5", not 4.5). node-postgres does this on purpose - NUMERIC has more
 *     precision than a JS number, so parsing it automatically could lose data.
 *     `visits."amountSpent"` is exact dollars in the database and integer cents
 *     in the API, so that conversion happens here too - see `toVisit()`.
 *   - `DATE` and `TIMESTAMPTZ` columns arrive as **Date objects**, which
 *     `JSON.stringify` turns into full ISO timestamps. For a calendar date like
 *     `visits.date` that's wrong twice over: it invents a time, and it shifts
 *     the day depending on the server's timezone.
 *
 * Returning `rows` straight from a query therefore does *not* match the
 * contract in CHALLENGE.md. Run rows through these mappers instead.
 *
 * NOTE: these are TypeScript types. They are erased at build time and validate
 * nothing at runtime - a body that claims to be a Restaurant is still just
 * `unknown` until you check it. That check is your job (task A3).
 */

export interface Restaurant {
  id: number;
  name: string;
  cuisine: string | null;
  address: string | null;
  /** 0-5. A real number in JSON, not a string. */
  rating: number | null;
  /** ISO 8601 timestamp, e.g. "2026-01-01T00:00:00.000Z" */
  createdAt: string;
}

/**
 * The context tags a restaurant can carry - a closed vocabulary, not free text.
 *
 * Kept here rather than in `lib/validation.ts` because both halves of the
 * boundary need it and only one of them may import `next/server`: the server
 * validates against this list, and the browser renders checkboxes from it.
 *
 * Cuisine is deliberately absent. It is its own structured column, and
 * duplicating it as a tag would give the same fact two sources of truth.
 */
export const RESTAURANT_TAGS = [
  'quick-bite',
  'date-night',
  'group-friendly',
  'late-night',
  'healthy',
  'worth-the-splurge',
] as const;

export type RestaurantTag = (typeof RESTAURANT_TAGS)[number];

/** At most three tags per restaurant - a shortlist, not a filing system. */
export const MAX_RESTAURANT_TAGS = 3;

/**
 * The Part B view of a restaurant: the fixed `Restaurant` above plus the
 * personalization columns added in `002_add_restaurant_metadata.sql`.
 *
 * This is a *separate* interface on purpose. `Restaurant` is the Part A
 * contract and must keep exactly the fields CHALLENGE.md lists, so the enriched
 * shape is opt-in (`GET /api/restaurants?include=profile`) and named
 * differently. Nothing can quietly widen the fixed response.
 */
export interface RestaurantProfile extends Restaurant {
  /** The dish worth coming back for. Null when never recorded. */
  favoriteDish: string | null;
  isFavorite: boolean;
  /** Always an array - the column is NOT NULL DEFAULT '{}'. */
  tags: RestaurantTag[];
}

export interface Visit {
  id: number;
  restaurantId: number;
  /** Every visit read joins `restaurants`, so the name always travels along. */
  restaurantName: string;
  /** Calendar date, "YYYY-MM-DD". No time, no timezone. */
  visitedOn: string;
  /**
   * Whole cents - the API never speaks fractional dollars. Nullable because
   * `visits."amountSpent"` is a nullable column: rows written before this
   * endpoint existed may have no amount, and we don't invent one.
   */
  amountCents: number | null;
  note: string | null;
  /** ISO 8601 timestamp. */
  createdAt: string;
}

// --- spending insights -------------------------------------------------------

/**
 * One month's spending, as `GET /api/spending/insights` reports it.
 *
 * `averageVisitCents` is null rather than zero when the month has nothing to
 * average - a month with no priced visits has no average, and `0` would read
 * as "every meal was free".
 */
export interface MonthSpending {
  totalAmountCents: number;
  visitCount: number;
  averageVisitCents: number | null;
}

/** Current month against the one before it. */
export interface SpendingComparison {
  amountDeltaCents: number;
  /** Null when the previous month's total is zero - there is no baseline to divide by. */
  percentDelta: number | null;
}

/**
 * A restaurant's **all-time** visit history, not the selected month's.
 *
 * The cards and Spend Impact both want "what a visit here usually costs", which
 * one month of data answers badly. Only restaurants that have been visited
 * appear here; a restaurant with no history is absent rather than zeroed.
 */
export interface RestaurantSpending {
  restaurantId: number;
  visitCount: number;
  /** Null when every visit on record has a null amount. */
  averageVisitCents: number | null;
  totalAmountCents: number;
  /** Calendar date, "YYYY-MM-DD". */
  lastVisitDate: string;
  lastAmountCents: number | null;
}

export interface SpendingInsights {
  month: string;
  current: MonthSpending;
  previous: MonthSpending;
  comparison: SpendingComparison;
  restaurants: RestaurantSpending[];
}

// --- row mappers -------------------------------------------------------------

/** NUMERIC -> number, preserving null. */
function num(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

/** A NUMERIC(10, 2) as `pg` hands it over: "42.50", "88", "31.7". */
const NUMERIC_MONEY = /^(-?)(\d+)(?:\.(\d{1,2}))?$/;

/**
 * NUMERIC dollars -> whole cents, without floating point. `Number("0.29") * 100`
 * is 28.999999999999996, so the digits are added up as integers instead.
 *
 * Anything finer than a cent cannot be represented and is *not* rounded -
 * quietly changing an amount of money is worse than failing. `handleError`
 * turns the throw into a generic 500, which is the honest answer: the column is
 * NUMERIC(10, 2), so a value like that means the data is wrong, not the caller.
 */
export function centsFromNumericString(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  const raw = String(value);
  const match = NUMERIC_MONEY.exec(raw);
  if (!match) {
    throw new Error(`Cannot represent NUMERIC "${raw}" as whole cents`);
  }

  const [, sign, whole, fraction = ''] = match;
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return sign === '-' ? -cents : cents;
}

/** Whole cents -> a NUMERIC literal ("1850" -> "18.50"), also float-free. */
export function numericStringFromCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  const dollars = Math.trunc(absolute / 100);
  return `${sign}${dollars}.${String(absolute % 100).padStart(2, '0')}`;
}

/** TIMESTAMPTZ -> ISO 8601 string. */
function isoTimestamp(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

/**
 * DATE -> "YYYY-MM-DD".
 *
 * Uses the date's *local* parts, not `toISOString()`. `pg` builds the Date at
 * local midnight, so converting to UTC can roll it to the neighbouring day.
 *
 * Exported because the spending endpoint reports a `lastVisitDate` that has to
 * follow the same rule as `toVisit()`'s `visitedOn` - two ways of turning a
 * DATE into a string is one too many.
 */
export function dateOnly(value: unknown): string {
  if (!(value instanceof Date)) return String(value);
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
}

/** Convert a `restaurants` row into the shape the API returns. */
export function toRestaurant(row: Record<string, unknown>): Restaurant {
  return {
    id: Number(row.id),
    name: String(row.name),
    cuisine: (row.cuisine as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    rating: num(row.rating),
    createdAt: isoTimestamp(row.createdAt),
  };
}

/**
 * `pg` hands a TEXT[] back as a JS array of strings, so the only work left is
 * narrowing it to the vocabulary. Anything unrecognised is dropped rather than
 * returned: the write path is the only thing that should be defining tags, and
 * a value that got in another way is not something the UI can render.
 */
function toTags(value: unknown): RestaurantTag[] {
  if (!Array.isArray(value)) return [];
  return value.filter((tag): tag is RestaurantTag =>
    RESTAURANT_TAGS.includes(tag as RestaurantTag)
  );
}

/**
 * Convert a `restaurants` row into the enriched Part B shape.
 *
 * Built on `toRestaurant()` so the fixed fields can only ever be mapped one
 * way - the enriched response is the Part A object plus three keys, never a
 * second interpretation of the same columns.
 */
export function toRestaurantProfile(row: Record<string, unknown>): RestaurantProfile {
  return {
    ...toRestaurant(row),
    favoriteDish: (row.favoriteDish as string | null) ?? null,
    isFavorite: row.isFavorite === true,
    tags: toTags(row.tags),
  };
}

/**
 * Convert a `visits` row (joined to `restaurants`) into the shape the API
 * returns. This is the single place the dollar column becomes integer cents.
 */
export function toVisit(row: Record<string, unknown>): Visit {
  return {
    id: Number(row.id),
    restaurantId: Number(row.restaurantId),
    restaurantName: String(row.restaurantName),
    visitedOn: dateOnly(row.date),
    amountCents: centsFromNumericString(row.amountSpent),
    note: (row.notes as string | null) ?? null,
    createdAt: isoTimestamp(row.createdAt),
  };
}
