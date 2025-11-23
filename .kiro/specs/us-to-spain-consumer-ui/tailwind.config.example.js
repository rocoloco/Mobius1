/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary - Teal
        primary: {
          DEFAULT: '#008B8B',
          50: '#E6F7F7',
          100: '#CCEFEF',
          200: '#99DFDF',
          300: '#66CFCF',
          400: '#33BFBF',
          500: '#008B8B',
          600: '#007070',
          700: '#005454',
          800: '#003838',
          900: '#001C1C',
        },
        // Accent - Coral
        accent: {
          DEFAULT: '#FF7F50',
          50: '#FFF4F0',
          100: '#FFE9E1',
          200: '#FFD3C3',
          300: '#FFBDA5',
          400: '#FFA787',
          500: '#FF7F50',
          600: '#E6653A',
          700: '#CC4B24',
          800: '#B3310E',
          900: '#991700',
        },
        // Secondary - Sandy Brown
        secondary: {
          DEFAULT: '#F4A460',
          50: '#FEF8F2',
          100: '#FDF1E5',
          200: '#FBE3CB',
          300: '#F9D5B1',
          400: '#F7C797',
          500: '#F4A460',
          600: '#F08A3D',
          700: '#EC701A',
          800: '#C95A0F',
          900: '#A64A0C',
        },
        // Neutral - Charcoal
        neutral: {
          DEFAULT: '#2F4F4F',
          50: '#F8F9F9',
          100: '#E8EBEB',
          200: '#D1D7D7',
          300: '#BAC3C3',
          400: '#A3AFAF',
          500: '#8C9B9B',
          600: '#758787',
          700: '#5E7373',
          800: '#475F5F',
          900: '#2F4F4F',
        },
        // Cream - Cornsilk
        cream: {
          DEFAULT: '#FFF8DC',
          50: '#FFFFFF',
          100: '#FFFEF9',
          200: '#FFFCF3',
          300: '#FFFAED',
          400: '#FFF9E7',
          500: '#FFF8DC',
          600: '#FFE9A3',
          700: '#FFDA6A',
          800: '#FFCB31',
          900: '#F7BC00',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Georgia', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.4' }],      // 12px
        sm: ['0.875rem', { lineHeight: '1.5' }],     // 14px
        base: ['1rem', { lineHeight: '1.5' }],       // 16px
        lg: ['1.125rem', { lineHeight: '1.6' }],     // 18px
        xl: ['1.25rem', { lineHeight: '1.4' }],      // 20px
        '2xl': ['1.5rem', { lineHeight: '1.4' }],    // 24px
        '3xl': ['1.875rem', { lineHeight: '1.3' }],  // 30px
        '4xl': ['2.25rem', { lineHeight: '1.2' }],   // 36px
        '5xl': ['3rem', { lineHeight: '1.1' }],      // 48px
        '6xl': ['3.75rem', { lineHeight: '1' }],     // 60px
      },
      spacing: {
        0: '0px',
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '20px',
        6: '24px',
        8: '32px',
        10: '40px',
        12: '48px',
        16: '64px',
        20: '80px',
        24: '96px',
        32: '128px',
      },
      borderRadius: {
        none: '0',
        sm: '0.125rem',   // 2px
        DEFAULT: '0.25rem', // 4px
        md: '0.375rem',   // 6px
        lg: '0.5rem',     // 8px
        xl: '0.75rem',    // 12px
        '2xl': '1rem',    // 16px
        '3xl': '1.5rem',  // 24px
        full: '9999px',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
        none: 'none',
      },
      transitionDuration: {
        75: '75ms',
        100: '100ms',
        150: '150ms',
        200: '200ms',
        300: '300ms',
        500: '500ms',
        700: '700ms',
        1000: '1000ms',
      },
      transitionTimingFunction: {
        linear: 'linear',
        in: 'cubic-bezier(0.4, 0, 1, 1)',
        out: 'cubic-bezier(0, 0, 0.2, 1)',
        'in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px',
      },
    },
  },
  plugins: [],
}
