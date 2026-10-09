import { afterEach, describe, expect, it, vi } from 'vitest'
import { type App, createApp, defineComponent, h, nextTick, ref } from 'vue'
import type { UseErrorHandlingReturn } from '@/types'
import { useErrorHandling } from '@/useErrorHandling'
import { createFallback, mountInApp, renderBoundary, unmountApps } from './helpers'

/** Reporters created by the `ErrorReporter` components, by name. */
const reporters: Map<string, UseErrorHandlingReturn> = new Map()

/** A component that keeps its reporter, to report errors from the tests. */
const ErrorReporter = defineComponent({
  name: 'ErrorReporter',
  props: { name: { type: String, default: 'default' } },
  setup(props) {
    reporters.set(props.name, useErrorHandling())
    return () => h('span', 'Content')
  },
})

/** Reports an error from the `ErrorReporter` component with the given name. */
function report(error: unknown, name = 'default'): void {
  reporters.get(name)?.report(error)
}

afterEach(() => {
  unmountApps()
  reporters.clear()
  vi.restoreAllMocks()
})

describe('useErrorHandling()', () => {
  describe('report()', () => {
    it('gives the error to the closest boundary', async () => {
      const onError = vi.fn()
      const onUnhandledError = vi.fn()
      const error: Error = new Error('Message failed')
      const { container } = mountInApp(
        () =>
          renderBoundary(
            {},
            { default: () => h(ErrorReporter), fallback: ({ error }) => `Fallback: ${error.message}` },
          ),
        { onError, onUnhandledError },
      )

      report(error)
      await nextTick()

      expect(container.textContent).toBe('Fallback: Message failed')
      expect(onError).toHaveBeenCalledExactlyOnceWith({
        source: 'reported',
        error,
        message: 'Message failed',
        instance: expect.objectContaining({ $options: expect.objectContaining({ name: 'ErrorReporter' }) }),
      })
      expect(onUnhandledError).not.toHaveBeenCalled()
    })

    it('gives the error to the app outside of a boundary', () => {
      const onUnhandledError = vi.fn()
      mountInApp(() => h(ErrorReporter), { onUnhandledError })

      report(new Error('Message failed'))

      expect(onUnhandledError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ source: 'reported' }))
    })

    it.each([
      // Doesn't handle the reported errors
      {
        case: 'filters them out',
        innerBoundary: () =>
          renderBoundary({ filter: ['setup'] }, { default: () => h(ErrorReporter), fallback: () => 'Inner' }),
      },
      // Can't display them
      { case: 'has no fallback', innerBoundary: () => renderBoundary({}, { default: () => h(ErrorReporter) }) },
    ])('gives the error to the parent boundaries when the closest one $case', async ({ innerBoundary }) => {
      const { container } = mountInApp(() =>
        renderBoundary({}, { default: innerBoundary, fallback: ({ error }) => `Outer: ${error.message}` }),
      )

      report(new Error('Message failed'))
      await nextTick()

      expect(container.textContent).toBe('Outer: Message failed')
    })

    it('gives the error to the app when no boundary can handle it', () => {
      const onUnhandledError = vi.fn()
      mountInApp(() => renderBoundary({}, { default: () => h(ErrorReporter) }), { onUnhandledError })

      report(new Error('Without fallback'))

      expect(onUnhandledError).toHaveBeenCalledOnce()
    })

    it('gives the errors reported from a fallback to the parent boundaries', async () => {
      const { container } = mountInApp(() =>
        renderBoundary(
          {},
          {
            default: () =>
              renderBoundary(
                { filter: ['reported'] },
                { default: () => h(ErrorReporter), fallback: () => h(ErrorReporter, { name: 'fallback' }) },
              ),
            fallback: ({ error }) => `Outer: ${error.message}`,
          },
        ),
      )

      report(new Error('Content failed'))
      await nextTick()
      report(new Error('Fallback failed'), 'fallback')
      await nextTick()

      expect(container.textContent).toBe('Outer: Fallback failed')
    })

    it('gives the errors reported after the boundary is unmounted to the app', async () => {
      const onUnhandledError = vi.fn()
      const isMounted = ref(true)
      mountInApp(
        () =>
          isMounted.value ? renderBoundary({}, { default: () => h(ErrorReporter), fallback: () => 'Fallback' }) : null,
        { onUnhandledError },
      )

      isMounted.value = false
      await nextTick()
      // e.g. from a timer that wasn't cleared
      report(new Error('Too late'))

      expect(onUnhandledError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: 'Too late' }))
    })

    it("doesn't give the ignored errors to the boundaries", async () => {
      const onError = vi.fn()
      const { container } = mountInApp(
        () => renderBoundary({}, { default: () => h(ErrorReporter), fallback: () => 'Fallback' }),
        { onError, ignore: () => true },
      )

      report(new Error('Ignored'))
      await nextTick()

      expect(container.textContent).toBe('Content')
      expect(onError).not.toHaveBeenCalled()
    })

    it('displays the content again on retry', async () => {
      const fallback = createFallback()
      const { container } = mountInApp(() =>
        renderBoundary({}, { default: () => h(ErrorReporter), fallback: fallback.slot }),
      )

      report(new Error('Message failed'))
      await nextTick()
      fallback.actions.at(-1)?.retry()
      await nextTick()

      expect(container.textContent).toBe('Content')
    })
  })

  describe('installation', () => {
    it('must be called in the setup of a component', () => {
      expect(() => useErrorHandling()).toThrow('must be called in the `setup()` of a component')
    })

    it('requires the error handling to be installed', () => {
      const errorHandler = vi.fn()
      const app: App = createApp(ErrorReporter)
      app.config.warnHandler = () => {}
      app.config.errorHandler = errorHandler
      app.mount(document.createElement('div'))
      app.unmount()

      expect(errorHandler).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ message: expect.stringContaining('useErrorHandling() requires the error handling') }),
        expect.anything(),
        'setup function',
      )
    })
  })
})
