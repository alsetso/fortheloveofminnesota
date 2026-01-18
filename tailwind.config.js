/** @type {import('tailwindcss').Config} */
module.exports = {
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
        accent: {
          DEFAULT: '#014463',
          blue: '#014463',
          'blue-dark': '#013347',
          'blue-hover': '#013347',
          'blue-light': '#1dd1f5',
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
