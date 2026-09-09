import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Feeding Brennen - your personal dining ledger',
  description: 'Remember the meal. Understand the spend.',
};

/**
 * The two-page shell. Navigation is deliberately two links: the overview
 * (restaurants and spending) and the visit ledger. Anything more would be
 * chrome for an app this size.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded focus:bg-parchment focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-espresso focus:shadow-card-raised"
        >
          Skip to content
        </a>

        <header className="border-b border-rule bg-parchment">
          <div className="mx-auto flex max-w-4xl flex-wrap items-end justify-between gap-x-8 gap-y-3 px-6 py-5">
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-espresso">
                Feeding Brennen
              </h1>
              <p className="mt-0.5 text-sm text-clay">Your personal dining ledger</p>
            </div>

            <nav aria-label="Main" className="flex items-center gap-1 text-sm">
              <Link
                href="/"
                className="rounded px-3 py-1.5 font-medium text-espresso hover:bg-cream"
              >
                Overview
              </Link>
              <Link
                href="/visits"
                className="rounded px-3 py-1.5 font-medium text-espresso hover:bg-cream"
              >
                Visits
              </Link>
            </nav>
          </div>
        </header>

        <main id="main" className="mx-auto max-w-4xl px-6 py-8">
          {children}
        </main>

        <footer className="mx-auto max-w-4xl px-6 pb-10">
          <p className="tear-rule pt-4 text-center font-display text-sm italic text-clay">
            Remember the meal. Understand the spend.
          </p>
        </footer>
      </body>
    </html>
  );
}
