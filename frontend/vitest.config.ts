import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

/**
 * Vitest configuration.
 * Only collects test files under tests/ — the e2e/ directory is
 * reserved for Playwright specs, run via `npm run test:e2e`.
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.{test,spec}.ts'],
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
})
