import { type App, createApp, defineComponent, h, type VNodeChild } from 'vue'
import { ErrorBoundary } from '@/errorBoundary'
import { createErrorHandling } from '@/errorHandling'
import type { ErrorBoundaryActions, ErrorBoundaryProps, ErrorBoundarySlots, ErrorHandlingOptions } from '@/types'

/** Apps mounted by the current test, unmounted by `unmountApps()`. */
const mountedApps: App[] = []

/** A component that fails in its setup. */
export const FailingSetup = defineComponent({
  name: 'FailingSetup',
  setup() {
    throw new Error('Setup failed')
  },
})

/** A button that fails when clicked. */
export const FailingButton = defineComponent({
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

/** Mounts the given render function in an app with the error handling installed. Returns the app and its container. */
export function mountInApp(
  render: () => VNodeChild,
  options: ErrorHandlingOptions = {},
): { app: App; container: HTMLElement } {
  const container: HTMLElement = document.createElement('div')
  const app: App = createApp(defineComponent({ setup: () => render }))
  // Vue warns about the components that can't render after an error
  app.config.warnHandler = () => {}
  app.use(createErrorHandling({ onError: () => {}, ...options }))
  app.mount(container)
  mountedApps.push(app)
  return { app, container }
}

/** Unmounts the apps mounted by the current test. */
export function unmountApps(): void {
  for (const app of mountedApps.splice(0)) {
    app.unmount()
  }
}

/**
 * Slots of an error boundary, as given to `h()`.
 * A mapped type, since `h()` doesn't accept an interface (it has no index signature).
 */
type BoundarySlots = { [Name in keyof ErrorBoundarySlots]: ErrorBoundarySlots[Name] }

/** Renders an error boundary with the given props and slots. */
export function renderBoundary(props: ErrorBoundaryProps, slots: BoundarySlots): VNodeChild {
  return h(ErrorBoundary, props, slots)
}

/** A fallback slot that displays the error message, and keeps the actions it receives. */
export function createFallback(): {
  slot: Required<ErrorBoundarySlots>['fallback']
  actions: ErrorBoundaryActions[]
} {
  const actions: ErrorBoundaryActions[] = []
  return {
    actions,
    slot: ({ error, ...slotActions }) => {
      actions.push(slotActions)
      return h('p', { class: 'fallback' }, `Fallback: ${error.message}`)
    },
  }
}
