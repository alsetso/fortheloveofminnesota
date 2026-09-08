import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  // Selector-based dark mode — matches web app convention.
  // Use dark: prefix wherever UI components need explicit dark overrides.
  darkMode: ['variant', '&:where([data-theme="dark"] *):not(:where([data-theme="light"] *))'],
  theme: {
    extend: {
      colors: {
        foreground: {
          DEFAULT: 'rgb(var(--foreground) / <alpha-value>)',
          muted: 'rgb(var(--foreground-muted))',
        },
        'lake-blue': 'rgb(var(--lake-blue) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};

export default config;
