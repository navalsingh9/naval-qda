import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Electron loads the built index.html via file://, so asset URLs must be
  // relative — Vite's default base of '/' resolves to the filesystem root
  // and breaks every asset request in the packaged app.
  base: './',
  plugins: [react()],
})
