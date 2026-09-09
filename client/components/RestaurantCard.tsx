'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import {
  formatCents,
  formatMonth,
  formatRating,
  formatTag,
  formatVisitDate,
} from '@/lib/format';
import type { RestaurantProfile, RestaurantSpending } from '@/lib/types';

/**
 * One restaurant in the library. Its Quick View opens only from this card's
 * Details button, so hovering or focusing a neighbour cannot expand it.
 *
 * Nothing here is estimated except Spend Impact, and that is arithmetic on the
 * restaurant's own visit history, shown with the numbers it came from.
 */

/**
 * What another typical visit would do to the month.
 *
 * Deliberately not called affordability: the app knows what Brennen spent, and
 * nothing at all about what he can afford.
 */
function spendImpact(
  spending: RestaurantSpending | undefined,
  monthTotalCents: number,
  month: string
): { headline: string; detail: string } | null {
  if (!spending || spending.averageVisitCents === null) {
    return null;
  }

  const typical = spending.averageVisitCents;
  const typicalSentence = `A typical visit here costs ${formatCents(typical)}.`;

  if (monthTotalCents === 0) {
    return {
      headline: typicalSentence,
      detail: 'This would be your first tracked spending this month.',
    };
  }

  const projected = monthTotalCents + typical;
  const percent = Math.round((typical / monthTotalCents) * 100);

  return {
    headline: typicalSentence,
    detail: `Another visit would bring ${formatMonth(month)} to ${formatCents(
      projected
    )}, a ${percent}% increase.`,
  };
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <dt className="text-xs uppercase tracking-wider text-clay">{label}</dt>
      <dd className="tabular text-right text-sm text-espresso">{value}</dd>
    </div>
  );
}

export function RestaurantCard({
  restaurant,
  spending,
  monthTotalCents,
  month,
}: {
  restaurant: RestaurantProfile;
  spending: RestaurantSpending | undefined;
  monthTotalCents: number;
  month: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  const rating = formatRating(restaurant.rating);
  const impact = spendImpact(spending, monthTotalCents, month);

  return (
    <article
      className={`flex flex-col rounded-card border border-rule bg-parchment p-5 motion-safe:transition-shadow ${
        expanded ? 'shadow-card-raised' : 'shadow-card'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg font-semibold leading-snug text-espresso">
          {restaurant.name}
        </h3>
        {rating && (
          <span className="tabular shrink-0 text-sm text-clay">
            {rating}
            <span aria-hidden="true"> ★</span>
            <span className="sr-only"> out of 5</span>
          </span>
        )}
      </div>

      <p className="mt-1 text-sm text-clay">
        {restaurant.cuisine ?? 'Cuisine not recorded'}
      </p>

      {/* The favorite mark carries a word as well as a colour and a glyph. */}
      {restaurant.isFavorite && (
        <p className="mt-2 text-sm font-medium text-gold-ink">
          <span aria-hidden="true">★ </span>Favorite
        </p>
      )}

      {restaurant.tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {restaurant.tags.map((tag) => (
            <li
              key={tag}
              className="rounded-full border border-olive/40 bg-olive/10 px-2.5 py-0.5 text-xs font-medium text-olive-ink"
            >
              {formatTag(tag)}
            </li>
          ))}
        </ul>
      )}

      {/* Three honest states, and no fourth one that invents a number: a
          restaurant can have no visits, visits with no recorded amount, or a
          real average. */}
      <p className="tabular mt-3 text-sm text-espresso">
        {!spending ? (
          <span className="text-clay">No visits yet</span>
        ) : spending.averageVisitCents === null ? (
          <span className="text-clay">
            {spending.visitCount} {spending.visitCount === 1 ? 'visit' : 'visits'}, no
            amounts recorded
          </span>
        ) : (
          <>
            Usually{' '}
            <span className="font-semibold">
              {formatCents(spending.averageVisitCents)}
            </span>{' '}
            a visit
          </>
        )}
      </p>
      {/* Same reserved line on every card so a visit history does not change
          collapsed height. Visit cards keep an empty slot, not invented copy. */}
      <p
        className={`mt-0.5 min-h-4 text-xs ${spending ? 'invisible' : 'text-clay'}`}
      >
        Log a visit to unlock a spending estimate.
      </p>

      {/* `mt-auto` pushes the control to the bottom of the card, so the row of
          Details buttons lines up however tall each card's summary runs. */}
      <div className="mt-auto flex justify-end pt-4">
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="rounded border border-rule px-2.5 py-1 text-xs font-medium text-espresso hover:bg-cream"
        >
          {expanded ? 'Hide details' : 'Details'}
          <span className="sr-only"> for {restaurant.name}</span>
        </button>
      </div>

      {expanded && (
        <div id={panelId} className="tear-rule mt-4 pt-3">
          <dl>
            <DetailRow
              label="Favorite dish"
              value={restaurant.favoriteDish ?? 'Not recorded'}
            />
            <DetailRow label="Address" value={restaurant.address ?? 'Not recorded'} />
            <DetailRow
              label="Last visit"
              value={
                spending ? formatVisitDate(spending.lastVisitDate) : 'No visits yet'
              }
            />
            <DetailRow
              label="Last amount"
              value={spending ? formatCents(spending.lastAmountCents) : '—'}
            />
            <DetailRow label="Total visits" value={String(spending?.visitCount ?? 0)} />
            <DetailRow
              label="Average per visit"
              value={
                spending && spending.averageVisitCents !== null
                  ? formatCents(spending.averageVisitCents)
                  : '—'
              }
            />
          </dl>

          <section
            aria-label={`Spend Impact for ${restaurant.name}`}
            className="mt-3 rounded border border-rule bg-cream/70 p-3"
          >
            <h4 className="text-xs font-semibold uppercase tracking-wider text-clay">
              Spend Impact
            </h4>
            {impact ? (
              <>
                <p className="tabular mt-1 text-sm text-espresso">{impact.headline}</p>
                <p className="tabular text-sm text-espresso">{impact.detail}</p>
                <p className="mt-1.5 text-xs italic text-clay">
                  Estimated from this restaurant&apos;s own visit history — not a
                  prediction or financial advice.
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-clay">
                {spending
                  ? 'No amounts recorded here yet, so there is nothing to estimate from.'
                  : 'Log a visit to unlock an estimate.'}
              </p>
            )}
          </section>

          <div className="mt-3 flex justify-end">
            <Link
              href={`/visits?restaurant=${restaurant.id}`}
              className="rounded bg-tomato-deep px-3 py-1.5 text-xs font-medium text-white hover:bg-tomato-ink"
            >
              Log Visit
              <span className="sr-only"> at {restaurant.name}</span>
            </Link>
          </div>
        </div>
      )}
    </article>
  );
}
