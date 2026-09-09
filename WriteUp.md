# Write-up

## 1. What did you build for Part B, and why that?
For Part B, I built a personal dining ledger that displays spending history and restaurant memory.

I would say the reason I go to restaurants are because the food and the experience are worth it, and because it's in my budget or spending habits.
Since the app from Part A left off from a simple visit logs that records the money without examining, it's hard to know why I went to the restaurant and what another visit would do to my experience and spending.

Therefore, I wanted to capture and understand the reasoning behind my each spending by adding context features such as type of cousine, favorite dish, and reason for visit (like a date night or friend hangout). I guess lot of restaurant review and saving apps/websites utilize a social factor where they share with the peers what they ate and are meant to 'show off' to others what they ate and what kind of dining habits they have. However, I would say what I built for Part B is more focused on being cost effectitve and personalized towards having better budgeting and experience simultaneously.

## 2. What did you decide, and what did you rule out?

I wanted to add more variables for each restaurant, but I noticed that the restaurant JSON from part A is a fixed contract. Therefore, I added extra fields like favoriteDish, isFavorite, and tags only when the client asks with `?include=profile`, so the default GET calls stay the same six-key shape and do not pick up the new fields.

I also kept Restaurant and RestaurantProfile as separate types so the extra fields cannot leak into Part A. The new columns are live on restaurants, and I did not store spending totals anywhere so they get computed when you ask for them. Spending insights is one endpoint, two aggregate queries, and is recomputed per request.

I had more ideas I wanted to implement, but I ruled out features such as recipe prediction, AI integration, and external APIs, because I didn't have time. I wanted to prioritize working features, so I left budgets, maps, photos, and a chart library to be done if I were to continue. Also, instead of making an affordability score, which varies heavily by people's budgets and spending habits, I just decided on showing pure numbers like "$42.50 typical, another visit brings September to $62.50, a 213% increase". The tradeoff I am not sure I got right is putting the extra fields behind ?include=profile on the existing restaurants route instead of making a separate profile endpoint. I guess I picked the query param so I would not add another resource.

## 3. Where did you cut corners?

Currently, the Metadata is a create-only, which means it's just a proof of concept
and there are not edits I could make to the restaurant data created. The `PUT`
method is available but it's more of a full-replacement rather than editing tags.
Therefore, I would need to add the ability to edit, delete, and modify the
restaurants and their associated descriptions.

---

## Part B: routes

| Method and path                        | What it does                                              | Success                    | Errors                                                   |
| -------------------------------------- | --------------------------------------------------------- | -------------------------- | -------------------------------------------------------- |
| `POST /api/visits`                     | Log a completed visit                                     | `201` + created visit      | `404` unknown `restaurantId`, and `400` if invalid body  |
| `GET /api/visits?month=YYYY-MM`        | That month's visits+derived spending total                | `200` + visits and summary | `400` if `month` is missing or malformed                 |
| `GET /api/restaurants?include=profile` | The restaurant collection **plus** personalization        | `200` + JSON array         | `400` if `include` is present and isn't `profile`        |
| `POST /api/restaurants`                | Create, now also accepting optional personalization       | `201` + created restaurant | `400` on invalid body **or invalid metadata**            |
| `GET /api/spending/insights?month=`    | Month snapshot+every restaurant's all-time visit history  | `200` + insights           | `400` if `month` is missing or malformed                 |

### `GET /api/restaurants?include=profile`

Without the parameter this route returns **exactly** the Part A array - same six
keys, same order of keys, nothing appended. `include=profile` opts in to three
more:

```jsonc
// 200 response
[
  {
    "id": 1,
    "name": "The Rusty Spoon",
    "cuisine": "American",
    "address": "12 Main St",
    "rating": 4.5,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "favoriteDish": "Hot chicken sandwich",
    "isFavorite": true,
    "tags": ["quick-bite", "worth-the-splurge"]
  }
]
```
An unrecognised value (`?include=profiles`) is a `400`.

### `POST /api/restaurants` (extended)

The three metadata fields are **optional on every request** and always
validated. Omitting them stores the column defaults, so a Part A body behaves
exactly as it did before. The *response* defaults to the Part A shape;
`?include=profile` returns the enriched record instead.

```jsonc
// request to POST /api/restaurants?include=profile
{
  "name": "Ledger Test Kitchen",
  "cuisine": "Korean",
  "address": "77 Ledger Ln",
  "rating": 4.4,
  "favoriteDish": "Bibimbap",
  "isFavorite": true,
  "tags": ["quick-bite", "healthy"]
}

// 201 response
{
  "id": 16,
  "name": "Ledger Test Kitchen",
  "cuisine": "Korean",
  "address": "77 Ledger Ln",
  "rating": 4.4,
  "createdAt": "2026-09-09T18:34:02.118Z",
  "favoriteDish": "Bibimbap",
  "isFavorite": true,
  "tags": ["quick-bite", "healthy"]
}
```

Validation rules for the new fields (the Part A rules are unchanged):

- `favoriteDish` - optional string or `null`, trimmed, max **120** characters.
  Whitespace-only becomes `null`.
- `isFavorite` - optional strict boolean. `"true"`, `1`, and `"on"` are all
  `400`; guessing what a caller meant by a non-boolean is how bad data gets in.
- `tags` - optional array drawn from a **closed vocabulary**: `quick-bite`,
  `date-night`, `group-friendly`, `late-night`, `healthy`, `worth-the-splurge`.
  Unknown values, duplicates, and more than **3** tags are each a `400`. Unknown
  tags are rejected rather than dropped, so the response can't disagree with the
  request. Cuisine is *not* a tag - it stays its own structured column.

Invalid fixed fields and invalid metadata are collected into **one** `400` so a
bad body doesn't have to be fixed one round trip at a time:

```jsonc
// POST {"name":12,"rating":6,"favoriteDish":5,"isFavorite":"x","tags":["nope"]}
{
  "error": "Validation failed",
  "details": [
    "name must be a string",
    "rating must be a number between 0 and 5",
    "favoriteDish must be a string or null",
    "isFavorite must be a boolean",
    "tags may only contain quick-bite, date-night, group-friendly, late-night, healthy, worth-the-splurge (got nope)"
  ]
}
```

### `GET /api/spending/insights?month=YYYY-MM`

`month` is **required** and validated by the same `parseMonthKey` the visit
ledger uses, so both endpoints answer a bad month identically.

```jsonc
// 200 response
{
  "month": "2026-02",
  "current":  { "totalAmountCents": 8800, "visitCount": 1, "averageVisitCents": 8800 },
  "previous": { "totalAmountCents": 4250, "visitCount": 1, "averageVisitCents": 4250 },
  "comparison": { "amountDeltaCents": 4550, "percentDelta": 107.06 },
  "restaurants": [
    {
      "restaurantId": 1,
      "visitCount": 1,
      "averageVisitCents": 4250,
      "totalAmountCents": 4250,
      "lastVisitDate": "2026-01-12",
      "lastAmountCents": 4250
    }
  ]
}
```

- Every monetary value is **integer cents**. `SUM(NUMERIC)` comes back from `pg`
  as a string and goes through the same `centsFromNumericString` the visit
  ledger uses, so no float ever touches a total.
- `current` and `previous` are half-open month ranges over the bare `date`
  column, bucketed by one `GROUP BY` in a single query.
- `percentDelta` is **`null`** when the previous total is zero - there is no
  baseline, and both `0/0` and `x/0` would put `NaN` or `Infinity` in the body.
  The UI prints `No previous-month baseline` for that case.
- `averageVisitCents` is `null`, never `0`, when there is nothing to average.
  The denominator is the count of visits that actually carry an amount, because
  `visits."amountSpent"` is nullable and an unpriced visit shouldn't drag an
  average toward zero.
- `restaurants[]` is **all-time**, not the selected month. "What a visit here
  usually costs" is a question one month of data answers badly. It is ordered by
  `restaurantId` and **only contains restaurants that have been visited** - a
  restaurant with no history is absent rather than zero-filled, so the UI can say
  "No visits yet" instead of inventing an average.


## Schema changes

One new migration: **`client/db/migrations/002_add_restaurant_metadata.sql`**.

```sql
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS "favoriteDish" TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS "isFavorite" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
```

- `001_create_tables.sql` is **untouched**, and `db/seed.ts` and the seed data
  are **unchanged**.
- The runner has no ledger and replays every file on every run, so all three
  statements are `ADD COLUMN IF NOT EXISTS` - a no-op the second time. Nothing
  backfills or rewrites an existing row; the defaults only apply going forward.
  `NOT NULL DEFAULT` is safe to add on Postgres 11+ without a table rewrite.
- Naming follows 001: quoted camelCase for columns the API speaks
  (`"restaurantId"`, `"amountSpent"`), snake_case reserved for `created_at`.
- `TEXT[]` rather than a tags table: the vocabulary is closed and defined in
  `lib/validation.ts`, never user-defined, so there is nothing to normalize and
  no join to pay for. If tags ever became user-defined this would need to become
  a real table.


## How I verified this
I added an error handler in [client/lib/errors.ts](client/lib/errors.ts) with details,
so that I would be able to review and verify the origin and reason for the errors
for better debugging.

Aside from agents and API/parameter calls , I also utilized screenshots and local session
on port 3000 to audit whether everything was running.


## Known issues / what I'd do next
- There are many logics I have to deal with in terms of spending average and history,
as simple as deleting a restaurant also delting its spending history and changing
the monthly spending logs.
- As mentioned on the first section of the writeup, I need to create replacement
semantics for the metadata edit and deletion.
- The insights were recomputed every time an item is added, which is pretty
inefficient in the long run.
- The tags are hard-coded and the vocabularies such as types of cousines are
not user-definable. In other categories as well, just allowing the user to
create their own elements and tags would make it a better feature.
- Including external API calls and features that other food rating or review
apps utilize would make the UX better and more reasonable for people to use.
