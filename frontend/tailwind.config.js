/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        coffee: {
          50: '#faf6f1',
          100: '#f1e8db',
          200: '#e2cfb3',
          400: '#b88c5a',
          600: '#8b5a2b',
          800: '#4a2e16',
          900: '#2d1c0d'
        },
        court: {
          500: '#3aa56a',
          600: '#2c8553'
        }
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}
