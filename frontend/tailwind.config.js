/** @type {import('tailwindcss').Config} */
function withOpacity(varName) {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) {
      return `rgb(var(${varName}) / ${opacityValue})`
    }
    return `rgb(var(${varName}))`
  }
}

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        /* Brand scale */
        brand: {
          50: withOpacity('--color-brand-50'),
          100: withOpacity('--color-brand-100'),
          200: withOpacity('--color-brand-200'),
          300: withOpacity('--color-brand-300'),
          400: withOpacity('--color-brand-400'),
          500: withOpacity('--color-brand-500'),
          600: withOpacity('--color-brand-600'),
          700: withOpacity('--color-brand-700'),
          800: withOpacity('--color-brand-800'),
          900: withOpacity('--color-brand-900')
        },

        /* Text */
        primary: withOpacity('--color-text-primary'),
        secondary: withOpacity('--color-text-secondary'),
        muted: withOpacity('--color-text-muted'),
        inverse: withOpacity('--color-text-inverse'),
        'on-brand': withOpacity('--color-text-on-brand'),

        /* Background */
        bg: withOpacity('--color-bg-primary'),
        'bg-alt': withOpacity('--color-bg-secondary'),
        surface: withOpacity('--color-bg-surface'),
        'surface-alt': withOpacity('--color-bg-surface-alt'),
        'bg-brand': withOpacity('--color-bg-brand'),

        /* Interactive */
        interactive: withOpacity('--color-interactive'),
        'interactive-hover': withOpacity('--color-interactive-hover'),
        'interactive-pressed': withOpacity('--color-interactive-pressed'),
        'interactive-secondary': withOpacity('--color-interactive-secondary'),
        accent: withOpacity('--color-interactive-accent'),
        disabled: withOpacity('--color-interactive-disabled'),

        /* Border */
        border: withOpacity('--color-border'),
        'border-strong': withOpacity('--color-border-strong'),
        'border-subtle': withOpacity('--color-border-subtle'),
        'border-focus': withOpacity('--color-border-focus'),

        /* Status */
        success: withOpacity('--color-success'),
        warning: withOpacity('--color-warning'),
        'warning-subtle': withOpacity('--color-warning-subtle'),
        'warning-muted': withOpacity('--color-warning-muted'),
        error: withOpacity('--color-error'),
        'error-subtle': withOpacity('--color-error-subtle'),
        info: withOpacity('--color-info'),

        /* Skill levels */
        'skill-beginner': withOpacity('--color-skill-beginner'),
        'skill-intermediate': withOpacity('--color-skill-intermediate'),
        'skill-advanced': withOpacity('--color-skill-advanced'),

        /* Legacy aliases for components that reference heading/text/tertiary */
        heading: withOpacity('--color-text-primary'),
        text: withOpacity('--color-text-primary'),
        tertiary: withOpacity('--color-error'),
        'accent-alt': withOpacity('--color-text-secondary'),
        'secondary-dark': withOpacity('--color-interactive-hover'),
        'border-muted': withOpacity('--color-border-subtle')
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}
