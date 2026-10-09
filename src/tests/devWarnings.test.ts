import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { createMemoryHistory, createRouter, type Router, RouterView } from 'vue-router'
import type { ErrorBoundaryProps } from '@/types'
import { type MountOptions, mountInApp, renderBoundary, unmountApps } from './helpers'

/** Creates a router with a single page. */
function createTestRouter(): Router {
  return createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => 'Home' } }] })
}

/** Mounts a boundary around the router view with the given props, and returns the warnings of the library. */
function collectWarnings(
  props: ErrorBoundaryProps,
  { hasFallback = true, ...options }: MountOptions & { hasFallback?: boolean } = {},
): string[] {
  const warnings: string[] = []
  mountInApp(
    () => renderBoundary(props, { default: () => h(RouterView), fallback: hasFallback ? () => 'Fallback' : undefined }),
    { ...options, onWarn: (message) => warnings.push(message) },
  )
  return warnings
}

afterEach(() => {
  unmountApps()
  vi.restoreAllMocks()
})

describe('development warnings', () => {
  it("doesn't warn about a boundary used as intended", () => {
    expect(collectWarnings({ navigation: true }, { router: createTestRouter() })).toEqual([])
    expect(collectWarnings({})).toEqual([])
  })

  it('warns when several navigation boundaries are mounted', () => {
    const warnings: string[] = []
    mountInApp(
      () =>
        renderBoundary(
          { navigation: true },
          {
            default: () =>
              renderBoundary({ navigation: true }, { default: () => h(RouterView), fallback: () => 'Inner' }),
            fallback: () => 'Outer',
          },
        ),
      { router: createTestRouter(), onWarn: (message) => warnings.push(message) },
    )

    expect(warnings).toEqual([expect.stringContaining('Several navigation boundaries are mounted')])
  })

  it('warns about the `navigation` prop without the `router` option', () => {
    expect(collectWarnings({ navigation: true })).toEqual([
      expect.stringContaining('has no effect without the `router` option'),
    ])
  })

  describe('boundary without fallback', () => {
    it('warns about a navigation boundary', () => {
      expect(collectWarnings({ navigation: true }, { router: createTestRouter(), hasFallback: false })).toEqual([
        expect.stringContaining("it can't display the navigation errors"),
      ])
    })

    it('warns when its filter only accepts the errors that need a fallback', () => {
      expect(collectWarnings({}, { hasFallback: false })).toEqual([expect.stringContaining('it handles no error')])
      expect(collectWarnings({ filter: ['setup', 'reported'] }, { hasFallback: false })).toEqual([
        expect.stringContaining('it handles no error'),
      ])
    })

    it("doesn't warn when its filter accepts the errors that leave the content", () => {
      expect(collectWarnings({ filter: ['setup', 'eventHandler'] }, { hasFallback: false })).toEqual([])
    })

    it("doesn't warn with a filter function, which can't be checked", () => {
      expect(collectWarnings({ filter: () => true }, { hasFallback: false })).toEqual([])
    })
  })
})
