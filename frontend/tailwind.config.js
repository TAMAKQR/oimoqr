/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    // Dynamic business type colors
    'border-blue-500', 'bg-blue-50',
    'border-purple-500', 'bg-purple-50',
    'border-green-500', 'bg-green-50',
  ],
  theme: {
    extend: {
      colors: {
        // OimoQR brand palette — Steppe Indigo
        grab: {
          50: '#F0F2F7',
          100: '#D8DDE8',
          200: '#B4BECE',
          300: '#8E9DB4',
          400: '#6A7E9B',
          500: '#4B6282',
          600: '#374B6A',
          700: '#2A3A54',
          800: '#1F2B3F',
          900: '#141D2B',
        },
        primary: {
          50: 'var(--primary-50, #F0F2F7)',
          100: 'var(--primary-100, #D8DDE8)',
          200: 'var(--primary-200, #B4BECE)',
          300: 'var(--primary-300, #8E9DB4)',
          400: 'var(--primary-400, #6A7E9B)',
          500: 'var(--primary-500, #4B6282)',
          600: 'var(--primary-600, #374B6A)',
          700: 'var(--primary-700, #2A3A54)',
          800: 'var(--primary-800, #1F2B3F)',
          900: 'var(--primary-900, #141D2B)',
        },
        // Accent colors
        accent: '#C4943D',
      },
      borderRadius: {
        'grab': '16px',
        'grab-lg': '24px',
      },
      boxShadow: {
        'grab': '0 2px 8px rgba(0, 0, 0, 0.08)',
        'grab-lg': '0 4px 16px rgba(0, 0, 0, 0.12)',
      },
      keyframes: {
        'spin-once': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      },
      animation: {
        'spin-once': 'spin-once 0.6s ease-in-out',
        'slide-up': 'slide-up 0.3s ease-out',
      }
    },
  },
  plugins: [],
}