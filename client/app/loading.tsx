/**
 * Shown while the overview's API calls are in flight. Static placeholder blocks
 * rather than a spinner or a shimmer: nothing moves, so there is nothing for
 * `prefers-reduced-motion` to suppress.
 */
export default function Loading() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading your ledger…</span>

      <div className="mb-10 grid gap-3 sm:grid-cols-3" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="h-[86px] rounded-card border border-rule bg-parchment/70"
          />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="h-52 rounded-card border border-rule bg-parchment/70"
          />
        ))}
      </div>
    </div>
  );
}
