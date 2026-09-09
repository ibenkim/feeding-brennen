import { NextResponse } from 'next/server';

/**
 * Application-level error that already knows its HTTP status. Throw these from
 * route handlers and validation so `handleError` can map them in one place.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly details?: string[];

  constructor(status: number, message: string, details?: string[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

type PostgresErrorLike = {
  code: string;
};

function getPostgresErrorCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null || !('code' in err)) {
    return undefined;
  }
  const code = (err as PostgresErrorLike).code;
  return typeof code === 'string' ? code : undefined;
}

function mapPostgresError(
  code: string
): { status: number; message: string } | undefined {
  switch (code) {
    case '23505': // unique_violation
    case '23503': // foreign_key_violation
      return { status: 409, message: 'Conflict' };
    case '22P02': // invalid_text_representation
    case '23502': // not_null_violation
    case '23514': // check_violation
    case '22003': // numeric_value_out_of_range
      return { status: 400, message: 'Invalid request' };
    default:
      return undefined;
  }
}

/**
 * Central error -> HTTP response mapper for the API route handlers. Call it
 * from a route's `catch` block so error handling lives in one place:
 *
 *   try {
 *     ...
 *   } catch (err) {
 *     return handleError(err);
 *   }
 *
 * Known failures (validation, not-found, malformed JSON, common Postgres
 * constraint codes) become 4xx responses. Unexpected errors stay a generic
 * 500 with no stack trace or driver text.
 */
export function handleError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    const body: { error: string; details?: string[] } = { error: err.message };
    if (err.details && err.details.length > 0) {
      body.details = err.details;
    }
    return NextResponse.json(body, { status: err.status });
  }

  if (err instanceof SyntaxError) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const pgCode = getPostgresErrorCode(err);
  if (pgCode) {
    const mapped = mapPostgresError(pgCode);
    if (mapped) {
      console.error('Database constraint error:', pgCode);
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }
  }

  console.error('Unhandled API error:', err);
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}
