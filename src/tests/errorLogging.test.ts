import { afterEach, describe, expect, it, type MockInstance, vi } from 'vitest'
import { type Component, defineComponent, h, nextTick, onMounted } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { createErrorHandling } from '@/errorHandling'
import { useErrorHandling } from '@/useErrorHandling'
import { FailingSetup, type MountOptions, mountInApp, renderBoundary, unmountApps } from './helpers'

/** Spies on `console.error()`, without logging anything. */
function spyOnConsoleError(): MockInstance<typeof console.error> {
  return vi.spyOn(console, 'error').mockImplementation(() => {})
}

/** Mounts the given component in an app with the default `onError()`, which logs the errors. */
function mountWithDefaultLogging(component: Component, options: MountOptions = {}): void {
  mountInApp(() => h(component), { ...options, onError: undefined })
}

afterEach(() => {
  unmountApps()
  vi.restoreAllMocks()
})

describe('default logging', () => {
  it('logs the phase and the component trace of the component errors', () => {
    const consoleError = spyOnConsoleError()
    const ParentView = defineComponent({ name: 'ParentView', render: () => h(FailingSetup) })

    mountWithDefaultLogging(ParentView)

    expect(consoleError).toHaveBeenCalledExactlyOnceWith(
      '[vue-error-handling] Component error (phase: setup)\n  at <FailingSetup>\n  at <ParentView>\n  at <Anonymous>',
      expect.objectContaining({ message: 'Setup failed' }),
    )
  })

  it('logs the component trace of the reported errors', () => {
    const consoleError = spyOnConsoleError()
    const error: Error = new Error('Report failed')
    const ErrorReporter = defineComponent({
      name: 'ErrorReporter',
      setup() {
        const { report } = useErrorHandling()
        onMounted(() => report(error))
        return () => null
      },
    })

    mountWithDefaultLogging(ErrorReporter)

    expect(consoleError).toHaveBeenCalledExactlyOnceWith(
      '[vue-error-handling] Reported error\n  at <ErrorReporter>\n  at <Anonymous>',
      error,
    )
  })

  it('logs the reported errors without component', () => {
    const consoleError = spyOnConsoleError()
    const error: Error = new Error('Report failed')

    createErrorHandling().report(error)

    expect(consoleError).toHaveBeenCalledExactlyOnceWith('[vue-error-handling] Reported error', error)
  })

  it('logs the promises rejected without being caught', () => {
    const consoleError = spyOnConsoleError()
    const error: Error = new Error('Request failed')
    const promise: Promise<never> = Promise.reject(error)
    // Prevents an actual unhandled rejection in the test runner
    promise.catch(() => {})
    mountWithDefaultLogging(defineComponent({ render: () => null }))

    window.dispatchEvent(new PromiseRejectionEvent('unhandledrejection', { promise, reason: error, cancelable: true }))

    expect(consoleError).toHaveBeenCalledExactlyOnceWith('[vue-error-handling] Unhandled promise rejection', error)
  })

  it('logs the location of the errors thrown outside of Vue', () => {
    const consoleError = spyOnConsoleError()
    const error: Error = new Error('Timer failed')
    mountWithDefaultLogging(defineComponent({ render: () => null }))

    window.dispatchEvent(
      new ErrorEvent('error', {
        error,
        message: error.message,
        filename: 'app.js',
        lineno: 12,
        colno: 5,
        cancelable: true,
      }),
    )

    expect(consoleError).toHaveBeenCalledExactlyOnceWith('[vue-error-handling] Uncaught error (at app.js:12:5)', error)
  })

  it('logs the message when the browser hides the error of a script from another origin', () => {
    const consoleError = spyOnConsoleError()
    mountWithDefaultLogging(defineComponent({ render: () => null }))

    window.dispatchEvent(new ErrorEvent('error', { error: null, message: 'Script error.', cancelable: true }))

    expect(consoleError).toHaveBeenCalledExactlyOnceWith('[vue-error-handling] Uncaught error', 'Script error.')
  })

  it('logs the target route of the navigation errors', async () => {
    const consoleError = spyOnConsoleError()
    const error: Error = new Error('Guard failed')
    const router: Router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { render: () => null } },
        {
          path: '/guarded',
          component: { render: () => null },
          beforeEnter: () => {
            throw error
          },
        },
      ],
    })
    mountWithDefaultLogging(defineComponent({ render: () => null }), { router })

    try {
      await router.push('/guarded')
    } catch {
      // Handled by `router.onError()`
    }

    expect(consoleError).toHaveBeenCalledExactlyOnceWith('[vue-error-handling] Navigation error (to: /guarded)', error)
  })

  it('logs the boundary that handled the error', async () => {
    const consoleError = spyOnConsoleError()
    mountInApp(() => renderBoundary({ name: 'sidebar' }, { default: () => h(FailingSetup), fallback: () => null }), {
      onError: undefined,
    })

    await nextTick()

    expect(consoleError).toHaveBeenCalledExactlyOnceWith(
      expect.stringMatching(
        /^\[vue-error-handling\] Component error \(phase: setup, handled by <ErrorBoundary name="sidebar">\)\n/,
      ),
      expect.objectContaining({ message: 'Setup failed' }),
    )
  })

  it('logs the chunk loading failures', () => {
    const consoleError = spyOnConsoleError()
    const error: Error = new Error('Chunk failed')

    createErrorHandling({ isChunkLoadError: () => true }).report(error)

    expect(consoleError).toHaveBeenCalledExactlyOnceWith(
      '[vue-error-handling] Reported error (chunk loading failure)',
      error,
    )
  })
})
