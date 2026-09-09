import { formatCents, formatMonth, formatSignedCents } from '@/lib/format';
import type { SpendingInsights } from '@/lib/types';

/**
 * The month in three numbers, plus how it compares to the month before.
 *
 * Every value here comes from `GET /api/spending/insights` - this component
 * formats, it never calculates. The comparison is stated in words and signs
 * rather than colour alone, so it reads the same in greyscale.
 */

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-card border border-rule bg-parchment px-4 py-3 shadow-card">
      <dt className="text-xs font-medium uppercase tracking-wider text-clay">
        {label}
      </dt>
      <dd className="tabular mt-1 font-display text-2xl font-semibold text-espresso">
        {value}
      </dd>
      {hint && <p className="mt-0.5 text-xs text-clay">{hint}</p>}
    </div>
  );
}

/** "+21.9% more than last month" - only when a percentage means anything. */
function comparisonSentence(insights: SpendingInsights): string {
  const { amountDeltaCents, percentDelta } = insights.comparison;

  if (insights.previous.totalAmountCents === 0) {
    return 'No previous-month baseline';
  }

  const change = `${formatSignedCents(amountDeltaCents)} from last month`;
  if (percentDelta === null || percentDelta === 0) return change;

  const percent = `${percentDelta > 0 ? '+' : '−'}${Math.abs(percentDelta).toFixed(1)}%`;
  return `${change} (${percent})`;
}

export function SpendingSnapshot({
  month,
  insights,
}: {
  month: string;
  insights: SpendingInsights;
}) {
  const { current, previous } = insights;

  return (
    <section aria-labelledby="snapshot-heading" className="mb-10">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h2
            id="snapshot-heading"
            className="font-display text-xl font-semibold text-espresso"
          >
            Monthly Spending Snapshot
          </h2>
          <p className="mt-0.5 text-sm text-clay">{formatMonth(month)}</p>
        </div>

        {/* A plain GET form: the month lives in the URL, so this needs no JS
            and the view is shareable. Same pattern as /visits. */}
        <form method="get" action="/" className="flex items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-clay">
              Month
            </span>
            <input
              type="month"
              name="month"
              defaultValue={month}
              className="rounded border border-rule bg-parchment px-2 py-1.5 text-sm text-espresso"
            />
          </label>
          <button
            type="submit"
            className="rounded border border-rule bg-parchment px-3 py-1.5 text-sm font-medium text-espresso hover:bg-cream"
          >
            Show
          </button>
        </form>
      </div>

      <dl className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Total spent"
          value={formatCents(current.totalAmountCents)}
          hint={`${formatCents(previous.totalAmountCents)} the month before`}
        />
        <Stat
          label="Visits"
          value={String(current.visitCount)}
          hint={`${previous.visitCount} the month before`}
        />
        <Stat
          label="Average per visit"
          value={formatCents(current.averageVisitCents)}
          hint={
            current.averageVisitCents === null ? 'Nothing to average yet' : undefined
          }
        />
      </dl>

      <p className="tabular mt-3 text-sm text-clay">
        <span className="font-medium text-espresso">
          {comparisonSentence(insights)}
        </span>
        {current.visitCount === 0 && (
          <>
            {' · '}
            No visits logged in {formatMonth(month)} yet.
          </>
        )}
      </p>
    </section>
  );
}
