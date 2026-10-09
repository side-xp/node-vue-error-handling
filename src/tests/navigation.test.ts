import { afterEach, describe, expect, it, vi } from 'vitest'
import { type Component, defineComponent, h, nextTick, type VNodeChild } from 'vue'
import { createMemoryHistory, createRouter, type Router, RouterView } from 'vue-router'
import type { ErrorBoundarySlots } from '@/types'
import { createFallback, FailingSetup, mountInApp, renderBoundary, unmountApps } from './helpers'

/** Creates a component that renders the given text. */
function createPage(text: string): Component {
  return defineComponent({ render: () => text })
}

/** Loader of the page that fails to load the first time only. */
let loadPage = vi.fn<() => Promise<Component>>()

/** Creates the router of a test, with a page for each case, ready on `/`. */
async function createTestRouter(): Promise<Router> {
  loadPage = vi
    .fn<() => Promise<Component>>()
    .mockRejectedValueOnce(new Error('Load failed'))
    .mockResolvedValue(createPage('Loaded'))

  const router: Router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: createPage('Home') },
      { path: '/other', component: createPage('Other') },
      {
        path: '/guard-fails',
        component: createPage('Guarded'),
        beforeEnter: () => {
          throw new Error('Guard failed')
        },
      },
      { path: '/load-fails', component: () => loadPage() },
      { path: '/setup-fails', component: FailingSetup },
    ],
  })
  await router.push('/')
  return router
}

/** Navigates to the given path, ignoring the navigation error (handled by the error handling). */
async function navigate(router: Router, path: string): Promise<void> {
  try {
    await router.push(path)
  } catch {
    // Handled by `router.onError()`
  }
  await nextTick()
}

/** Renders the router view in a boundary with the given props, and a fallback that displays the error. */
function renderRouterView(navigation: boolean, fallback?: ErrorBoundarySlots['fallback']): () => VNodeChild {
  return () =>
    renderBoundary(
      { navigation },
      { default: () => h(RouterView), fallback: fallback ?? (({ error }) => `Fallback: ${error.message}`) },
    )
}

afterEach(() => {
  unmountApps()
  vi.restoreAllMocks()
})

describe('navigation errors', () => {
  it('are displayed by the navigation boundary', async () => {
    const router: Router = await createTestRouter()
    const onError = vi.fn()
    const onUnhandledError = vi.fn()
    const { container } = mountInApp(renderRouterView(true), { router, onError, onUnhandledError })

    await navigate(router, '/guard-fails')

    expect(container.textContent).toBe('Fallback: Guard failed')
    expect(onError).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        source: 'navigation',
        message: 'Guard failed',
        to: expect.objectContaining({ fullPath: '/guard-fails' }),
        from: expect.objectContaining({ fullPath: '/' }),
      }),
      { handledBy: { name: undefined } },
    )
    expect(onUnhandledError).not.toHaveBeenCalled()
  })

  it('are given to the app without a navigation boundary', async () => {
    const router: Router = await createTestRouter()
    const onUnhandledError = vi.fn()
    const { container } = mountInApp(renderRouterView(false), { router, onUnhandledError })

    await navigate(router, '/guard-fails')

    expect(container.textContent).toBe('Home')
    expect(onUnhandledError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ source: 'navigation' }))
  })

  it('are given to the app when the navigation boundary has no fallback', async () => {
    const router: Router = await createTestRouter()
    const onUnhandledError = vi.fn()
    mountInApp(() => renderBoundary({ navigation: true }, { default: () => h(RouterView) }), {
      router,
      onUnhandledError,
    })

    await navigate(router, '/guard-fails')

    expect(onUnhandledError).toHaveBeenCalledOnce()
  })

  it('are not displayed when ignored', async () => {
    const router: Router = await createTestRouter()
    const onError = vi.fn()
    const { container } = mountInApp(renderRouterView(true), { router, onError, ignore: () => true })

    await navigate(router, '/guard-fails')

    expect(container.textContent).toBe('Home')
    expect(onError).not.toHaveBeenCalled()
  })

  it('are displayed by the first navigation boundary mounted', async () => {
    const router: Router = await createTestRouter()
    const { container } = mountInApp(
      () =>
        renderBoundary(
          { navigation: true },
          {
            default: () =>
              renderBoundary({ navigation: true }, { default: () => h(RouterView), fallback: () => 'Inner' }),
            fallback: () => 'Outer',
          },
        ),
      { router },
    )

    await navigate(router, '/guard-fails')

    expect(container.textContent).toBe('Outer')
  })

  it('are given to the app only once', async () => {
    const router: Router = await createTestRouter()
    const onError = vi.fn()
    mountInApp(renderRouterView(false), { router, onError })

    let navigationError: unknown
    try {
      await router.push('/guard-fails')
    } catch (error) {
      navigationError = error
    }
    // e.g. a `router.push()` that wasn't awaited
    const promise: Promise<never> = Promise.reject(navigationError)
    promise.catch(() => {})
    window.dispatchEvent(new PromiseRejectionEvent('unhandledrejection', { promise, reason: navigationError }))

    expect(onError).toHaveBeenCalledOnce()
  })

  describe('retry()', () => {
    it('navigates to the page again', async () => {
      const router: Router = await createTestRouter()
      const fallback = createFallback()
      const { container } = mountInApp(renderRouterView(true, fallback.slot), { router })

      await navigate(router, '/load-fails')
      expect(container.textContent).toBe('Fallback: Load failed')

      fallback.actions.at(-1)?.retry()

      await vi.waitFor(() => expect(container.textContent).toBe('Loaded'))
      expect(router.currentRoute.value.fullPath).toBe('/load-fails')
      expect(loadPage).toHaveBeenCalledTimes(2)
    })
  })

  describe('successful navigations', () => {
    it('clear the navigation errors', async () => {
      const router: Router = await createTestRouter()
      const { container } = mountInApp(renderRouterView(true), { router })

      await navigate(router, '/guard-fails')
      await navigate(router, '/other')

      expect(container.textContent).toBe('Other')
    })

    it('clear the errors of the page', async () => {
      const router: Router = await createTestRouter()
      const { container } = mountInApp(renderRouterView(true), { router })

      await navigate(router, '/setup-fails')
      await nextTick()
      expect(container.textContent).toBe('Fallback: Setup failed')

      await navigate(router, '/other')

      expect(container.textContent).toBe('Other')
    })
  })

  describe('installation', () => {
    it('removes the router hooks when the app is unmounted', async () => {
      const router: Router = await createTestRouter()
      const onError = vi.fn()
      mountInApp(renderRouterView(true), { router, onError })

      unmountApps()
      await navigate(router, '/guard-fails')

      expect(onError).not.toHaveBeenCalled()
    })
  })
})
