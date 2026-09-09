import type { Config } from 'tailwindcss';

/**
 * The Warm Dining Ledger palette: a restaurant journal, not a dashboard.
 *
 * Two tones exist for each accent because the same hue can't do both jobs. The
 * base tone is for fills and rules, where it only has to be visible; the `ink`
 * tone is the darkened version used for *text*, chosen so every label clears
 * 4.5:1 against the cream page and the off-white card. Reach for `tomato` on a
 * border and `tomato-ink` on a word.
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: '#F7F2E8', // page
        parchment: '#FFFDF8', // card
        espresso: '#2B211C', // primary text
        clay: '#6B5D54', // secondary text - 5.6:1 on cream
        rule: '#E3D9C8', // hairline border
        'rule-strong': '#D6C9B4', // section divider

        tomato: '#D85C3F', // primary accent
        'tomato-ink': '#B8462B', // 5.3:1 on parchment
        'tomato-deep': '#C24A2E', // button fill, 4.9:1 against white

        olive: '#71805A', // secondary accent
        'olive-ink': '#55613F', // 6.0:1 on cream

        gold: '#C89B45', // favorite accent
        'gold-ink': '#8A6A22', // 4.9:1 on parchment
      },
      fontFamily: {
        // Local and system faces only - no webfont is loaded for this design.
        display: [
          'Iowan Old Style',
          'Palatino Linotype',
          'Palatino',
          'Georgia',
          'ui-serif',
          'serif',
        ],
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        card: '0.75rem',
      },
      boxShadow: {
        // Warm and shallow. A card sits on the page, it doesn't hover over it.
        card: '0 1px 2px rgba(43, 33, 28, 0.04), 0 1px 8px rgba(43, 33, 28, 0.04)',
        'card-raised':
          '0 2px 4px rgba(43, 33, 28, 0.06), 0 6px 16px rgba(43, 33, 28, 0.07)',
      },
    },
  },
  plugins: [],
};

export default config;
