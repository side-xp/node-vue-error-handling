import { afterEach, describe, expect, it, vi } from 'vitest'
import { type Component, defineComponent, h, KeepAlive, nextTick, onActivated, type Ref, ref, Suspense } from 'vue'
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
})
