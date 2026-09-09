import { ApiError } from './errors';
import {
  MAX_RESTAURANT_TAGS,
  RESTAURANT_TAGS,
  type RestaurantTag,
} from './types';

/** SERIAL / int4 ceiling — larger ids would blow up in Postgres as 22003. */
const MAX_SERIAL_ID = 2_147_483_647;

export type RestaurantInput = {
  name: string;
  cuisine: string | null;
  address: string | null;
  rating: number | null;
};

/** The Part B personalization fields, validated separately from the fixed ones. */
export type RestaurantProfileInput = {
  favoriteDish: string | null;
  isFavorite: boolean;
  tags: RestaurantTag[];
};

export type VisitInput = {
  restaurantId: number;
  visitedOn: string;
  amountCents: number;
  note: string | null;
};

/**
 * `visits."amountSpent"` is NUMERIC(10, 2), so it tops out at 99,999,999.99.
 * Capping here keeps an oversized amount a 400 instead of a Postgres 22003.
 */
const MAX_AMOUNT_CENTS = 9_999_999_999;
const NOTE_MAX_LENGTH = 500;
/** A dish name, not a paragraph. The column is TEXT; this is the product rule. */
const FAVORITE_DISH_MAX_LENGTH = 120;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Parse a restaurant route id. Anything that isn't a positive integer
 * (including `abc`, `-1`, `1.5`) is a 404 — there is no such restaurant.
 */
export function parseRestaurantId(raw: string): number {
  if (!/^\d+$/.test(raw)) {
    throw new ApiError(404, 'Restaurant not found');
  }

  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1 || id > MAX_SERIAL_ID) {
    throw new ApiError(404, 'Restaurant not found');
  }

  return id;
}

/**
 * Read a JSON request body. Malformed JSON becomes a 400 rather than an
 * unhandled SyntaxError (which Next would otherwise turn into an HTML page).
 */
export async function parseJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new ApiError(400, 'Invalid JSON body');
    }
    throw err;
  }
}

/** Every body validated here must be a plain JSON object, not an array or scalar. */
function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ApiError(400, 'Validation failed', ['Request body must be a JSON object']);
  }
  return body as Record<string, unknown>;
}

/** The four fixed Part A fields. Collects into a shared `details` list. */
function parseRestaurantFields(
  record: Record<string, unknown>,
  details: string[]
): RestaurantInput {
  return {
    name: parseRequiredName(record.name, details),
    cuisine: parseOptionalString(record, 'cuisine', details),
    address: parseOptionalString(record, 'address', details),
    rating: parseOptionalRating(record, details),
  };
}

/**
 * Validate a create/replace restaurant body. Required vs optional fields,
 * types, and the 0–5 rating range are all checked before any database write.
 */
export function parseRestaurantInput(body: unknown): RestaurantInput {
  const record = asRecord(body);
  const details: string[] = [];

  const input = parseRestaurantFields(record, details);

  if (details.length > 0) {
    throw new ApiError(400, 'Validation failed', details);
  }

  return input;
}

/**
 * The same body, plus the optional Part B personalization fields.
 *
 * Both halves share one `details` array so a body that gets the rating *and*
 * the tags wrong is rejected once, listing both — the caller shouldn't have to
 * fix an invalid body one field per round trip.
 *
 * Every profile field is optional and falls back to the column default, so a
 * plain Part A body validates identically through either function.
 */
export function parseRestaurantProfileInput(
  body: unknown
): RestaurantInput & RestaurantProfileInput {
  const record = asRecord(body);
  const details: string[] = [];

  const input = parseRestaurantFields(record, details);
  const profile = {
    favoriteDish: parseFavoriteDish(record, details),
    isFavorite: parseIsFavorite(record, details),
    tags: parseTags(record, details),
  };

  if (details.length > 0) {
    throw new ApiError(400, 'Validation failed', details);
  }

  return { ...input, ...profile };
}

function parseFavoriteDish(
  record: Record<string, unknown>,
  details: string[]
): string | null {
  const value = record.favoriteDish;
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    details.push('favoriteDish must be a string or null');
    return null;
  }

  const dish = value.trim();
  if (dish.length === 0) {
    return null;
  }
  if (dish.length > FAVORITE_DISH_MAX_LENGTH) {
    details.push(`favoriteDish must be ${FAVORITE_DISH_MAX_LENGTH} characters or fewer`);
    return null;
  }

  return dish;
}

/** A strict boolean: "true", 1, and "on" are not booleans, they're guesses. */
function parseIsFavorite(record: Record<string, unknown>, details: string[]): boolean {
  const value = record.isFavorite;
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value !== 'boolean') {
    details.push('isFavorite must be a boolean');
    return false;
  }
  return value;
}

/**
 * A short, unique selection from a closed vocabulary. Unknown values are
 * rejected rather than dropped: silently discarding a tag the caller asked for
 * would make the response disagree with the request for no visible reason.
 */
function parseTags(record: Record<string, unknown>, details: string[]): RestaurantTag[] {
  const value = record.tags;
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    details.push('tags must be an array of tag strings');
    return [];
  }
  if (value.length > MAX_RESTAURANT_TAGS) {
    details.push(`tags must contain at most ${MAX_RESTAURANT_TAGS} tags`);
    return [];
  }

  const tags: RestaurantTag[] = [];
  const unknown: string[] = [];
  let duplicated = false;

  for (const entry of value) {
    if (typeof entry !== 'string' || !RESTAURANT_TAGS.includes(entry as RestaurantTag)) {
      unknown.push(typeof entry === 'string' ? entry : typeof entry);
      continue;
    }
    if (tags.includes(entry as RestaurantTag)) {
      duplicated = true;
      continue;
    }
    tags.push(entry as RestaurantTag);
  }

  if (unknown.length > 0) {
    details.push(
      `tags may only contain ${RESTAURANT_TAGS.join(', ')} (got ${unknown.join(', ')})`
    );
  }
  if (duplicated) {
    details.push('tags must not repeat a value');
  }

  // A rejected list is never partially applied; the caller gets a 400 either
  // way, and returning half of what they asked for would be worse than nothing.
  return unknown.length > 0 || duplicated ? [] : tags;
}

function parseRequiredName(value: unknown, details: string[]): string {
  if (value === undefined) {
    details.push('name is required');
    return '';
  }
  if (typeof value !== 'string') {
    details.push('name must be a string');
    return '';
  }
  const name = value.trim();
  if (name.length === 0) {
    details.push('name must not be empty');
    return '';
  }
  return name;
}

function parseOptionalString(
  record: Record<string, unknown>,
  field: 'cuisine' | 'address',
  details: string[]
): string | null {
  if (!(field in record) || record[field] === null) {
    return null;
  }
  if (typeof record[field] !== 'string') {
    details.push(`${field} must be a string or null`);
    return null;
  }
  return (record[field] as string).trim();
}

function parseOptionalRating(
  record: Record<string, unknown>,
  details: string[]
): number | null {
  if (!('rating' in record) || record.rating === null) {
    return null;
  }
  if (typeof record.rating !== 'number' || !Number.isFinite(record.rating)) {
    details.push('rating must be a number between 0 and 5');
    return null;
  }
  if (record.rating < 0 || record.rating > 5) {
    details.push('rating must be a number between 0 and 5');
    return null;
  }
  return record.rating;
}

/**
 * Validate a create-visit body. Everything is checked before the insert, so a
 * bad body never reaches the database.
 */
export function parseVisitInput(body: unknown): VisitInput {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ApiError(400, 'Validation failed', ['Request body must be a JSON object']);
  }

  const record = body as Record<string, unknown>;
  const details: string[] = [];

  const restaurantId = parseVisitRestaurantId(record.restaurantId, details);
  const visitedOn = parseVisitedOn(record.visitedOn, details);
  const amountCents = parseAmountCents(record, details);
  const note = parseNote(record, details);

  if (details.length > 0) {
    throw new ApiError(400, 'Validation failed', details);
  }

  return { restaurantId, visitedOn, amountCents, note };
}

/**
 * A restaurant id in a request *body* is a field like any other, so a bad one
 * is a 400. (In a route path it's a 404 - see `parseRestaurantId` above.)
 */
function parseVisitRestaurantId(value: unknown, details: string[]): number {
  if (value === undefined || value === null) {
    details.push('restaurantId is required');
    return 0;
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    details.push('restaurantId must be an integer');
    return 0;
  }
  if (value < 1 || value > MAX_SERIAL_ID) {
    details.push('restaurantId must be a positive integer');
    return 0;
  }
  return value;
}

/**
 * `YYYY-MM-DD` and an actual day on the calendar. The format check alone would
 * accept 2026-02-30, so the parsed date is round-tripped: if any component
 * changed, Postgres would have rejected it (or rolled it over).
 */
function parseVisitedOn(value: unknown, details: string[]): string {
  if (value === undefined || value === null) {
    details.push('visitedOn is required');
    return '';
  }
  if (typeof value !== 'string' || !ISO_DATE.test(value)) {
    details.push('visitedOn must be a date string in YYYY-MM-DD format');
    return '';
  }

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    details.push('visitedOn must be a real calendar date');
    return '';
  }

  return value;
}

/** Integer cents only: no floats, no numeric strings, nothing the column can't hold. */
function parseAmountCents(record: Record<string, unknown>, details: string[]): number {
  const value = record.amountCents;

  if (value === undefined || value === null) {
    details.push('amountCents is required');
    return 0;
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    details.push('amountCents must be an integer number of cents');
    return 0;
  }
  if (value < 1) {
    details.push('amountCents must be greater than 0');
    return 0;
  }
  if (value > MAX_AMOUNT_CENTS) {
    details.push(`amountCents must not exceed ${MAX_AMOUNT_CENTS}`);
    return 0;
  }

  return value;
}

function parseNote(record: Record<string, unknown>, details: string[]): string | null {
  if (!('note' in record) || record.note === null || record.note === undefined) {
    return null;
  }
  if (typeof record.note !== 'string') {
    details.push('note must be a string or null');
    return null;
  }

  const note = record.note.trim();
  if (note.length === 0) {
    return null;
  }
  if (note.length > NOTE_MAX_LENGTH) {
    details.push(`note must be ${NOTE_MAX_LENGTH} characters or fewer`);
    return null;
  }

  return note;
}

/**
 * `?include=profile` on the restaurant collection: opt in to the enriched
 * representation. Absent means the fixed Part A response, so the contract is
 * the default and the addition is the thing you have to ask for.
 *
 * An unrecognised value is a 400 rather than a silent fall-through — a typo'd
 * `?include=profiles` returning the plain shape would look like the metadata
 * had vanished.
 */
export function parseIncludeProfile(raw: string | null): boolean {
  if (raw === null) return false;
  if (raw === 'profile') return true;
  throw new ApiError(400, 'Validation failed', [
    "include must be 'profile' if provided",
  ]);
}

/**
 * Require an explicit `?month=YYYY-MM`. There is no default: a monthly total is
 * meaningless if the caller isn't sure which month it covers.
 */
export function parseMonthKey(raw: string | null): string {
  if (raw === null || raw.trim() === '') {
    throw new ApiError(400, 'Validation failed', ['month query parameter is required']);
  }
  if (!MONTH_KEY.test(raw)) {
    throw new ApiError(400, 'Validation failed', [
      'month must be in YYYY-MM format, e.g. 2026-09',
    ]);
  }
  return raw;
}

/** Same rule as `parseMonthKey`, but as a test - for the UI, which shouldn't throw. */
export function isMonthKey(value: string): boolean {
  return MONTH_KEY.test(value);
}

/** The current month as `YYYY-MM`, in the server's timezone. */
export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
