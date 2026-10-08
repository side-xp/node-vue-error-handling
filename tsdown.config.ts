import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  // ESM-only output. To also emit CJS (legacy consumers) or an IIFE bundle for CDN usage, see the relevant sections in
  // `docs/protocols.md`.
  format: ['esm'],
  platform: 'node',
  // Emit `.js`/`.d.ts` (clean names, valid because the package is `type: module`) instead of the default
  // `.mjs`/`.d.mts`.
  fixedExtension: false,
  // Point dts generation at the leaf tsconfig (the root one uses project references, which the dts generator can't
  // consume directly).
  tsconfig: 'tsconfig.lib.json',
  dts: true,
  clean: true,
  sourcemap: true,
})
