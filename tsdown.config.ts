import { defineConfig } from 'tsdown'

export default defineConfig({
  // The only entry: nothing outside of `src/` (e.g. the playground) can end up in the bundle
  entry: ['src/index.ts'],
  // ESM-only output, resolved by the bundler of the consuming app
  format: ['esm'],
  platform: 'browser',
  // Emit `.js`/`.d.ts` (clean names, valid because the package is `type: module`) instead of the default
  // `.mjs`/`.d.mts`.
  fixedExtension: false,
  // Point dts generation at the leaf tsconfig (the root one uses project references, which the dts generator can't
  // consume directly).
  tsconfig: 'tsconfig.lib.json',
  dts: true,
  clean: true,
  sourcemap: true,
  // `vue` and `vue-router` are peer dependencies, so they're never bundled
})
