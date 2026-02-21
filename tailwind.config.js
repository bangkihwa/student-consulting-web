/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        rose: {
          50: '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
          900: '#881337',
          950: '#4c0519',
        },
        amber: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans KR"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-page': 'linear-gradient(180deg, #f8fafc 0%, #fff1f2 50%, #fff1f2 100%)',
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(136, 19, 55, 0.08), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        'glass-lg': '0 16px 48px rgba(136, 19, 55, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.08)',
        'card': '0 1px 3px rgba(136, 19, 55, 0.06), 0 4px 12px rgba(136, 19, 55, 0.04)',
        'card-hover': '0 4px 12px rgba(136, 19, 55, 0.1), 0 8px 24px rgba(136, 19, 55, 0.06)',
        'amber-glow': '0 4px 24px rgba(245, 158, 11, 0.25)',
        'nav': '0 1px 3px rgba(136, 19, 55, 0.05), 0 0 0 1px rgba(136, 19, 55, 0.03)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'fade-in-up': 'fadeInUp 0.6s ease-out',
        'fade-in-down': 'fadeInDown 0.4s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
}
