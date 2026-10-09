// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { type App, createSSRApp, defineComponent, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { createErrorHandling } from '@/errorHandling'
import type { ErrorHandlingOptions } from '@/types'
import { FailingSetup, renderBoundary } from './helpers'

/** Creates an app to render on the server, with the error handling installed. */
function createServerApp(render: () => ReturnType<typeof h>, options: ErrorHandlingOptions = {}): App {
  const app: App = createSSRApp(defineComponent({ setup: () => render }))
  // Vue warns about the components that can't render after an error
  app.config.warnHandler = () => {}
  app.use(createErrorHandling({ onError: () => {}, ...options }))
  return app
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('server-side rendering', () => {
  it('runs without a window', () => {
    expect(typeof window).toBe('undefined')
  })

  it('installs the error handling, and renders the app', async () => {
    const app: App = createServerApp(() => h('p', 'Rendered'))

    expect(await renderToString(app)).toBe('<p>Rendered</p>')
  })

  it('gives the errors of the components to `onError()`', async () => {
    const onError = vi.fn()
    const app: App = createServerApp(() => h(FailingSetup), { onError })

    await renderToString(app)

    expect(onError).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ source: 'component', phase: 'setup', message: 'Setup failed' }),
      { handledBy: null },
    )
  })

  it('handles the chunk loading failures of the navigations like the other errors', async () => {
    const onUnhandledError = vi.fn()
    const router: Router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: () => Promise.reject(new Error('Chunk failed')) }],
    })
    const app: App = createServerApp(() => h('p'), { router, onUnhandledError, isChunkLoadError: () => true })
    app.use(router)

    try {
      await router.push('/')
    } catch {
      // Handled by `router.onError()`
    }

    // Not reloaded: there's no page to load on a server
    expect(onUnhandledError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ isChunkLoadError: true }))
  })

  it('handles the errors in the boundaries, but renders their failed content instead of their fallback', async () => {
    const onError = vi.fn()
    const app: App = createServerApp(
      () =>
        h('div', [
          h('p', 'Before'),
          renderBoundary({}, { default: () => h(FailingSetup), fallback: () => h('p', 'Fallback') }),
          h('p', 'After'),
        ]),
      { onError },
    )

    const html: string = await renderToString(app)

    // The server renders in a single pass: the boundary is already rendered when its content fails
    expect(html).toMatch(/^<div><p>Before<\/p>.*<p>After<\/p><\/div>$/)
    expect(html).not.toContain('Fallback')
    expect(onError).toHaveBeenCalledExactlyOnceWith(expect.anything(), { handledBy: { name: undefined } })
  })
})
