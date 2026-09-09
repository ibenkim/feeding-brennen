'use client';

import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import type { RestaurantProfile, RestaurantSpending } from '@/lib/types';
import { AddRestaurantForm } from './AddRestaurantForm';
import { RestaurantCard } from './RestaurantCard';

/**
 * The restaurant grid and the one action that changes it.
 *
 * Both props arrive from the page's two collection-level API calls - the
 * enriched restaurant list and the spending insights - so a grid of twenty
 * cards still costs two requests, not forty. The lookup below joins them by id
 * once instead of scanning the spending array per card.
 *
 * After a restaurant is created this calls `router.refresh()` rather than
 * appending to local state: the server component re-runs its `no-store` fetches
 * and the grid re-renders from what the API actually holds.
 */
export function RestaurantLibrary({
  restaurants,
  spending,
  monthTotalCents,
  month,
}: {
  restaurants: RestaurantProfile[];
  spending: RestaurantSpending[];
  monthTotalCents: number;
  month: string;
}) {
  const router = useRouter();

  const spendingByRestaurant = useMemo(
    () => new Map(spending.map((entry) => [entry.restaurantId, entry])),
    [spending]
  );

  return (
    <section aria-labelledby="library-heading">
      <h2
        id="library-heading"
        className="font-display text-xl font-semibold text-espresso"
      >
        Restaurant Library
      </h2>
      <p className="mt-0.5 text-sm text-clay">
        {restaurants.length} {restaurants.length === 1 ? 'restaurant' : 'restaurants'}{' '}
        on the shelf. Open Details on a card for its Quick View.
      </p>

      {/* Full width rather than tucked beside the heading: when the panel opens
          it needs the whole column, and a narrow form is a cramped form. */}
      <div className="mb-6 mt-4">
        <AddRestaurantForm onCreated={() => router.refresh()} />
      </div>

      {restaurants.length === 0 ? (
        <p className="rounded-card border border-dashed border-rule-strong bg-parchment/60 p-8 text-center text-sm text-clay">
          No restaurants yet. Add the first one to start the ledger.
        </p>
      ) : (
        <div className="grid items-start gap-4 sm:grid-cols-2">
          {restaurants.map((restaurant) => (
            <RestaurantCard
              key={restaurant.id}
              restaurant={restaurant}
              spending={spendingByRestaurant.get(restaurant.id)}
              monthTotalCents={monthTotalCents}
              month={month}
            />
          ))}
        </div>
      )}
    </section>
  );
}
