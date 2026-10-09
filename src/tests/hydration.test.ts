import { afterEach, describe, expect, it, type MockInstance, vi } from 'vitest'
import { type App, type Component, createSSRApp, defineComponent, h, nextTick } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createErrorHandling } from '@/errorHandling'
import { renderBoundary } from './helpers'

/** Apps hydrated by the current test, unmounted after it. */
const hydratedApps: App[] = []

/** Whether the current render is the one of the server. */
let isServer = true

/** Whether `FailingSetup` also fails in the browser. */
let shouldFailInBrowser = true

/** A component that fails in its setup on the server, and in the browser while `shouldFailInBrowser` is `true`. */
const FailingSetup = defineComponent({
  name: 'FailingSetup',
  setup() {
    if (isServer || shouldFailInBrowser) {
      throw new Error('Setup failed')
    }
    return () => h('p', 'Content')
  },
})

/** Root of the app: a boundary around the failing component, between 2 paragraphs. */
const Root: Component = defineComponent({
  setup: () => () =>
    h('div', [
      h('p', 'Before'),
      renderBoundary({}, { default: () => h(FailingSetup), fallback: () => h('p', 'Fallback') }),
      h('p', 'After'),
    ]),
})

/** Creates the app, with the error handling installed. */
function createApp(): App {
  const app: App = createSSRApp(Root)
  // Vue warns about the components that can't render after an error, and about the hydration mismatches
  app.config.warnHandler = () => {}
  app.use(createErrorHandling({ onError: () => {} }))
  return app
}

/** Renders the app on the "server", then hydrates it in the browser. Returns the container of the app. */
async function renderThenHydrate(): Promise<HTMLElement> {
  isServer = true
  const html: string = await renderToString(createApp())

  isServer = false
  const container: HTMLElement = document.createElement('div')
  container.innerHTML = html
  const app: App = createApp()
  app.mount(container)
  hydratedApps.push(app)
  await nextTick()
  return container
}

/** Spies on `console.error()`, where Vue reports the hydration mismatches, without logging anything. */
function spyOnConsoleError(): MockInstance<typeof console.error> {
  return vi.spyOn(console, 'error').mockImplementation(() => {})
}

afterEach(() => {
  for (const app of hydratedApps.splice(0)) {
    app.unmount()
  }
  shouldFailInBrowser = true
  vi.restoreAllMocks()
})

describe('hydration', () => {
  it('displays the fallback of a boundary whose content also fails in the browser, without mismatch', async () => {
    const consoleError = spyOnConsoleError()

    const container: HTMLElement = await renderThenHydrate()

    expect(container.textContent).toBe('BeforeFallbackAfter')
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('displays the content of a boundary that only failed on the server, with a mismatch', async () => {
    const consoleError = spyOnConsoleError()
    shouldFailInBrowser = false

    const container: HTMLElement = await renderThenHydrate()

    expect(container.textContent).toBe('BeforeContentAfter')
    // The server rendered the failed content (empty): Vue reports it, and renders the content in the browser
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('Hydration completed but contains mismatches'))
  })
})
