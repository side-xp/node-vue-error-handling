/// <reference types="vite/client" />
import vueProductionBuild from '@vue/runtime-core/dist/runtime-core.cjs.prod.js?raw'
import { describe, expect, it } from 'vitest'
import * as Vue from 'vue'
import { getVuePhase, VUE_ERROR_TYPES } from '@/vuePhases'

/** Descriptions of the error types given by Vue in development builds (internal API). */
const vueErrorTypeStrings: Record<string, string> | null = (
  Vue as unknown as { ErrorTypeStrings: Record<string, string> | null }
).ErrorTypeStrings

describe('Vue phases', () => {
  it('match the error types of the installed Vue version', () => {
    const descriptions: Record<string, string> = Object.fromEntries(
      Object.entries(VUE_ERROR_TYPES).map(([code, { description }]) => [code, description]),
    )

    // Fails when Vue adds, removes or renames an error type
    expect(descriptions).toEqual(vueErrorTypeStrings)
  })

  it('match the form of the error types in the production build of the installed Vue version', () => {
    // Vitest always runs the development build of Vue (it's loaded before `NODE_ENV=production` could apply), so the
    // production build is checked from its source
    expect(vueProductionBuild).toContain(`\`https://vuejs.org/error-reference/#runtime-\${type}\``)
  })

  it('reads the error types in both their development and production forms', () => {
    expect(getVuePhase('setup function')).toBe('setup')
    expect(getVuePhase('https://vuejs.org/error-reference/#runtime-0')).toBe('setup')
    expect(getVuePhase('mounted hook')).toBe('mount')
    expect(getVuePhase('https://vuejs.org/error-reference/#runtime-m')).toBe('mount')
  })

  it('falls back to a generic phase for an unknown error type', () => {
    expect(getVuePhase('unknown error type')).toBe('other')
  })
})
