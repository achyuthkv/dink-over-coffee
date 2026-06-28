/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        coffee: {
          50: '#F6F1E7',
          100: '#E6DCC6',
          200: '#C8C2B8',
          400: '#8C8A7D',
          600: '#4F6B4F',
          700: '#2B1F17',
          800: '#2B1F17',
          900: '#1C1C1C'
        },
        cream: '#F6F1E7',
        espresso: '#2B1F17',
        latte: '#E6DCC6',
        sage: '#4F6B4F',
        clay: '#C75A2B',
        stone: '#C8C2B8',
        charcoal: '#1C1C1C',
        warmgrey: '#8C8A7D',
        court: {
          500: '#4F6B4F',
          600: '#3d5440'
        }
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}
