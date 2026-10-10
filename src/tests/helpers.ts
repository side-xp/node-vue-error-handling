import { type App, createApp, defineComponent, h, type VNodeChild } from 'vue'
import type { Router } from 'vue-router'
import { ErrorBoundary } from '@/errorBoundary'
import { createErrorHandling } from '@/errorHandling'
import { LOG_PREFIX } from '@/errorLogging'
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

/**
 * Options of the error handling, with a router of Vue Router to install it on the app (the error handling only needs a
 * `RouterLike`), and a function that receives the warnings of the library.
 */
export type MountOptions = Omit<ErrorHandlingOptions, 'router'> & {
  router?: Router
  onWarn?: (message: string) => void
}

/**
 * Mounts the given render function in an app with the error handling installed, and the router of the options if any.
 * Returns the app and its container.
 */
export function mountInApp(render: () => VNodeChild, options: MountOptions = {}): { app: App; container: HTMLElement } {
  const { onWarn, ...errorHandlingOptions } = options
  const container: HTMLElement = document.createElement('div')
  const app: App = createApp(defineComponent({ setup: () => render }))
  // Only the warnings of the library: Vue also warns about the components that can't render after an error
  app.config.warnHandler = (message) => {
    if (message.startsWith(LOG_PREFIX)) {
      onWarn?.(message)
    }
  }
  app.use(createErrorHandling({ onError: () => {}, ...errorHandlingOptions }))
  if (options.router) {
    app.use(options.router)
  }
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
