import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type Component, defineAsyncComponent, defineComponent, h, nextTick } from 'vue'
import { createMemoryHistory, createRouter, type Router, RouterView } from 'vue-router'
import { isViteChunkLoadError } from '@/chunkLoadErrors'
import { createErrorHandling } from '@/errorHandling'
import { loadPage } from '@/pageLoading'
import type { ErrorHandling } from '@/types'
import { type MountOptions, mountInApp, renderBoundary, unmountApps } from './helpers'

// jsdom can't load pages
vi.mock('@/pageLoading', () => ({ loadPage: vi.fn() }))

/** Minimum delay between 2 automatic reloads. */
const RELOAD_COOLDOWN_MS = 10_000

/** Creates the error of a chunk that fails to load, reported by Vite as it does in production builds. */
function failChunkLoading(): Error {
  const error: Error = new TypeError('Failed to fetch dynamically imported module')
  const event: Event = Object.assign(new Event('vite:preloadError', { cancelable: true }), { payload: error })
  window.dispatchEvent(event)
  return error
}

/** Creates the error of a chunk that fails to load with another bundler, which doesn't report it like Vite. */
function createOtherBundlerError(): Error {
  return Object.assign(new Error('Loading chunk 42 failed.'), { name: 'ChunkLoadError' })
}

/** Detects the chunk loading failures of the other bundler, as an app would. */
function isOtherBundlerChunkLoadError(error: unknown): boolean {
  return error instanceof Error && error.name === 'ChunkLoadError'
}

/**
 * Creates the router of a test, ready on `/`, with a page whose chunk fails to load (`/lazy`), and the same with
 * another bundler (`/other-bundler`).
 */
async function createTestRouter(): Promise<Router> {
  const router: Router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: defineComponent({ render: () => 'Home' }) },
      { path: '/lazy', component: () => Promise.reject(failChunkLoading()) },
      { path: '/other-bundler', component: () => Promise.reject(createOtherBundlerError()) },
    ],
  })
  await router.push('/')
  return router
}

/** Mounts the router view in a navigation boundary. Returns the router and the container. */
async function mountRouterView(options: MountOptions = {}): Promise<{ router: Router; container: HTMLElement }> {
  const router: Router = await createTestRouter()
  const { container } = mountInApp(
    () =>
      renderBoundary(
        { navigation: true },
        {
          default: () => h(RouterView),
          fallback: ({ error }) => `Fallback (chunk load error: ${error.isChunkLoadError})`,
        },
      ),
    { router, ...options },
  )
  return { router, container }
}

/** Navigates to the page whose chunk fails to load (with Vite by default). */
async function navigateToLazyPage(router: Router, path = '/lazy'): Promise<void> {
  try {
    await router.push(path)
  } catch {
    // Handled by `router.onError()`
  }
  await nextTick()
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
})

afterEach(() => {
  unmountApps()
  sessionStorage.clear()
  vi.useRealTimers()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('chunk loading failures', () => {
  describe('detection', () => {
    it('flags the errors reported by Vite', async () => {
      const onError = vi.fn()
      const { router } = await mountRouterView({ onError, reloadOnChunkLoadError: false })

      await navigateToLazyPage(router)

      expect(onError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ isChunkLoadError: true }))
    })

    it('flags the errors detected by the app, in addition to the ones reported by Vite', async () => {
      const onError = vi.fn()
      const { router } = await mountRouterView({
        onError,
        reloadOnChunkLoadError: false,
        isChunkLoadError: isOtherBundlerChunkLoadError,
      })

      await navigateToLazyPage(router, '/other-bundler')
      await navigateToLazyPage(router)

      expect(onError.mock.calls.map(([caught]) => caught.isChunkLoadError)).toEqual([true, true])
    })

    it("doesn't flag the error when the detection of the app fails", () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const detectionFailure: Error = new Error('Detection failed')
      const onError = vi.fn()
      const errorHandling: ErrorHandling = createErrorHandling({
        onError,
        isChunkLoadError: () => {
          throw detectionFailure
        },
      })

      errorHandling.report(createOtherBundlerError())

      expect(onError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ isChunkLoadError: false }))
      expect(consoleError).toHaveBeenCalledWith(detectionFailure)
    })

    it('flags the async components that fail to load, without reloading the page', async () => {
      const AsyncComponent: Component = defineAsyncComponent(() => Promise.reject(failChunkLoading()))
      const { container } = mountInApp(() =>
        renderBoundary(
          {},
          {
            default: () => h(AsyncComponent),
            fallback: ({ error }) => `Fallback (chunk load error: ${error.isChunkLoadError})`,
          },
        ),
      )

      await vi.waitFor(() => expect(container.textContent).toBe('Fallback (chunk load error: true)'))
      expect(loadPage).not.toHaveBeenCalled()
    })

    it('stops recording the errors when the app is unmounted', () => {
      mountInApp(() => null)

      unmountApps()
      const error: Error = failChunkLoading()

      expect(isViteChunkLoadError(error)).toBe(false)
    })
  })

  describe('automatic reload', () => {
    it('loads the page again when a navigation fails to load a chunk', async () => {
      const onError = vi.fn()
      const { router, container } = await mountRouterView({ onError })

      await navigateToLazyPage(router)

      expect(loadPage).toHaveBeenCalledExactlyOnceWith('/lazy')
      // The page is loading: nothing to display
      expect(container.textContent).toBe('Home')
      expect(onError).not.toHaveBeenCalled()
    })

    it('happens at most once every 10 seconds, the error is displayed otherwise', async () => {
      const { router, container } = await mountRouterView()

      await navigateToLazyPage(router)
      vi.advanceTimersByTime(RELOAD_COOLDOWN_MS - 1)
      await navigateToLazyPage(router)

      expect(loadPage).toHaveBeenCalledOnce()
      expect(container.textContent).toBe('Fallback (chunk load error: true)')

      vi.advanceTimersByTime(1)
      await navigateToLazyPage(router)

      expect(loadPage).toHaveBeenCalledTimes(2)
    })

    it("doesn't happen without storage, since a reload loop couldn't be prevented", async () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage disabled')
      })
      const { router, container } = await mountRouterView()

      await navigateToLazyPage(router)

      expect(loadPage).not.toHaveBeenCalled()
      expect(container.textContent).toBe('Fallback (chunk load error: true)')
    })

    it('happens with the errors detected by the app', async () => {
      const { router } = await mountRouterView({ isChunkLoadError: isOtherBundlerChunkLoadError })

      await navigateToLazyPage(router, '/other-bundler')

      expect(loadPage).toHaveBeenCalledExactlyOnceWith('/other-bundler')
    })

    it('can be disabled', async () => {
      const { router, container } = await mountRouterView({ reloadOnChunkLoadError: false })

      await navigateToLazyPage(router)

      expect(loadPage).not.toHaveBeenCalled()
      expect(container.textContent).toBe('Fallback (chunk load error: true)')
    })
  })
})
