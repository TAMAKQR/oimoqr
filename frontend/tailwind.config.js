/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Grab color palette
        grab: {
          50: '#e6f7f1',
          100: '#b3e8d6',
          200: '#80d9bb',
          300: '#4dcaa0',
          400: '#1abb85',
          500: '#00b14f', // Main Grab green
          600: '#009e47',
          700: '#008a3f',
          800: '#007737',
          900: '#00642f',
        },
        primary: {
          50: '#e6f7f1',
          100: '#b3e8d6',
          200: '#80d9bb',
          300: '#4dcaa0',
          400: '#1abb85',
          500: '#00b14f',
          600: '#009e47',
          700: '#008a3f',
          800: '#007737',
          900: '#00642f',
        },
        // Grab secondary colors
        grabOrange: '#ff7a00',
        grabRed: '#ff3b30',
        grabYellow: '#ffc107',
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