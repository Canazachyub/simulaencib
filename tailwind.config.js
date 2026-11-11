/** @type {import('tailwindcss').Config} */
// Sistema de diseño "Terminal de estudio" (ver DESIGN.md, sección 9).
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Marca SINAPSIS
        jungle: { DEFAULT: '#10312D', 900: '#0B211F', 800: '#10312D', 700: '#174540', 600: '#1F5B52', 100: '#E3EEEC', 50: '#F1F7F5' },
        lime: { DEFAULT: '#C2E476', 300: '#D6EE9F', 400: '#C2E476', 500: '#AACF57' },
        // Neutros
        paper: '#F6F8F7',
        line: '#E2E8E6',
        ink: '#0F1A18',
        muted: '#51625E',
        subtle: '#8A9A96',
        // Estado (solo con significado)
        correct: { DEFAULT: '#16A34A', bg: '#DCFCE7' },
        wrong: { DEFAULT: '#DC2626', bg: '#FEE2E2' },
        warning: { DEFAULT: '#D97706', bg: '#FEF3C7' },
        info: '#2563EB',
        // Alias heredado: "primary" ahora apunta a la marca (jungle)
        primary: {
          50: '#F1F6F5',
          100: '#E3EEEC',
          200: '#C9DDD9',
          300: '#9DC0B9',
          400: '#5E8F86',
          500: '#1F5B52',
          600: '#10312D',
          700: '#0B211F',
          800: '#0B211F',
          900: '#0B211F',
        },
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: { card: '16px', control: '12px', chip: '8px', pill: '999px' },
      boxShadow: {
        // Igual que SinapsisEdu: solo sombras mínimas
        card: '0 1px 2px rgba(15, 26, 24, 0.04), 0 1px 3px rgba(15, 26, 24, 0.04)',
      },
      maxWidth: { terminal: '1040px' },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'q-in': 'qIn 150ms ease-out both',
        pick: 'pick 120ms ease-out',
        shake: 'shake 300ms ease-in-out',
        'slide-up': 'slideUp 220ms ease-out both',
        'slide-down': 'slideDown 200ms ease-out both',
        pop: 'pop 260ms ease-out both',
        'drawer-in': 'drawerIn 180ms ease-out both',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        qIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'none' },
        },
        pick: {
          '0%': { transform: 'scale(0.98)' },
          '100%': { transform: 'scale(1)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-6px)' },
          '40%, 80%': { transform: 'translateX(6px)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'none' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'none' },
        },
        pop: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.06)' },
          '100%': { transform: 'scale(1.03)' },
        },
        drawerIn: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'none' },
        },
      },
    },
  },
  plugins: [],
}
