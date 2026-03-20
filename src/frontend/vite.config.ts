import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import * as path from 'path'

function manualChunks(id: string) {
  if (!id.includes('node_modules')) {
    return
  }

  // Keep the most commonly reused framework/runtime pieces in stable chunks.
  if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
    return 'react-vendor'
  }

  // Split heavier feature libraries so the app shell stays smaller and easier to cache.
  if (id.includes('/framer-motion/')) {
    return 'motion'
  }

  if (id.includes('/@dnd-kit/')) {
    return 'dnd-kit'
  }

  if (id.includes('/react-virtuoso/')) {
    return 'virtuoso'
  }

  if (
    id.includes('/i18next/') ||
    id.includes('/react-i18next/') ||
    id.includes('/i18next-browser-languagedetector/')
  ) {
    return 'i18n'
  }

  if (id.includes('/lucide-react/')) {
    return 'icons'
  }

  if (
    id.includes('/clsx/') ||
    id.includes('/tailwind-merge/') ||
    id.includes('/class-variance-authority/')
  ) {
    return 'ui-utils'
  }

  if (id.includes('/zustand/')) {
    return 'state'
  }

  return 'vendor'
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Use relative paths for Electron
  build: {
    outDir: 'dist/react',
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './react'),
    }
  }
})
