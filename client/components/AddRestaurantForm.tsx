'use client';

import { useRef, useState } from 'react';
import { ApiRequestError, createRestaurant } from '@/lib/apiClient';
import { formatTag } from '@/lib/format';
import {
  MAX_RESTAURANT_TAGS,
  RESTAURANT_TAGS,
  type RestaurantTag,
} from '@/lib/types';

/**
 * Add a restaurant, with the optional personalization the library cards show.
 *
 * A disclosure rather than a modal: it needs no focus trap, no scroll lock and
 * no portal, and on a phone it is simply the next thing down the page. The
 * heavier pattern would have bought nothing here.
 *
 * The form POSTs to `/api/restaurants?include=profile` and hands the created
 * record back to its parent, which re-fetches the API-backed list. It does not
 * splice the new row into local state - the list on screen stays a view of what
 * the server actually stored.
 */

type Failure = { message: string; details: string[] };

const EMPTY = {
  name: '',
  cuisine: '',
  address: '',
  rating: '',
  favoriteDish: '',
};

export function AddRestaurantForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState(EMPTY);
  const [isFavorite, setIsFavorite] = useState(false);
  const [tags, setTags] = useState<RestaurantTag[]>([]);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const ratingRef = useRef<HTMLInputElement>(null);

  function set(field: keyof typeof EMPTY, value: string) {
    setFields((current) => ({ ...current, [field]: value }));
  }

  function reset() {
    setFields(EMPTY);
    setIsFavorite(false);
    setTags([]);
    setFailure(null);
  }

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    setCreated(null);
    if (next) {
      // Send the caret where they meant to go, without stealing focus on load.
      requestAnimationFrame(() => nameRef.current?.focus());
    } else {
      reset();
    }
  }

  function toggleTag(tag: RestaurantTag) {
    setTags((current) =>
      current.includes(tag)
        ? current.filter((t) => t !== tag)
        : current.length < MAX_RESTAURANT_TAGS
          ? [...current, tag]
          : current
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return; // A double-click can't produce two restaurants.

    setFailure(null);
    setCreated(null);

    const name = fields.name.trim();
    if (name === '') {
      setFailure({ message: 'Give the restaurant a name.', details: [] });
      nameRef.current?.focus();
      return;
    }

    let rating: number | null = null;
    if (fields.rating.trim() !== '') {
      const parsed = Number(fields.rating);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 5) {
        setFailure({ message: 'Rating must be a number between 0 and 5.', details: [] });
        ratingRef.current?.focus();
        return;
      }
      rating = parsed;
    }

    setPending(true);
    try {
      const restaurant = await createRestaurant({
        name,
        cuisine: fields.cuisine.trim() === '' ? null : fields.cuisine.trim(),
        address: fields.address.trim() === '' ? null : fields.address.trim(),
        rating,
        favoriteDish:
          fields.favoriteDish.trim() === '' ? null : fields.favoriteDish.trim(),
        isFavorite,
        tags,
      });

      reset();
      setOpen(false);
      setCreated(restaurant.name);
      onCreated();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setFailure({ message: err.message, details: err.details });
      } else {
        setFailure({
          message: 'Could not reach the API. Is the dev server still running?',
          details: [],
        });
      }
    } finally {
      setPending(false);
    }
  }

  const inputClass =
    'w-full rounded border border-rule bg-parchment px-2.5 py-1.5 text-sm text-espresso placeholder:text-clay/60 disabled:opacity-60';
  const labelClass =
    'mb-1 block text-xs font-medium uppercase tracking-wider text-clay';

  return (
    <div>
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-controls="add-restaurant-panel"
        className="rounded bg-tomato-deep px-3.5 py-2 text-sm font-medium text-white shadow-card motion-safe:transition-colors hover:bg-tomato-ink"
      >
        {open ? 'Cancel' : 'Add Restaurant'}
      </button>

      {/* Success is announced where the button was pressed, not only by the
          list quietly growing further down the page. */}
      {created && !open && (
        <p role="status" className="mt-3 text-sm font-medium text-olive-ink">
          Added {created} to your library.
        </p>
      )}

      {open && (
        <form
          id="add-restaurant-panel"
          onSubmit={handleSubmit}
          // `noValidate` turns off the browser's own validation bubbles so every
          // rejection - client-side or from the API - lands in the same
          // `role="alert"` box below, styled like the rest of the app and
          // announced once. The `required`, `min`, and `max` attributes stay for
          // their semantics; only the popup is suppressed.
          noValidate
          className="mt-4 space-y-4 rounded-card border border-rule bg-parchment p-5 shadow-card"
        >
          <h3 className="font-display text-lg font-semibold text-espresso">
            Add a restaurant
          </h3>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              <span className={labelClass}>
                Name <span className="text-tomato-ink">(required)</span>
              </span>
              <input
                ref={nameRef}
                type="text"
                value={fields.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="The Rusty Spoon"
                className={inputClass}
                disabled={pending}
                required
              />
            </label>

            <label className="text-sm">
              <span className={labelClass}>Cuisine</span>
              <input
                type="text"
                value={fields.cuisine}
                onChange={(e) => set('cuisine', e.target.value)}
                placeholder="American"
                className={inputClass}
                disabled={pending}
              />
            </label>

            <label className="text-sm">
              <span className={labelClass}>Rating (0–5)</span>
              <input
                ref={ratingRef}
                type="number"
                inputMode="decimal"
                min={0}
                max={5}
                step={0.1}
                value={fields.rating}
                onChange={(e) => set('rating', e.target.value)}
                placeholder="4.5"
                className={inputClass}
                disabled={pending}
              />
            </label>

            <label className="text-sm sm:col-span-2">
              <span className={labelClass}>Address</span>
              <input
                type="text"
                value={fields.address}
                onChange={(e) => set('address', e.target.value)}
                placeholder="12 Main St"
                className={inputClass}
                disabled={pending}
              />
            </label>

            <label className="text-sm sm:col-span-2">
              <span className={labelClass}>Favorite dish</span>
              <input
                type="text"
                value={fields.favoriteDish}
                onChange={(e) => set('favoriteDish', e.target.value)}
                placeholder="Hot chicken sandwich"
                maxLength={120}
                className={inputClass}
                disabled={pending}
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-espresso">
            <input
              type="checkbox"
              checked={isFavorite}
              onChange={(e) => setIsFavorite(e.target.checked)}
              disabled={pending}
              className="h-4 w-4 accent-gold-ink"
            />
            Mark as a favorite
          </label>

          <fieldset disabled={pending}>
            <legend className={labelClass}>
              Context tags (up to {MAX_RESTAURANT_TAGS})
            </legend>
            <div className="flex flex-wrap gap-2">
              {RESTAURANT_TAGS.map((tag) => {
                const checked = tags.includes(tag);
                const atLimit = !checked && tags.length >= MAX_RESTAURANT_TAGS;
                return (
                  <label
                    key={tag}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${
                      checked
                        ? 'border-olive bg-olive/10 font-medium text-olive-ink'
                        : 'border-rule text-clay'
                    } ${atLimit ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={atLimit}
                      onChange={() => toggleTag(tag)}
                      className="h-3.5 w-3.5 accent-olive-ink"
                    />
                    {formatTag(tag)}
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-clay">
              {tags.length} of {MAX_RESTAURANT_TAGS} selected. Cuisine is its own
              field above.
            </p>
          </fieldset>

          {failure && (
            <div
              role="alert"
              className="rounded border border-tomato/40 bg-tomato/5 p-3 text-sm text-tomato-ink"
            >
              <p className="font-medium">{failure.message}</p>
              {failure.details.length > 0 && (
                <ul className="mt-1 list-inside list-disc">
                  {failure.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded bg-tomato-deep px-3.5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? 'Saving…' : 'Save restaurant'}
            </button>
            <button
              type="button"
              onClick={toggleOpen}
              disabled={pending}
              className="rounded px-2 py-2 text-sm font-medium text-clay hover:text-espresso disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
