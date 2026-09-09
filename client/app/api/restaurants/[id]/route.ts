import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { ApiError, handleError } from '@/lib/errors';
import { toRestaurant } from '@/lib/types';
import {
  parseJsonBody,
  parseRestaurantId,
  parseRestaurantInput,
} from '@/lib/validation';

const RESTAURANT_COLUMNS =
  'id, name, cuisine, address, rating, created_at AS "createdAt"';

type Params = { params: { id: string } };

/**
 * GET /api/restaurants/:id
 * Returns a single restaurant, or 404 if it doesn't exist.
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const id = parseRestaurantId(params.id);
    const { rows } = await pool.query(
      `SELECT ${RESTAURANT_COLUMNS} FROM restaurants WHERE id = $1`,
      [id]
    );

    if (rows.length === 0) {
      throw new ApiError(404, 'Restaurant not found');
    }

    return NextResponse.json(toRestaurant(rows[0]));
  } catch (err) {
    return handleError(err);
  }
}

/**
 * PUT /api/restaurants/:id
 * Replace an existing restaurant. Body is validated the same way as POST.
 */
export async function PUT(req: Request, { params }: Params) {
  try {
    const id = parseRestaurantId(params.id);
    const input = parseRestaurantInput(await parseJsonBody(req));

    const { rows } = await pool.query(
      `UPDATE restaurants
       SET name = $1, cuisine = $2, address = $3, rating = $4
       WHERE id = $5
       RETURNING ${RESTAURANT_COLUMNS}`,
      [input.name, input.cuisine, input.address, input.rating, id]
    );

    if (rows.length === 0) {
      throw new ApiError(404, 'Restaurant not found');
    }

    return NextResponse.json(toRestaurant(rows[0]));
  } catch (err) {
    return handleError(err);
  }
}

/**
 * DELETE /api/restaurants/:id
 * Delete a restaurant. Visits cascade via the migration's ON DELETE CASCADE.
 */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const id = parseRestaurantId(params.id);
    const { rows } = await pool.query(
      'DELETE FROM restaurants WHERE id = $1 RETURNING id',
      [id]
    );

    if (rows.length === 0) {
      throw new ApiError(404, 'Restaurant not found');
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleError(err);
  }
}
