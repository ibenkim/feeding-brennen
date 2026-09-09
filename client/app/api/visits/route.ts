import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { ApiError, handleError } from '@/lib/errors';
import { numericStringFromCents, toVisit } from '@/lib/types';
import { parseJsonBody, parseMonthKey, parseVisitInput } from '@/lib/validation';

// Visits are joined to restaurants on every read so the response carries the
// restaurant name - the list is read by month, not by restaurant.
const VISIT_COLUMNS = `v.id, v."restaurantId", r.name AS "restaurantName", v.date,
          v."amountSpent", v.notes, v.created_at AS "createdAt"`;

/**
 * GET /api/visits?month=YYYY-MM
 * The month's visits, newest first, with a derived spending summary.
 */
export async function GET(req: Request) {
  try {
    const month = parseMonthKey(new URL(req.url).searchParams.get('month'));

    // Half-open range on a bare column, so the date index stays usable and no
    // timezone arithmetic happens in JS.
    const { rows } = await pool.query(
      `SELECT ${VISIT_COLUMNS}
       FROM visits v
       JOIN restaurants r ON r.id = v."restaurantId"
       WHERE v.date >= $1::date AND v.date < ($1::date + INTERVAL '1 month')
       ORDER BY v.date DESC, v.id DESC`,
      [`${month}-01`]
    );

    const visits = rows.map(toVisit);

    // Derived on every read - nothing is stored or kept in step. Summing in JS
    // is safe here because the response is the whole month, unpaginated, and
    // already mapped to integer cents.
    const totalAmountCents = visits.reduce(
      (total, visit) => total + (visit.amountCents ?? 0),
      0
    );

    return NextResponse.json({
      month,
      visits,
      summary: { visitCount: visits.length, totalAmountCents },
    });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * POST /api/visits
 * Log a completed visit: { restaurantId, visitedOn, amountCents, note? }.
 */
export async function POST(req: Request) {
  try {
    const input = parseVisitInput(await parseJsonBody(req));

    // One statement, so the restaurant lookup and the insert can't disagree:
    // the row is only written if the restaurant exists, there's no
    // check-then-insert gap, and the joined name comes back with it. No rows
    // returned means no such restaurant.
    const { rows } = await pool.query(
      `WITH restaurant AS (
         SELECT id, name FROM restaurants WHERE id = $1
       ), inserted AS (
         INSERT INTO visits ("restaurantId", date, "amountSpent", notes)
         SELECT restaurant.id, $2::date, $3::numeric, $4
         FROM restaurant
         RETURNING id, "restaurantId", date, "amountSpent", notes,
                   created_at AS "createdAt"
       )
       SELECT inserted.*, restaurant.name AS "restaurantName"
       FROM inserted CROSS JOIN restaurant`,
      [
        input.restaurantId,
        input.visitedOn,
        numericStringFromCents(input.amountCents),
        input.note,
      ]
    );

    if (rows.length === 0) {
      throw new ApiError(404, 'Restaurant not found');
    }

    return NextResponse.json(toVisit(rows[0]), { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
