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
        'sm': '6px',
        'md': '12px',
        'lg': '16px',
        'xl': '24px',
      },
    },
  },
  plugins: [],
}

