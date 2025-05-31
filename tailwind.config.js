/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./screens/**/*.{js,jsx,ts,tsx}",
    "./hooks/**/*.{js,jsx,ts,tsx}",
    "./contexts/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Brand colors (based on existing Colors.ts)
        primary: {
          50: '#e6f3ff',
          100: '#b3d9ff',
          500: '#007AFF', // iOS blue used throughout the app
          600: '#0056cc',
          700: '#004bb3',
          900: '#003d99',
        },
        // Theme colors from existing system
        light: {
          text: '#11181C',
          background: '#fff',
          tint: '#0a7ea4',
          icon: '#687076',
        },
        dark: {
          text: '#ECEDEE',
          background: '#151718',
          tint: '#fff',
          icon: '#9BA1A6',
        },
        // Semantic colors found in components
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        // Gray scale
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        }
      },
      fontSize: {
        xs: ['12px', '16px'],
        sm: ['14px', '20px'],
        base: ['16px', '24px'],
        lg: ['18px', '28px'],
        xl: ['20px', '28px'],
        '2xl': ['24px', '32px'],
        '3xl': ['28px', '32px'], // Used in HelloWave
        '4xl': ['32px', '32px'], // Used in ThemedText title
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
    },
  },
  plugins: [],
}

