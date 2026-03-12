/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./react/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bgPrimary: 'var(--bg-primary)',
        bgSecondary: 'var(--bg-secondary)',
        bgSurface: 'var(--bg-surface)',
        textPrimary: 'var(--text-primary)',
        textSecondary: 'var(--text-secondary)',
        accent: 'var(--accent-color)',
        borderColor: 'var(--border-color)',
        glassBg: 'var(--glass-bg)',
      },
      borderRadius: {
        'sm': 'calc(var(--corner-radius) * 0.5)',
        'md': 'var(--corner-radius)',
        'lg': 'calc(var(--corner-radius) * 1.33)',
        'xl': 'calc(var(--corner-radius) * 2)',
      },
    },
  },
  plugins: [],
}

