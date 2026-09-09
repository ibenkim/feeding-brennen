/**
 * The client side of the API: helpers the frontend uses to call the endpoints.
 *
 * Don't confuse this with `app/api/`, which is the other side of the same
 * boundary - the route handlers that *implement* those endpoints. This file
 * only ever talks to them over HTTP.
 *
 * The shapes these helpers return live in `lib/types.ts`, shared with the
 * handlers that produce them.
 */
import type {
  Restaurant,
  RestaurantProfile,
  RestaurantTag,
  SpendingInsights,
  Visit,
} from './types';

/** The `GET /api/visits` envelope: the month's rows plus its derived totals. */
export interface VisitsForMonth {
  month: string;
  visits: Visit[];
  summary: {
    visitCount: number;
    totalAmountCents: number;
  };
}

export interface CreateVisitInput {
  restaurantId: number;
  visitedOn: string;
  amountCents: number;
  note: string | null;
}

/**
 * A new restaurant. The four fixed fields are the Part A body; the three
 * optional ones are the personalization added in `002`. Omitting them stores
 * the column defaults.
 */
export interface CreateRestaurantInput {
  name: string;
  cuisine: string | null;
  address: string | null;
  rating: number | null;
  favoriteDish?: string | null;
  isFavorite?: boolean;
  tags?: RestaurantTag[];
}

/**
 * A failed API call, carrying the API's own message and validation details so
 * the form can show the caller why it was rejected.
 *
 * This is deliberately not `ApiError` from `lib/errors.ts`: that one is the
 * server half of the boundary and imports `next/server`, which has no business
 * in a browser bundle.
 */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly details: string[];

  constructor(status: number, message: string, details: string[] = []) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.details = details;
  }
}

/** Turn a non-2xx response into an `ApiRequestError`, never leaking a raw body. */
async function toRequestError(res: Response): Promise<ApiRequestError> {
  let message = `Request failed with status ${res.status}`;
  let details: string[] = [];

  try {
    const body = await res.json();
    if (typeof body?.error === 'string') {
      message = body.error;
    }
    if (Array.isArray(body?.details)) {
      details = body.details.filter((d: unknown): d is string => typeof d === 'string');
    }
  } catch {
    // Not JSON - the status-based message above is all we can honestly say.
  }

  return new ApiRequestError(res.status, message, details);
}

// We read a base URL from the environment because Server Components fetch on
// the server, where relative URLs don't resolve - so we need an absolute origin.
// It's the same app on the same port, so this is normally just localhost:3000.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Fetch every restaurant from the API.
 *
 * NOTE: this is a bare fetch with no error handling. It does not check the
 * response status and it does not catch network failures - callers get whatever
 * `res.json()` produces, including on a 500.
 */
export async function getRestaurants(): Promise<Restaurant[]> {
  const res = await fetch(`${API_URL}/api/restaurants`, { cache: 'no-store' });
  return res.json();
}

/**
 * Fetch a single restaurant by id.
 */
export async function getRestaurant(id: number | string): Promise<Restaurant> {
  const res = await fetch(`${API_URL}/api/restaurants/${id}`, { cache: 'no-store' });
  return res.json();
}

/**
 * Fetch every restaurant with its personalization metadata attached.
 *
 * One request for the whole library, not one per card: the enriched columns
 * come back in the same collection response, so the restaurant grid never fans
 * out into per-restaurant fetches.
 *
 * Unlike `getRestaurants()` above (the starter's bare fetch, left as-is for the
 * Part A shape), this checks the status so the page can render a real error
 * state instead of crashing on a 500 body.
 */
export async function getRestaurantProfiles(): Promise<RestaurantProfile[]> {
  const res = await fetch(`${API_URL}/api/restaurants?include=profile`, {
    cache: 'no-store',
  });

  if (!res.ok) throw await toRequestError(res);
  return res.json();
}

/**
 * Create a restaurant and get the enriched record back, so the caller can show
 * exactly what was stored rather than what it hoped was stored.
 */
export async function createRestaurant(
  input: CreateRestaurantInput
): Promise<RestaurantProfile> {
  const res = await fetch(`${API_URL}/api/restaurants?include=profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) throw await toRequestError(res);
  return res.json();
}

/**
 * Fetch one month's spending snapshot plus every restaurant's all-time visit
 * history. `month` is always sent explicitly ("2026-09"); the API has no
 * default month and answers 400 without one.
 */
export async function getSpendingInsights(month: string): Promise<SpendingInsights> {
  const res = await fetch(
    `${API_URL}/api/spending/insights?month=${encodeURIComponent(month)}`,
    { cache: 'no-store' }
  );

  if (!res.ok) throw await toRequestError(res);
  return res.json();
}

/**
 * Fetch one month's visits and its summary. `month` is always sent explicitly
 * ("2026-09"); the API has no default month and answers 400 without one.
 *
 * `no-store` because a just-logged visit must show up on the next render.
 */
export async function getVisitsForMonth(month: string): Promise<VisitsForMonth> {
  const res = await fetch(
    `${API_URL}/api/visits?month=${encodeURIComponent(month)}`,
    { cache: 'no-store' }
  );

  if (!res.ok) throw await toRequestError(res);
  return res.json();
}

/** Log a completed visit. Rejections arrive as `ApiRequestError`. */
export async function createVisit(input: CreateVisitInput): Promise<Visit> {
  const res = await fetch(`${API_URL}/api/visits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) throw await toRequestError(res);
  return res.json();
}
