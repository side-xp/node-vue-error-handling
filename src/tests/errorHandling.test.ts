import { afterEach, describe, expect, it, vi } from 'vitest'
import { type App, type Component, createApp, defineComponent, h, nextTick, onMounted, ref, watch } from 'vue'
import { createErrorHandling } from '@/errorHandling'
import type { CaughtError, ErrorHandlingOptions } from '@/types'

/** Apps mounted by the current test, unmounted after it. */
const mountedApps: App[] = []

/** Mounts the given component in an app with the error handling installed. */
function mountWithErrorHandling(component: Component, options: ErrorHandlingOptions = {}): HTMLElement {
  const container: HTMLElement = document.createElement('div')
  const app: App = createApp(component)
  // Vue warns about the components that can't render after an error
  app.config.warnHandler = () => {}
  app.use(createErrorHandling(options))
  app.mount(container)
  mountedApps.push(app)
  return container
}

/** Mounts a button that throws an error with the given message when clicked. Returns a function that clicks it. */
function mountErrorTrigger(options: ErrorHandlingOptions): (message: string) => void {
  let nextMessage = ''
  const ErrorTrigger = defineComponent({
    setup() {
      return () =>
        h('button', {
          onClick: () => {
            throw new Error(nextMessage)
          },
        })
    },
  })

  const container: HTMLElement = mountWithErrorHandling(ErrorTrigger, options)
  return (message) => {
    nextMessage = message
    container.querySelector('button')?.click()
  }
}

/** Mounts the given component, and returns the errors given to `onError()`. */
function collectErrors(component: Component): CaughtError[] {
  const caughtErrors: CaughtError[] = []
  mountWithErrorHandling(component, { onError: (caught) => caughtErrors.push(caught) })
  return caughtErrors
}

afterEach(() => {
  for (const app of mountedApps.splice(0)) {
    app.unmount()
  }
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('createErrorHandling()', () => {
  describe('component errors', () => {
    it('normalizes an error thrown in the setup', () => {
      const error: Error = new Error('Setup failed')
      const Faulty = defineComponent({
        name: 'FaultyComponent',
        setup() {
          throw error
        },
      })

      const [caught] = collectErrors(Faulty)

      expect(caught).toEqual({
        source: 'component',
        error,
        message: 'Setup failed',
        phase: 'setup',
        vueInfo: 'setup function',
        instance: expect.anything(),
      })
      expect(caught?.instance?.$options.name).toBe('FaultyComponent')
    })

    it('normalizes the phase of the error', async () => {
      const shouldRenderFail = ref(false)
      const watched = ref(0)
      const Faulty = defineComponent({
        setup() {
          onMounted(() => {
            throw new Error('Mount failed')
          })
          watch(watched, () => {
            throw new Error('Watcher failed')
          })
          return () => {
            if (shouldRenderFail.value) {
              throw new Error('Render failed')
            }
            return h('button', {
              onClick: () => {
                throw new Error('Click failed')
              },
            })
          }
        },
      })

      const caughtErrors: CaughtError[] = []
      const container: HTMLElement = mountWithErrorHandling(Faulty, { onError: (caught) => caughtErrors.push(caught) })
      container.querySelector('button')?.click()
      watched.value++
      await nextTick()
      shouldRenderFail.value = true
      await nextTick()

      expect(caughtErrors.map(({ message, phase }) => [message, phase])).toEqual([
        ['Mount failed', 'mount'],
        ['Click failed', 'eventHandler'],
        ['Watcher failed', 'watcher'],
        ['Render failed', 'render'],
      ])
    })

    it('catches the rejections of async event handlers', async () => {
      const Faulty = defineComponent({
        setup() {
          return () =>
            h('button', {
              onClick: async () => {
                throw new Error('Async click failed')
              },
            })
        },
      })

      const caughtErrors: CaughtError[] = []
      const container: HTMLElement = mountWithErrorHandling(Faulty, { onError: (caught) => caughtErrors.push(caught) })
      container.querySelector('button')?.click()
      await vi.waitFor(() => expect(caughtErrors).toHaveLength(1))

      expect(caughtErrors[0]).toMatchObject({ message: 'Async click failed', phase: 'eventHandler' })
    })
  })

  describe('messages', () => {
    /** Gets the message of the error created from the given thrown value. */
    function getMessage(thrown: unknown): string | undefined {
      const Faulty = defineComponent({
        setup() {
          throw thrown
        },
      })
      return collectErrors(Faulty)[0]?.message
    }

    it('uses the name of an error without message', () => {
      expect(getMessage(new TypeError())).toBe('TypeError')
    })

    it('converts the values that are not errors', () => {
      expect(getMessage('Something failed')).toBe('Something failed')
      expect(getMessage(404)).toBe('404')
    })

    it('falls back to a generic message for the values that cannot be converted', () => {
      expect(getMessage(Object.create(null))).toBe('Unknown error')
    })
  })

  describe('unhandled errors', () => {
    it('gives the errors to `onUnhandledError()` after `onError()`', () => {
      const calls: string[] = []
      const throwError = mountErrorTrigger({
        onError: (caught) => calls.push(`onError: ${caught.message}`),
        onUnhandledError: (caught) => calls.push(`onUnhandledError: ${caught.message}`),
      })

      throwError('Failed')

      expect(calls).toEqual(['onError: Failed', 'onUnhandledError: Failed'])
    })

    it('skips the ignored errors', () => {
      const onError = vi.fn()
      const onUnhandledError = vi.fn()
      const throwError = mountErrorTrigger({
        onError,
        onUnhandledError,
        ignore: (caught) => caught.message === 'Ignored',
      })

      throwError('Ignored')
      throwError('Not ignored')

      expect(onError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: 'Not ignored' }))
      expect(onUnhandledError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: 'Not ignored' }))
    })
  })

  describe('throttling', () => {
    it('gives an error with the same message to `onUnhandledError()` again only after the delay', () => {
      vi.useFakeTimers()
      const onError = vi.fn()
      const onUnhandledError = vi.fn()
      const throwError = mountErrorTrigger({ onError, onUnhandledError, throttleMs: 1_000 })

      throwError('Repeated')
      vi.advanceTimersByTime(999)
      throwError('Repeated')
      expect(onUnhandledError).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(1)
      throwError('Repeated')
      expect(onUnhandledError).toHaveBeenCalledTimes(2)
      // Every error is still given to `onError()`
      expect(onError).toHaveBeenCalledTimes(3)
    })

    it('throttles each message separately', () => {
      const onUnhandledError = vi.fn()
      const throwError = mountErrorTrigger({ onUnhandledError, onError: () => {} })

      throwError('First')
      throwError('Second')
      throwError('First')

      expect(onUnhandledError.mock.calls.map(([caught]) => caught.message)).toEqual(['First', 'Second'])
    })

    it('can be disabled', () => {
      const onUnhandledError = vi.fn()
      const throwError = mountErrorTrigger({ onUnhandledError, onError: () => {}, throttleMs: 0 })

      throwError('Repeated')
      throwError('Repeated')

      expect(onUnhandledError).toHaveBeenCalledTimes(2)
    })
  })

  describe('failing callbacks', () => {
    it('only logs the errors of `onError()` and `onUnhandledError()`', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const onErrorFailure: Error = new Error('onError failed')
      const onUnhandledErrorFailure: Error = new Error('onUnhandledError failed')
      const onUnhandledError = vi.fn(() => {
        throw onUnhandledErrorFailure
      })
      const throwError = mountErrorTrigger({
        onError: () => {
          throw onErrorFailure
        },
        onUnhandledError,
      })

      throwError('Failed')

      // A failing `onError()` doesn't prevent `onUnhandledError()`
      expect(onUnhandledError).toHaveBeenCalledOnce()
      expect(consoleError.mock.calls).toEqual([[onErrorFailure], [onUnhandledErrorFailure]])
    })

    it("doesn't ignore an error when `ignore()` fails", () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const ignoreFailure: Error = new Error('ignore failed')
      const onError = vi.fn()
      const throwError = mountErrorTrigger({
        onError,
        ignore: () => {
          throw ignoreFailure
        },
      })

      throwError('Failed')

      expect(onError).toHaveBeenCalledOnce()
      expect(consoleError).toHaveBeenCalledWith(ignoreFailure)
    })
  })

  describe('installation', () => {
    it('logs the errors to the console by default', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error: Error = new Error('Setup failed')
      const Faulty = defineComponent({
        setup() {
          throw error
        },
      })

      mountWithErrorHandling(Faulty)

      expect(consoleError).toHaveBeenCalledWith(error)
    })

    it('keeps the error handler set before it', () => {
      const previousErrorHandler = vi.fn()
      const error: Error = new Error('Setup failed')
      const Faulty = defineComponent({
        setup() {
          throw error
        },
      })

      const app: App = createApp(Faulty)
      app.config.warnHandler = () => {}
      app.config.errorHandler = previousErrorHandler
      app.use(createErrorHandling({ onError: () => {} }))
      app.mount(document.createElement('div'))
      mountedApps.push(app)

      expect(previousErrorHandler).toHaveBeenCalledWith(error, expect.anything(), 'setup function')
    })
  })
})
