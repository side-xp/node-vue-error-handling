import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  type App,
  type Component,
  createApp,
  defineAsyncComponent,
  defineComponent,
  h,
  nextTick,
  type VNodeChild,
} from 'vue'
import { ErrorBoundary } from '@/errorBoundary'
import { createErrorHandling } from '@/errorHandling'
import { markAsHandled } from '@/handledErrors'
import type { ErrorBoundaryActions, ErrorBoundaryProps, ErrorBoundarySlots, ErrorHandlingOptions } from '@/types'

/** Apps mounted by the current test, unmounted after it. */
const mountedApps: App[] = []

/** A component that fails in its setup. */
const FailingSetup = defineComponent({
  name: 'FailingSetup',
  setup() {
    throw new Error('Setup failed')
  },
})

/** A button that fails when clicked. */
const FailingButton = defineComponent({
  name: 'FailingButton',
  setup() {
    return () =>
      h('button', {
        onClick: () => {
          throw new Error('Click failed')
        },
      })
  },
})

/** Mounts the given render function in an app with the error handling installed. */
function mountInApp(render: () => VNodeChild, options: ErrorHandlingOptions = {}): HTMLElement {
  const container: HTMLElement = document.createElement('div')
  const app: App = createApp(defineComponent({ setup: () => render }))
  // Vue warns about the components that can't render after an error
  app.config.warnHandler = () => {}
  app.use(createErrorHandling({ onError: () => {}, ...options }))
  app.mount(container)
  mountedApps.push(app)
  return container
}

/**
 * Slots of an error boundary, as given to `h()`.
 * A mapped type, since `h()` doesn't accept an interface (it has no index signature).
 */
type BoundarySlots = { [Name in keyof ErrorBoundarySlots]: ErrorBoundarySlots[Name] }

/** Renders an error boundary with the given props and slots. */
function renderBoundary(props: ErrorBoundaryProps, slots: BoundarySlots): VNodeChild {
  return h(ErrorBoundary, props, slots)
}

/** A fallback slot that displays the error message, and keeps the actions it receives. */
function createFallback(): { slot: Required<ErrorBoundarySlots>['fallback']; actions: ErrorBoundaryActions[] } {
  const actions: ErrorBoundaryActions[] = []
  return {
    actions,
    slot: ({ error, ...slotActions }) => {
      actions.push(slotActions)
      return h('p', { class: 'fallback' }, `Fallback: ${error.message}`)
    },
  }
}

afterEach(() => {
  for (const app of mountedApps.splice(0)) {
    app.unmount()
  }
  vi.restoreAllMocks()
})

describe('ErrorBoundary', () => {
  describe('breaking errors', () => {
    it('replaces the content with the fallback', async () => {
      const onError = vi.fn()
      const onUnhandledError = vi.fn()
      const container: HTMLElement = mountInApp(
        () =>
          renderBoundary({}, { default: () => h(FailingSetup), fallback: ({ error }) => `Fallback: ${error.message}` }),
        { onError, onUnhandledError },
      )

      await nextTick()

      expect(container.textContent).toBe('Fallback: Setup failed')
      // Still given to `onError()`, but handled by the boundary
      expect(onError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ phase: 'setup' }))
      expect(onUnhandledError).not.toHaveBeenCalled()
    })

    it("doesn't handle them without a fallback", () => {
      const onUnhandledError = vi.fn()
      mountInApp(() => renderBoundary({}, { default: () => h(FailingSetup) }), { onUnhandledError })

      expect(onUnhandledError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: 'Setup failed' }))
    })

    it('handles the errors of an async component, and loads it again on retry', async () => {
      const loader = vi
        .fn<() => Promise<Component>>()
        .mockRejectedValueOnce(new Error('Load failed'))
        .mockResolvedValueOnce(defineComponent({ render: () => 'Loaded' }))
      const AsyncComponent = defineAsyncComponent(loader)
      const fallback = createFallback()
      const container: HTMLElement = mountInApp(() =>
        renderBoundary({}, { default: () => h(AsyncComponent), fallback: fallback.slot }),
      )

      await vi.waitFor(() => expect(container.textContent).toBe('Fallback: Load failed'))
      fallback.actions.at(-1)?.retry()
      await vi.waitFor(() => expect(container.textContent).toBe('Loaded'))

      expect(loader).toHaveBeenCalledTimes(2)
    })
  })

  describe('other errors', () => {
    it("aren't handled by default: the content stays, and they continue to the app", () => {
      const onUnhandledError = vi.fn()
      const container: HTMLElement = mountInApp(
        () => renderBoundary({}, { default: () => h(FailingButton), fallback: () => 'Fallback' }),
        { onUnhandledError },
      )

      container.querySelector('button')?.click()

      expect(container.querySelector('button')).not.toBeNull()
      expect(onUnhandledError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ phase: 'eventHandler' }))
    })

    it('are given to the default slot when they match the filter, next to the content', async () => {
      const onUnhandledError = vi.fn()
      const container: HTMLElement = mountInApp(
        () =>
          renderBoundary(
            { filter: ['eventHandler'] },
            { default: ({ error }) => [h(FailingButton), error ? h('p', error.message) : null] },
          ),
        { onUnhandledError },
      )

      container.querySelector('button')?.click()
      await nextTick()

      expect(container.querySelector('button')).not.toBeNull()
      expect(container.querySelector('p')?.textContent).toBe('Click failed')
      expect(onUnhandledError).not.toHaveBeenCalled()
    })

    it('can be cleared without displaying the content again from scratch', async () => {
      const setup = vi.fn(() => () => h('span', 'Content'))
      const Content = defineComponent({ setup })
      let actions: ErrorBoundaryActions | undefined
      const container: HTMLElement = mountInApp(() =>
        renderBoundary(
          { filter: ['eventHandler'] },
          {
            default: ({ error, ...slotActions }) => {
              actions = slotActions
              return [h(Content), h(FailingButton), error ? h('p', error.message) : null]
            },
          },
        ),
      )

      container.querySelector('button')?.click()
      await nextTick()
      actions?.clear()
      await nextTick()

      expect(container.querySelector('p')).toBeNull()
      expect(setup).toHaveBeenCalledOnce()
    })
  })

  describe('filter', () => {
    it('accepts a function', async () => {
      const container: HTMLElement = mountInApp(() =>
        renderBoundary(
          { filter: (caught) => caught.message === 'Setup failed' },
          { default: () => h(FailingSetup), fallback: () => 'Fallback' },
        ),
      )

      await nextTick()

      expect(container.textContent).toBe('Fallback')
    })

    it("doesn't handle the error when the function fails", () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const filterFailure: Error = new Error('Filter failed')
      const onUnhandledError = vi.fn()
      mountInApp(
        () =>
          renderBoundary(
            {
              filter: () => {
                throw filterFailure
              },
            },
            { default: () => h(FailingSetup), fallback: () => 'Fallback' },
          ),
        { onUnhandledError },
      )

      expect(consoleError).toHaveBeenCalledWith(filterFailure)
      expect(onUnhandledError).toHaveBeenCalledOnce()
    })
  })

  describe('propagation', () => {
    it('gives the errors it does not handle to the parent boundaries', async () => {
      const container: HTMLElement = mountInApp(() =>
        renderBoundary(
          {},
          {
            default: () => renderBoundary({ filter: ['eventHandler'] }, { default: () => h(FailingSetup) }),
            fallback: () => 'Outer fallback',
          },
        ),
      )

      await nextTick()

      expect(container.textContent).toBe('Outer fallback')
    })

    it('gives the errors of its fallback to the parent boundaries', async () => {
      const container: HTMLElement = mountInApp(() =>
        renderBoundary(
          {},
          {
            default: () => renderBoundary({}, { default: () => h(FailingSetup), fallback: () => h(FailingSetup) }),
            fallback: () => 'Outer fallback',
          },
        ),
      )

      await nextTick()

      expect(container.textContent).toBe('Outer fallback')
    })

    it('handles the errors of the elements placed directly in it', async () => {
      const container: HTMLElement = mountInApp(() =>
        renderBoundary(
          { filter: ['eventHandler'] },
          {
            default: ({ error }) => [
              h('button', {
                onClick: () => {
                  throw new Error('Click failed')
                },
              }),
              error ? h('p', error.message) : null,
            ],
          },
        ),
      )

      container.querySelector('button')?.click()
      await nextTick()

      expect(container.querySelector('p')?.textContent).toBe('Click failed')
    })

    it("doesn't handle the ignored errors", async () => {
      const onError = vi.fn()
      const container: HTMLElement = mountInApp(
        () => renderBoundary({}, { default: () => h(FailingSetup), fallback: () => 'Fallback' }),
        { onError, ignore: () => true },
      )

      await nextTick()

      expect(container.textContent).toBe('')
      expect(onError).not.toHaveBeenCalled()
    })
  })

  describe('retry', () => {
    it('displays the content again from scratch', async () => {
      let shouldFail = true
      const Flaky = defineComponent({
        setup() {
          if (shouldFail) {
            throw new Error('Setup failed')
          }
          return () => 'Content'
        },
      })
      const fallback = createFallback()
      const container: HTMLElement = mountInApp(() =>
        renderBoundary({}, { default: () => h(Flaky), fallback: fallback.slot }),
      )
      await nextTick()

      expect(container.textContent).toBe('Fallback: Setup failed')

      shouldFail = false
      fallback.actions.at(-1)?.retry()
      await nextTick()

      expect(container.textContent).toBe('Content')
    })

    it('displays an error thrown again, even if it was already handled', async () => {
      const onError = vi.fn()
      // e.g. a cached failure, thrown again on retry
      const cachedError: Error = new Error('Cached failure')
      const setup = vi.fn(() => {
        throw cachedError
      })
      const Failing = defineComponent({ setup })
      const fallback = createFallback()
      const container: HTMLElement = mountInApp(
        () => renderBoundary({}, { default: () => h(Failing), fallback: fallback.slot }),
        { onError },
      )
      await nextTick()

      fallback.actions.at(-1)?.retry()
      await nextTick()
      await nextTick()

      // The content was displayed again, and failed again
      expect(setup).toHaveBeenCalledTimes(2)
      expect(container.textContent).toBe('Fallback: Cached failure')
      // Given to `onError()` only once
      expect(onError).toHaveBeenCalledOnce()
    })
  })

  describe('installation', () => {
    it('displays the errors marked as handled, without giving them to `onError()`', async () => {
      const onError = vi.fn()
      const error: Error = new Error('Already handled')
      markAsHandled(error)
      const Failing = defineComponent({
        setup() {
          throw error
        },
      })
      const container: HTMLElement = mountInApp(
        () => renderBoundary({}, { default: () => h(Failing), fallback: ({ error }) => error.message }),
        { onError },
      )

      await nextTick()

      expect(container.textContent).toBe('Already handled')
      expect(onError).not.toHaveBeenCalled()
    })

    it('requires the error handling to be installed', () => {
      const errorHandler = vi.fn()
      const app: App = createApp(defineComponent({ setup: () => () => h(ErrorBoundary) }))
      app.config.warnHandler = () => {}
      app.config.errorHandler = errorHandler
      app.mount(document.createElement('div'))
      mountedApps.push(app)

      expect(errorHandler).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ message: expect.stringContaining('requires the error handling') }),
        expect.anything(),
        'setup function',
      )
    })
  })
})
