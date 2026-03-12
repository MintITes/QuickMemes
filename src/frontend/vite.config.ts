import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import * as path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Use relative paths for Electron
  build: {
    outDir: 'dist/react',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './react'),
    }
  }
})
