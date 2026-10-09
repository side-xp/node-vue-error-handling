import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  type Component,
  defineComponent,
  h,
  KeepAlive,
  nextTick,
  onActivated,
  type Ref,
  ref,
  Suspense,
  Transition,
  type VNode,
  type VNodeChild,
} from 'vue'
import { createMemoryHistory, createRouter, type Router, RouterView } from 'vue-router'
import { ErrorBoundary } from '@/errorBoundary'
import { createFallback, FailingSetup, mountInApp, renderBoundary, unmountApps } from './helpers'

/** Creates a component with an async setup, that fails while `shouldFail()` returns `true`. */
function createAsyncSetup(shouldFail: () => boolean): Component {
  return defineComponent({
    name: 'AsyncSetup',
    async setup() {
      await Promise.resolve()
      if (shouldFail()) {
        throw new Error('Async setup failed')
      }
      return () => 'Loaded'
    },
  })
}

afterEach(() => {
  unmountApps()
  vi.restoreAllMocks()
})

describe('built-in components', () => {
  describe('Suspense', () => {
    it('replaces the content with the fallback when an async setup fails', async () => {
      const onUnhandledError = vi.fn()
      const AsyncSetup: Component = createAsyncSetup(() => true)
      const fallback = createFallback()
      const { container } = mountInApp(
        () => renderBoundary({}, { default: () => h(Suspense, null, () => h(AsyncSetup)), fallback: fallback.slot }),
        { onUnhandledError },
      )

      await vi.waitFor(() => expect(container.textContent).toBe('Fallback: Async setup failed'))

      expect(onUnhandledError).not.toHaveBeenCalled()
    })

    it('runs the async setup again on retry', async () => {
      let shouldFail = true
      const AsyncSetup: Component = createAsyncSetup(() => shouldFail)
      const fallback = createFallback()
      const { container } = mountInApp(() =>
        renderBoundary({}, { default: () => h(Suspense, null, () => h(AsyncSetup)), fallback: fallback.slot }),
      )

      await vi.waitFor(() => expect(container.textContent).toBe('Fallback: Async setup failed'))
      shouldFail = false
      fallback.actions.at(-1)?.retry()

      await vi.waitFor(() => expect(container.textContent).toBe('Loaded'))
    })

    // Not tested: a boundary inside the content of a pending `<Suspense>`, around the async setup that fails. Vue renders
    // the failed component after its error, while the boundary already replaced it with its fallback, and crashes (also
    // with a plain `onErrorCaptured()`, without this library). See "Known issues" in the README

    it('lets a boundary inside the resolved content handle the errors', async () => {
      const shouldFail: Ref<boolean> = ref(false)
      const AsyncSetup: Component = createAsyncSetup(() => false)
      const FailingRender = defineComponent({
        name: 'FailingRender',
        render() {
          if (shouldFail.value) {
            throw new Error('Render failed')
          }
          return 'Rendered'
        },
      })
      const { container } = mountInApp(() =>
        // `<Suspense>` expects a single root node
        h(Suspense, null, () =>
          h('div', [
            h(AsyncSetup),
            renderBoundary({}, { default: () => h(FailingRender), fallback: () => 'Inner fallback' }),
          ]),
        ),
      )

      await vi.waitFor(() => expect(container.textContent).toBe('LoadedRendered'))
      shouldFail.value = true

      await vi.waitFor(() => expect(container.textContent).toBe('LoadedInner fallback'))
    })

    it('gives the error to the app without a boundary', async () => {
      const onUnhandledError = vi.fn()
      const AsyncSetup: Component = createAsyncSetup(() => true)
      mountInApp(() => h(Suspense, null, () => h(AsyncSetup)), { onUnhandledError })

      await vi.waitFor(() =>
        expect(onUnhandledError).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({ message: 'Async setup failed', phase: 'setup' }),
        ),
      )
    })
  })

  describe('KeepAlive', () => {
    /** A page with a counter, to check whether its state is kept. */
    const CounterPage = defineComponent({
      name: 'CounterPage',
      setup() {
        const count: Ref<number> = ref(0)
        return () => h('button', { onClick: () => count.value++ }, `Count: ${count.value}`)
      },
    })

    it('loses its cache when a boundary around it displays its fallback', async () => {
      const page: Ref<'counter' | 'failing'> = ref('counter')
      const fallback = createFallback()
      const { container } = mountInApp(() =>
        renderBoundary(
          {},
          {
            default: () => h(KeepAlive, null, () => h(page.value === 'counter' ? CounterPage : FailingSetup)),
            fallback: fallback.slot,
          },
        ),
      )

      container.querySelector('button')?.click()
      await nextTick()
      expect(container.textContent).toBe('Count: 1')

      page.value = 'failing'
      await nextTick()
      expect(container.textContent).toBe('Fallback: Setup failed')

      page.value = 'counter'
      fallback.actions.at(-1)?.retry()
      await nextTick()
      // The fallback replaced the whole content, including the cache
      expect(container.textContent).toBe('Count: 0')
    })

    it('keeps the error of a cached boundary while it is deactivated', async () => {
      const onError = vi.fn()
      let shouldFail = true
      const FlakySetup = defineComponent({
        name: 'FlakySetup',
        setup() {
          if (shouldFail) {
            throw new Error('Setup failed')
          }
          return () => 'Loaded'
        },
      })
      const page: Ref<'boundary' | 'counter'> = ref('boundary')
      const fallback = createFallback()
      const { container } = mountInApp(
        () =>
          h(KeepAlive, null, () =>
            page.value === 'boundary'
              ? h(ErrorBoundary, { key: 'boundary' }, { default: () => h(FlakySetup), fallback: fallback.slot })
              : h(CounterPage, { key: 'counter' }),
          ),
        { onError },
      )

      await nextTick()
      expect(container.textContent).toBe('Fallback: Setup failed')

      page.value = 'counter'
      await nextTick()
      page.value = 'boundary'
      await nextTick()
      // The cached boundary is displayed again as it was, without failing again
      expect(container.textContent).toBe('Fallback: Setup failed')
      expect(onError).toHaveBeenCalledOnce()

      shouldFail = false
      fallback.actions.at(-1)?.retry()
      await nextTick()
      expect(container.textContent).toBe('Loaded')
    })

    it('gives the errors of the `activated` hooks to the app, and keeps the content', async () => {
      const onUnhandledError = vi.fn()
      let shouldFail = false
      const ActivatedPage = defineComponent({
        name: 'ActivatedPage',
        setup() {
          onActivated(() => {
            if (shouldFail) {
              throw new Error('Activation failed')
            }
          })
          return () => 'Activated page'
        },
      })
      const page: Ref<'activated' | 'counter'> = ref('activated')
      const { container } = mountInApp(
        () =>
          renderBoundary(
            {},
            {
              default: () => h(KeepAlive, null, () => h(page.value === 'activated' ? ActivatedPage : CounterPage)),
              fallback: () => 'Fallback',
            },
          ),
        { onUnhandledError },
      )

      page.value = 'counter'
      await nextTick()
      shouldFail = true
      page.value = 'activated'
      await nextTick()

      expect(container.textContent).toBe('Activated page')
      expect(onUnhandledError).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ message: 'Activation failed', phase: 'hook' }),
      )
    })
  })

  describe('Transition', () => {
    /** A page with a root element, as `<Transition>` needs. */
    const HomePage = defineComponent({ name: 'HomePage', render: () => h('p', 'Home') })

    it('replaces the transition with the fallback when the entering component fails', async () => {
      const page: Ref<'home' | 'failing'> = ref('home')
      const fallback = createFallback()
      const { container } = mountInApp(() =>
        renderBoundary(
          {},
          {
            default: () => h(Transition, { mode: 'out-in' }, () => h(page.value === 'home' ? HomePage : FailingSetup)),
            fallback: fallback.slot,
          },
        ),
      )

      page.value = 'failing'
      // The failing component is mounted once the previous one has left
      await vi.waitFor(() => expect(container.textContent).toBe('Fallback: Setup failed'))

      page.value = 'home'
      fallback.actions.at(-1)?.retry()
      await vi.waitFor(() => expect(container.textContent).toBe('Home'))
    })

    describe('around the router view', () => {
      /** Creates a router with a page that fails in its setup, and a guard that throws, ready on `/`. */
      async function createTestRouter(): Promise<Router> {
        const router: Router = createRouter({
          history: createMemoryHistory(),
          routes: [
            { path: '/', component: HomePage },
            { path: '/setup-fails', component: FailingSetup },
            {
              path: '/guard-fails',
              component: HomePage,
              beforeEnter: () => {
                throw new Error('Guard failed')
              },
            },
          ],
        })
        await router.push('/')
        return router
      }

      /** Renders the router view with a transition, in a navigation boundary. */
      function renderPageBoundary(): VNodeChild {
        return renderBoundary(
          { navigation: true },
          {
            default: () =>
              h(RouterView, null, {
                default: ({ Component }: { Component: VNode | undefined }) =>
                  h(Transition, { mode: 'out-in' }, () => Component),
              }),
            fallback: ({ error }) => `Fallback: ${error.message}`,
          },
        )
      }

      /** Navigates to the given path, ignoring the navigation error (handled by the error handling). */
      async function navigate(router: Router, path: string): Promise<void> {
        try {
          await router.push(path)
        } catch {
          // Handled by `router.onError()`
        }
      }

      it('displays the errors of the pages, and clears them after the next navigation', async () => {
        const router: Router = await createTestRouter()
        const { container } = mountInApp(renderPageBoundary, { router })

        await navigate(router, '/setup-fails')
        await vi.waitFor(() => expect(container.textContent).toBe('Fallback: Setup failed'))

        await navigate(router, '/')
        await vi.waitFor(() => expect(container.textContent).toBe('Home'))
      })

      it('displays the navigation errors', async () => {
        const router: Router = await createTestRouter()
        const { container } = mountInApp(renderPageBoundary, { router })

        await navigate(router, '/guard-fails')
        await vi.waitFor(() => expect(container.textContent).toBe('Fallback: Guard failed'))

        await navigate(router, '/')
        await vi.waitFor(() => expect(container.textContent).toBe('Home'))
      })
    })

    it('gives the errors of the transition hooks to the app, and keeps the content', async () => {
      const onUnhandledError = vi.fn()
      const isShown: Ref<boolean> = ref(false)
      const { container } = mountInApp(
        () =>
          renderBoundary(
            {},
            {
              default: () =>
                h(
                  Transition,
                  {
                    onEnter: () => {
                      throw new Error('Enter failed')
                    },
                  },
                  () => (isShown.value ? h(HomePage) : null),
                ),
              fallback: () => 'Fallback',
            },
          ),
        { onUnhandledError },
      )

      isShown.value = true

      await vi.waitFor(() =>
        expect(onUnhandledError).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({ message: 'Enter failed', phase: 'other' }),
        ),
      )
      expect(container.textContent).toBe('Home')
    })
  })
})
