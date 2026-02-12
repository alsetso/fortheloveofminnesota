/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        'libre-baskerville': ['Libre Baskerville', 'serif'],
      },
      colors: {
        /* Semantic Design Tokens from CSS Variables */
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          muted: 'hsl(var(--surface-muted))',
          accent: 'hsl(var(--surface-accent))',
        },
        header: {
          DEFAULT: 'hsl(var(--header))',
          muted: 'hsl(var(--header-muted))',
        },
        'lake-blue': {
          DEFAULT: 'hsl(var(--lake-blue))',
          light: 'hsl(var(--lake-blue-light))',
        },
        'aurora-teal': {
          DEFAULT: 'hsl(var(--aurora-teal))',
          light: 'hsl(var(--aurora-teal-light))',
        },
        foreground: {
          DEFAULT: 'hsl(var(--foreground))',
          muted: 'hsl(var(--foreground-muted))',
          subtle: 'hsl(var(--foreground-subtle))',
        },
        border: {
          DEFAULT: 'hsl(var(--border))',
          muted: 'hsl(var(--border-muted))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          hover: 'hsl(var(--accent-hover))',
          light: 'hsl(var(--accent-light))',
        },
        /* Legacy colors maintained for backward compatibility */
        gold: {
          50: '#FAF8F4',
          100: '#F5F1E9',
          200: '#EBE3D3',
          300: '#E1D5BD',
          400: '#D7C7A7',
          500: '#C2B289',
          600: '#9F8E6E',
          700: '#7C6B53',
          800: '#594838',
          900: '#36251D',
        },
        black: '#222020',
        dark: {
          DEFAULT: '#242222',
          gray: '#242222',
        },
        'header-focus': {
          DEFAULT: '#2a2828',
          light: '#2d2b2b',
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    function({ addUtilities }) {
      addUtilities({
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            display: 'none'
          }
        }
      })
    }
  ],
}
