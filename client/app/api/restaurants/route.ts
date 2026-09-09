import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { handleError } from '@/lib/errors';
import { toRestaurant, toRestaurantProfile } from '@/lib/types';
import {
  parseIncludeProfile,
  parseJsonBody,
  parseRestaurantProfileInput,
} from '@/lib/validation';

// The fixed Part A projection. Nothing may be appended to this list - the
// contract in CHALLENGE.md names exactly these five fields.
const RESTAURANT_COLUMNS =
  'id, name, cuisine, address, rating, created_at AS "createdAt"';

// The opt-in Part B projection, selected only for `?include=profile`.
const PROFILE_COLUMNS = `${RESTAURANT_COLUMNS}, "favoriteDish", "isFavorite", tags`;

/**
 * GET /api/restaurants
 * Returns all restaurants.
 *
 * `?include=profile` returns the same rows with the personalization columns
 * from 002 attached. Without it the response is byte-for-byte the Part A shape,
 * so the enriched fields are opt-in and the fixed contract is the default.
 */
export async function GET(req: Request) {
  try {
    const withProfile = parseIncludeProfile(
      new URL(req.url).searchParams.get('include')
    );

    const { rows } = await pool.query(
      `SELECT ${withProfile ? PROFILE_COLUMNS : RESTAURANT_COLUMNS}
       FROM restaurants
       ORDER BY created_at DESC, id DESC`
    );

    // Map every row - raw rows don't match the contract (NUMERIC comes back
    // as a string, timestamps as Date objects). See lib/types.ts.
    return NextResponse.json(
      rows.map(withProfile ? toRestaurantProfile : toRestaurant)
    );
  } catch (err) {
    return handleError(err);
  }
}

/**
 * POST /api/restaurants
 * Create a new restaurant.
 *
 * The optional `favoriteDish`, `isFavorite`, and `tags` fields are always
 * accepted and always validated; omitting them stores the column defaults, so a
 * Part A body behaves exactly as it did before. The *response* still defaults
 * to the fixed Part A shape - pass `?include=profile` to get the metadata back.
 */
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const withProfile = parseIncludeProfile(url.searchParams.get('include'));
    const input = parseRestaurantProfileInput(await parseJsonBody(req));

    const { rows } = await pool.query(
      `INSERT INTO restaurants (name, cuisine, address, rating, "favoriteDish", "isFavorite", tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7::text[])
       RETURNING ${withProfile ? PROFILE_COLUMNS : RESTAURANT_COLUMNS}`,
      [
        input.name,
        input.cuisine,
        input.address,
        input.rating,
        input.favoriteDish,
        input.isFavorite,
        input.tags,
      ]
    );

    const created = withProfile
      ? toRestaurantProfile(rows[0])
      : toRestaurant(rows[0]);

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
