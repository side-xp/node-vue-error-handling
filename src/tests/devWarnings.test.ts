import { afterEach, describe, expect, it, vi } from 'vitest'
import { type App, type Component, createApp, defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, type Router, RouterView } from 'vue-router'
import { createErrorHandling } from '@/errorHandling'
import { LOG_PREFIX } from '@/errorLogging'
import type { ErrorBoundaryProps } from '@/types'
import { FailingSetup, type MountOptions, mountInApp, renderBoundary, unmountApps } from './helpers'

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

  describe('installation', () => {
    /** Apps created by the current test, unmounted after it. */
    const createdApps: App[] = []

    /** Creates an app with the given root component. */
    function createTestApp(root: Component = defineComponent({ render: () => h(RouterView) })): App {
      const app: App = createApp(root)
      createdApps.push(app)
      return app
    }

    /**
     * Spies on `console.warn()`, and returns the warnings of the library.
     * Outside of a component, Vue's `warn()` doesn't go through `app.config.warnHandler` (it gets the app from the
     * component), like Vue's own warnings at install.
     */
    function collectConsoleWarnings(): string[] {
      const warnings: string[] = []
      vi.spyOn(console, 'warn').mockImplementation((message: unknown) => {
        if (typeof message === 'string' && message.includes(LOG_PREFIX)) {
          warnings.push(message)
        }
      })
      return warnings
    }

    afterEach(() => {
      for (const app of createdApps.splice(0)) {
        app.unmount()
      }
    })

    it("doesn't warn when the error handling is installed before the router", () => {
      const warnings: string[] = collectConsoleWarnings()
      const router: Router = createTestRouter()
      const app: App = createTestApp()

      app.use(createErrorHandling({ router, onError: () => {} }))
      app.use(router)
      app.mount(document.createElement('div'))

      expect(warnings).toEqual([])
    })

    it('warns when the error handling is installed after the router', () => {
      const warnings: string[] = collectConsoleWarnings()
      const router: Router = createTestRouter()
      const app: App = createTestApp()

      app.use(router)
      app.use(createErrorHandling({ router, onError: () => {} }))
      app.mount(document.createElement('div'))

      expect(warnings).toEqual([expect.stringContaining('installed after the router')])
    })

    it('warns when 2 error handlings are installed on the same app, and skips the second one', () => {
      const warnings: string[] = collectConsoleWarnings()
      const firstOnError = vi.fn()
      const secondOnError = vi.fn()
      const app: App = createTestApp(FailingSetup)
      // Vue warns about the components that can't render after an error
      app.config.warnHandler = () => {}

      app.use(createErrorHandling({ onError: firstOnError }))
      app.use(createErrorHandling({ onError: secondOnError }))
      app.mount(document.createElement('div'))

      expect(warnings).toEqual([expect.stringContaining('already installed on this app')])
      expect(firstOnError).toHaveBeenCalledOnce()
      expect(secondOnError).not.toHaveBeenCalled()
    })
  })
})
