import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      // Report-only by default: console + html for local; json + json-summary feed the PR coverage comment (see the
      // `check` job in .github/workflows/ci.yml).
      // It never fails the run. To make coverage a hard gate, see "Enforce coverage thresholds" in
      // `docs/protocols.md`.
      reporter: ['text', 'json', 'json-summary', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/tests/**', 'src/**/*.test.ts', 'src/**/*.d.ts'],
    },
  },
})
