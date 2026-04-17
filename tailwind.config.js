/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#060E18',
          900: '#0D1B2A',
          800: '#1B2838',
          700: '#243447',
          600: '#2E4057',
          500: '#3A5068',
        },
        amber: {
          400: '#F5A623',
          500: '#E8951A',
        },
        success: {
          400: '#22C55E',
          500: '#16A34A',
        },
        danger: {
          400: '#EF4444',
          500: '#DC2626',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'DM Sans', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'waveform': 'waveform 0.5s ease-in-out infinite alternate',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.95)', opacity: '0.7', boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.7)' },
          '70%': { transform: 'scale(1)', opacity: '0.3', boxShadow: '0 0 0 12px rgba(239, 68, 68, 0)' },
          '100%': { transform: 'scale(0.95)', opacity: '0.7', boxShadow: '0 0 0 0 rgba(239, 68, 68, 0)' },
        },
        'waveform': {
          '0%': { height: '4px' },
          '100%': { height: '24px' },
        },
        'fadeIn': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slideUp': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'glow': {
          '0%': { boxShadow: '0 0 5px rgba(245, 166, 35, 0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(245, 166, 35, 0.6)' },
        },
      },
    },
  },
  plugins: [],
}
