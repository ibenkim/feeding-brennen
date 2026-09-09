-- Migration 002: personalization metadata on restaurants.
--
-- Run with: npm run migrate
--
-- Three additive columns behind the Part B restaurant profile: the dish worth
-- coming back for, a favorite flag, and a small set of context tags.
--
-- The runner in db/migrate.ts has no ledger - it replays every .sql file in
-- this directory on every run - so each statement below is written to be safe
-- when executed again. `ADD COLUMN IF NOT EXISTS` is a no-op once the column
-- exists, and neither the defaults nor the backfill touch a row twice: the
-- defaults only apply to rows created after this runs.
--
-- Naming follows 001: quoted camelCase for the columns the API speaks
-- ("restaurantId", "amountSpent"), snake_case reserved for `created_at`.

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS "favoriteDish" TEXT;

-- NOT NULL with a default is safe on an existing table: Postgres 11+ fills
-- existing rows from the default without rewriting them.
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS "isFavorite" BOOLEAN NOT NULL DEFAULT false;

-- TEXT[] rather than a join table: tags are a short closed vocabulary chosen in
-- lib/validation.ts, never user-defined, so there is nothing to normalize.
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
