import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Sansation', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'Noto Sans', 'sans-serif'],
        sansation: ['Sansation', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        manrope: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        merriweather: ['Merriweather', 'serif'],
        heading: ['Merriweather', 'serif'],
      },
      fontWeight: {
        'extralight': '200',
        'light': '300',
        'normal': '400',
        'medium': '500',
        'semibold': '600',
        'bold': '700',
        'clash-light': '300',
        'clash-medium': '500',
        'clash-semibold': '600',
      },
      letterSpacing: {
        'tighter': '-0.05em',
        'tight': '-0.025em',
        'snug': '-0.015em',
        'normal': '0em',
        'wide': '0.025em',
        'wider': '0.05em',
        'widest': '0.1em',
      },
      lineHeight: {
        'none': '1',
        'tight': '1.25',
        'snug': '1.375',
        'normal': '1.5',
        'relaxed': '1.625',
        'loose': '2',
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
        '5xl': ['3rem', { lineHeight: '1' }],
        '6xl': ['3.75rem', { lineHeight: '1' }],
      },
      colors: {
        // Spike-inspired color palette
        primary: {
          50: '#eff8ff',    // Lightest blue
          100: '#dbeefe',   // Very light blue
          200: '#bfdbfe',   // Light blue
          300: '#93c5fd',   // Medium light blue
          400: '#60a5fa',   // Medium blue
          500: '#3b82f6',   // Main primary blue (Spike's primary)
          600: '#2563eb',   // Dark blue
          700: '#1d4ed8',   // Darker blue
          800: '#1e40af',   // Very dark blue
          900: '#1e3a8a',   // Darkest blue
          950: '#1e293b',   // Almost black blue
        },
        secondary: {
          50: '#f8fafc',    // Lightest gray
          100: '#f1f5f9',   // Very light gray
          200: '#e2e8f0',   // Light gray
          300: '#cbd5e1',   // Medium light gray
          400: '#94a3b8',   // Medium gray
          500: '#64748b',   // Main secondary gray
          600: '#475569',   // Dark gray
          700: '#334155',   // Darker gray
          800: '#1e293b',   // Very dark gray
          900: '#0f172a',   // Darkest gray
        },
        accent: {
          50: '#fef3c7',    // Light amber
          100: '#fde68a',   // Amber
          200: '#fcd34d',   // Medium amber
          300: '#f59e0b',   // Main accent amber (for warnings/highlights)
          400: '#d97706',   // Dark amber
          500: '#b45309',   // Darker amber
          600: '#92400e',   // Very dark amber
        },
        success: {
          50: '#f0fdf4',    // Light green
          100: '#dcfce7',   // Very light green
          200: '#bbf7d0',   // Light green
          300: '#86efac',   // Medium light green
          400: '#4ade80',   // Medium green
          500: '#22c55e',   // Main success green
          600: '#16a34a',   // Dark green
          700: '#15803d',   // Darker green
          800: '#166534',   // Very dark green
          900: '#14532d',   // Darkest green
        },
        danger: {
          50: '#fef2f2',    // Light red
          100: '#fee2e2',   // Very light red
          200: '#fecaca',   // Light red
          300: '#fca5a5',   // Medium light red
          400: '#f87171',   // Medium red
          500: '#ef4444',   // Main danger red
          600: '#dc2626',   // Dark red
          700: '#b91c1c',   // Darker red
          800: '#991b1b',   // Very dark red
          900: '#7f1d1d',   // Darkest red
        },
        warning: {
          50: '#fffbeb',    // Light orange
          100: '#fef3c7',   // Very light orange
          200: '#fde68a',   // Light orange
          300: '#fcd34d',   // Medium light orange
          400: '#fbbf24',   // Medium orange
          500: '#f59e0b',   // Main warning orange
          600: '#d97706',   // Dark orange
          700: '#b45309',   // Darker orange
          800: '#92400e',   // Very dark orange
          900: '#78350f',   // Darkest orange
        },
        info: {
          50: '#f0f9ff',    // Light cyan
          100: '#e0f2fe',   // Very light cyan
          200: '#bae6fd',   // Light cyan
          300: '#7dd3fc',   // Medium light cyan
          400: '#38bdf8',   // Medium cyan
          500: '#0ea5e9',   // Main info cyan
          600: '#0284c7',   // Dark cyan
          700: '#0369a1',   // Darker cyan
          800: '#075985',   // Very dark cyan
          900: '#0c4a6e',   // Darkest cyan
        },
        // Spike dashboard specific colors
        sidebar: {
          bg: '#ffffff',     // White sidebar background
          text: '#64748b',   // Sidebar text color
          active: '#3b82f6', // Active sidebar item
          hover: '#f1f5f9',  // Hover state
        },
        navbar: {
          bg: '#ffffff',     // White navbar background
          text: '#1e293b',   // Navbar text
          border: '#e2e8f0', // Navbar border
        },
        card: {
          bg: '#ffffff',     // Card background
          border: '#e2e8f0', // Card border
          shadow: 'rgba(0, 0, 0, 0.1)', // Card shadow
        },
        // Enhanced gray scale for better consistency
        gray: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        }
      },
    },
  },
  plugins: [],
}
export default config
