import type { App, ComponentPublicInstance, VNodeChild } from 'vue'

/**
 * A route of the router, with the properties the apps commonly read. Declared here instead of imported from
 * `vue-router` (an optional peer dependency), so the apps without it don't need its types. The routes of Vue Router
 * 4 and 5 match it.
 */
export interface RouteLike {
  /** The path of the route, with its query and hash (e.g. `/users/42?tab=posts#bio`). */
  fullPath: string
  /** The path of the route, without its query and hash. */
  path: string
  /** The name of the route record, if any. */
  name?: string | symbol | null
  /** The params of the route. */
  params: Record<string, string | string[]>
  /** The query of the route. */
  query: Record<string, string | null | (string | null)[]>
  /** The hash of the route, including its `#`, or an empty string. */
  hash: string
  /** The meta fields of the route records, merged. */
  meta: Record<PropertyKey, unknown>
}

/**
 * The router of the app, with the methods the error handling uses. Declared here instead of imported from
 * `vue-router` (an optional peer dependency), so the apps without it don't need its types. The routers of Vue Router
 * 4 and 5 match it.
 */
export interface RouterLike {
  /** Adds a handler of the navigation errors. Returns a function that removes it. */
  onError(handler: (error: unknown, to: RouteLike, from: RouteLike) => unknown): () => void
  /** Adds a hook called after each navigation. Returns a function that removes it. */
  afterEach(guard: (to: RouteLike, from: RouteLike, failure?: unknown) => unknown): () => void
  /** Resolves the given path to its URL. */
  resolve(to: string): { href: string }
  /** Navigates to the given path. */
  push(to: string): Promise<unknown>
}

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
  /**
   * Whether a lazy loaded chunk failed to load (e.g. a page or an async component, after a new deployment).
   * Detected from Vite's `vite:preloadError` event (production builds only), and the `isChunkLoadError()` option.
   */
  isChunkLoadError: boolean
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

/** A promise rejected without being awaited or caught. */
export interface PromiseRejectionError extends CaughtErrorBase {
  source: 'promise'
  /** The `unhandledrejection` event dispatched by the browser (e.g. to get the rejected `promise`). */
  event: PromiseRejectionEvent
}

/** An error thrown outside of Vue (e.g. in a timer, or in a listener added with `addEventListener()`). */
export interface GlobalError extends CaughtErrorBase {
  source: 'global'
  /**
   * The `error` event dispatched by the browser (e.g. to get the file and line of the error).
   * For a script loaded from another origin without CORS, the browser hides the error: `error` is `null`, and the
   * message is `'Script error.'`.
   */
  event: ErrorEvent
}

/** An error reported by the app, with `report()`. */
export interface ReportedError extends CaughtErrorBase {
  source: 'reported'
  /** The component that reported the error (with `useErrorHandling()`), if any. */
  instance: ComponentPublicInstance | null
}

/** A navigation that failed: a navigation guard threw, or a page failed to load. */
export interface NavigationError extends CaughtErrorBase {
  source: 'navigation'
  /** The route the navigation was going to. */
  to: RouteLike
  /** The route the navigation was coming from. */
  from: RouteLike
}

/** An error caught by the error handling, with the context it was caught in. Narrow it with its `source`. */
export type CaughtError = ComponentError | PromiseRejectionError | GlobalError | ReportedError | NavigationError

/** Where an error was caught. */
export type ErrorSource = CaughtError['source']

/** Options of the error handling. */
export interface ErrorHandlingOptions {
  /** The router of the app, to handle the navigation errors. */
  router?: RouterLike
  /** Receives every caught error that is not ignored (e.g. to plug a monitoring service). Defaults to `console.error()`. */
  onError?: (caught: CaughtError) => void
  /**
   * Receives the caught errors that nothing else handled, after `onError()` (e.g. to display a notification).
   * An error with the same message is given again only after `throttleMs`.
   */
  onUnhandledError?: (caught: CaughtError) => void
  /** Returns `true` for the errors to ignore: they're given neither to `onError()` nor to `onUnhandledError()`. */
  ignore?: (caught: CaughtError) => boolean
  /**
   * Minimum delay (in milliseconds) before an error with the same message is given to `onUnhandledError()` again, so
   * a repeated error doesn't flood the screen. `0` disables it. Defaults to 5 seconds.
   */
  throttleMs?: number
  /**
   * Whether the page is loaded again when a navigation fails because a chunk can't be loaded (e.g. after a new
   * deployment, the chunks of the previous version are no longer served). At most once every 10 seconds. Defaults to
   * `true`.
   */
  reloadOnChunkLoadError?: boolean
  /**
   * Returns `true` for the errors that are failures to load a chunk, in addition to the ones reported by Vite (e.g.
   * with another bundler). Vite's are detected out of the box, from its `vite:preloadError` event (production builds
   * only).
   */
  isChunkLoadError?: (error: unknown) => boolean
}

/** The error handling of an app, to install as a Vue plugin with `app.use()`. */
export interface ErrorHandling {
  /** Registers the error handlers on the app and the window. They're removed when the app is unmounted. */
  install(app: App): void
  /**
   * Reports an error caught by the app (e.g. in a `try...catch`), so it's handled like the others.
   * It skips the error boundaries: in a component, use the `report()` of `useErrorHandling()` instead.
   */
  report(error: unknown): void
}

/** What `useErrorHandling()` returns. */
export interface UseErrorHandlingReturn {
  /**
   * Reports an error caught by the component (e.g. in a `try...catch`, or in a callback that Vue doesn't call).
   * It goes to the closest error boundary first, then to the parent boundaries, then to the app (like a thrown error).
   */
  report(error: unknown): void
}

/** An error that error boundaries can handle: thrown or reported by a component, or a navigation error. */
export type BoundaryError = ComponentError | ReportedError | NavigationError

/**
 * The errors an error boundary handles: a list of phases (and `'reported'` for the reported errors), or a function
 * that returns `true` for the errors to handle. The navigation errors are handled with the `navigation` prop instead.
 */
export type ErrorFilter = (VuePhase | 'reported')[] | ((caught: ComponentError | ReportedError) => boolean)

/** Props of the `ErrorBoundary` component. */
export interface ErrorBoundaryProps {
  /**
   * The errors this boundary handles. The others continue to the parent boundaries, then to the app.
   * Defaults to the errors that prevent the content from being displayed (`setup`, `render`, `mount`, `asyncComponent`),
   * and the reported errors.
   */
  filter?: ErrorFilter
  /**
   * Makes this boundary display the navigation errors (e.g. around the router view): a navigation guard that threw,
   * or a page that failed to load. Its error is cleared after each successful navigation.
   * Use a single navigation boundary: with several, the first one mounted displays the errors.
   */
  navigation?: boolean
}

/** Actions given to the slots of an error boundary. */
export interface ErrorBoundaryActions {
  /**
   * Clears the error, and displays the content again from scratch (e.g. an async component loads again).
   * For a navigation error, navigates to the page again.
   */
  retry(): void
  /** Clears the error, without displaying the content again from scratch. */
  clear(): void
}

/** Slots of the `ErrorBoundary` component. */
export interface ErrorBoundarySlots {
  /** The content. Receives the handled error that left the content usable (e.g. in an event handler), if any. */
  default?(props: ErrorBoundaryActions & { error: BoundaryError | null }): VNodeChild
  /** Displayed instead of the content when it can't be displayed. Without it, the boundary doesn't handle these errors. */
  fallback?(props: ErrorBoundaryActions & { error: BoundaryError }): VNodeChild
}
