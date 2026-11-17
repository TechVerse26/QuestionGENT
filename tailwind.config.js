const c = (n) => `rgb(var(--c-${n}) / <alpha-value>)`;
const names = ['bg', 'surface', 'surface2', 'line', 'ink', 'muted', 'brand', 'brand-ink', 'brand-soft', 'side', 'side-ink', 'danger', 'danger-soft', 'warn', 'warn-soft', 'info', 'info-soft'];

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: Object.fromEntries(names.map((n) => [n, c(n)])),
      fontFamily: {
        sans: ['"Hind Siliguri"', '"Noto Sans Bengali"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      // Flat design: one small radius, no shadows anywhere.
      borderRadius: { none: '0', sm: '3px', DEFAULT: '5px', md: '5px', lg: '6px', xl: '6px', '2xl': '6px', full: '9999px' },
      boxShadow: { sm: 'none', DEFAULT: 'none', md: 'none', lg: 'none', xl: 'none', '2xl': 'none', inner: 'none' },
    },
  },
  plugins: [],
};
