import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    // The library relies on browser APIs (`window` events, `sessionStorage`...)
    environment: 'jsdom',
    // Only the library is tested: the playground is checked by hand
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      // Report-only by default: console + html for local; json + json-summary feed the PR coverage comment (see the
      // `check` job in .github/workflows/ci.yml).
      // It never fails the run. To make it a hard gate, add `thresholds` (see "Enforce coverage thresholds" in
      // `CONTRIBUTING.md`).
      reporter: ['text', 'json', 'json-summary', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/tests/**', 'src/**/*.test.ts', 'src/**/*.d.ts'],
    },
  },
})
