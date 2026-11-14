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
        // Semantic badges
        'bg-success-50', 'text-success-600', 'border-success-100',
        'bg-warning-50', 'text-warning-600', 'border-warning-100',
        'bg-error-50', 'text-error-600', 'border-error-100',
        'bg-info-50', 'text-info-600', 'border-info-100',
    ],
    theme: {
        container: {
            center: true,
            padding: {
                DEFAULT: '1rem',
                sm: '1.5rem',
                lg: '2rem',
                xl: '2.5rem',
            },
        },
        extend: {
            colors: {
                // OimoQR brand palette — Steppe Indigo (refined)
                oimo: {
                    50: '#F5F7FA',
                    100: '#E7EBF2',
                    200: '#CFD5E5',
                    300: '#AFBBD8',
                    400: '#8FA4C7',
                    500: '#6B83A8',
                    600: '#4B6282',
                    700: '#3A4E6A',
                    800: '#2A3A4F',
                    900: '#1A2332',
                },
                primary: {
                    50: 'var(--primary-50, #F5F7FA)',
                    100: 'var(--primary-100, #E7EBF2)',
                    200: 'var(--primary-200, #CFD5E5)',
                    300: 'var(--primary-300, #AFBBD8)',
                    400: 'var(--primary-400, #8FA4C7)',
                    500: 'var(--primary-500, #6B83A8)',
                    600: 'var(--primary-600, #4B6282)',
                    700: 'var(--primary-700, #3A4E6A)',
                    800: 'var(--primary-800, #2A3A4F)',
                    900: 'var(--primary-900, #1A2332)',
                },
                // Semantic colors
                success: {
                    50: '#F0FDF4',
                    100: '#DCFCE7',
                    500: '#22C55E',
                    600: '#16A34A',
                    900: '#14532D',
                },
                warning: {
                    50: '#FFFBEB',
                    100: '#FEF3C7',
                    500: '#F59E0B',
                    600: '#D97706',
                    900: '#78350F',
                },
                error: {
                    50: '#FEF2F2',
                    100: '#FEE2E2',
                    500: '#EF4444',
                    600: '#DC2626',
                    900: '#7F1D1D',
                },
                info: {
                    50: '#EFF6FF',
                    100: '#DBEAFE',
                    500: '#3B82F6',
                    600: '#2563EB',
                    900: '#1E3A8A',
                },
                // Neutral grays
                neutral: {
                    50: '#F9FAFB',
                    100: '#F3F4F6',
                    200: '#E5E7EB',
                    300: '#D1D5DB',
                    400: '#9CA3AF',
                    500: '#6B7280',
                    600: '#4B5563',
                    700: '#374151',
                    800: '#1F2937',
                    900: '#111827',
                },
                accent: '#C4943D',
            },
            borderRadius: {
                surface: '16px',
                panel: '20px',
                grab: '16px',
                'grab-lg': '24px',
            },
            boxShadow: {
                surface: '0 1px 2px rgb(24 35 51 / 0.04), 0 8px 24px rgb(24 35 51 / 0.05)',
                floating: '0 18px 50px rgb(24 35 51 / 0.18)',
                grab: '0 2px 8px rgb(24 35 51 / 0.08)',
                'grab-lg': '0 14px 40px rgb(24 35 51 / 0.12)',
            },
            spacing: {
                'xs': '0.5rem',
                'sm': '0.75rem',
                'md': '1rem',
                'lg': '1.5rem',
                'xl': '2rem',
                '2xl': '3rem',
            },
            fontSize: {
                'xs': ['0.75rem', { lineHeight: '1rem' }],
                'sm': ['0.875rem', { lineHeight: '1.25rem' }],
                'base': ['1rem', { lineHeight: '1.5rem' }],
                'lg': ['1.125rem', { lineHeight: '1.75rem' }],
                'xl': ['1.25rem', { lineHeight: '1.75rem' }],
                '2xl': ['1.5rem', { lineHeight: '2rem' }],
                '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
                '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
            },
            fontWeight: {
                normal: '400',
                medium: '500',
                semibold: '600',
                bold: '700',
            },
            keyframes: {
                'spin-once': {
                    '0%': { transform: 'rotate(0deg)' },
                    '100%': { transform: 'rotate(360deg)' },
                },
                'slide-up': {
                    '0%': { transform: 'translateY(100%)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                'fade-in': {
                    '0%': { opacity: '0', transform: 'scale(0.95)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                },
                'pulse-soft': {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.6' },
                },
            },
            animation: {
                'spin-once': 'spin-once 0.6s ease-in-out',
                'slide-up': 'slide-up 0.3s ease-out',
                'fade-in': 'fade-in 0.2s ease-in-out',
                'pulse-soft': 'pulse-soft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
        },
    },
    plugins: [],
}
