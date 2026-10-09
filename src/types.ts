import type { App, ComponentPublicInstance } from 'vue'

/** Phase of a component in which Vue caught an error, normalized from the different forms of the `info` given by Vue. */
export type VuePhase =
  /** The setup of a component (including `<script setup>`, and the `beforeCreate` and `created` hooks). */
  | 'setup'
  /** The render of a component, on mount or after a data change. */
  | 'render'
  /** The `beforeMount` or `mounted` hooks. */
  | 'mount'
  /** The `beforeUpdate` or `updated` hooks, or a component update. */
  | 'update'
  /** The `beforeUnmount` or `unmounted` hooks. */
  | 'unmount'
  /** Other lifecycle hooks (e.g. `activated`, `errorCaptured`). */
  | 'hook'
  /** The getter, callback or cleanup of a watcher. */
  | 'watcher'
  /** An event handler declared in a template (native or component event). */
  | 'eventHandler'
  /** The loader of an async component (`defineAsyncComponent()`). */
  | 'asyncComponent'
  /** Other errors caught by Vue (e.g. directives, transitions, template refs, scheduler). */
  | 'other'

/** Properties shared by all the caught errors. */
interface CaughtErrorBase {
  /** The thrown value, as is. */
  error: unknown
  /** A readable message, from any thrown value. */
  message: string
}

/** An error thrown by a component, and caught by Vue. */
export interface ComponentError extends CaughtErrorBase {
  source: 'component'
  /** The phase of the component in which the error happened. */
  phase: VuePhase
  /** The `info` given by Vue to the error hooks, as is (its form differs between development and production builds). */
  vueInfo: string
  /** The component in which the error happened, if any. */
  instance: ComponentPublicInstance | null
}

/** An error caught by the error handling, with the context it was caught in. Narrow it with its `source`. */
export type CaughtError = ComponentError

/** Where an error was caught. */
export type ErrorSource = CaughtError['source']

/** Options of the error handling. */
export interface ErrorHandlingOptions {
  /** Receives every caught error (e.g. to plug a monitoring service). Defaults to `console.error()`. */
  onError?: (caught: CaughtError) => void
}

/** The error handling of an app, to install as a Vue plugin with `app.use()`. */
export interface ErrorHandling {
  /** Registers the error handlers on the app. */
  install(app: App): void
}
