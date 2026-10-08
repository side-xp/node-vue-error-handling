import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      // Uses the source of the library, as an app would use the installed package (with HMR while developing)
      '@side-xp/vue-error-handling': fileURLToPath(new URL('../src/index.ts', import.meta.url)),
    },
  },
})
