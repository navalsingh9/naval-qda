import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Pull the version straight from the root package.json (the same file
// electron-builder reads for release asset naming) so the sidebar footer
// can never drift out of sync with the actual app version the way the
// previous hardcoded '0.4.8' fallback did.
const rootPackageJson = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf-8')
)

// https://vite.dev/config/
export default defineConfig({
  // Electron loads the built index.html via file://, so asset URLs must be
  // relative — Vite's default base of '/' resolves to the filesystem root
  // and breaks every asset request in the packaged app.
  base: './',
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(rootPackageJson.version),
  },
})
