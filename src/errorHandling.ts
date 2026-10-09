import { type App, type AppConfig, type InjectionKey, inject } from 'vue'
import {
  createComponentError,
  createGlobalError,
  createNavigationError,
  createPromiseRejectionError,
  createReportedError,
} from './caughtErrors'
import { isViteChunkLoadError, trackChunkLoadErrors, tryReloadPage } from './chunkLoadErrors'
import { isHandled, markAsHandled } from './handledErrors'
import { callSafely, logError } from './safeCalls'
import type { CaughtError, ErrorHandling, ErrorHandlingOptions, NavigationError } from './types'

/** Default minimum delay before an error with the same message is given to `onUnhandledError()` again. */
const DEFAULT_THROTTLE_MS = 5_000

/** What the error handling gets from a navigation boundary, to give it the navigation errors. */
export interface NavigationBoundaryHandle {
  /** Displays the given navigation error, if the boundary can. Returns `true` if it handled it. */
  handleNavigationError(caught: NavigationError): boolean
  /** Clears the error of the boundary, after a successful navigation. */
  clearAfterNavigation(): void
}

/** What the error boundaries and `useErrorHandling()` get from the error handling installed on the app. */
export interface ErrorHandlingContext {
  /** Checks if the given error is a failure to load a chunk (reported by Vite, or detected by the app). */
  isChunkLoadError(error: unknown): boolean
  /** Checks if the app ignores the given error. */
  isIgnored(caught: CaughtError): boolean
  /** Gives an error handled by an error boundary to `onError()`, unless it was already handled. */
  handleBoundaryError(caught: CaughtError): void
  /** Gives an error that no error boundary handled to the app, unless it was already handled or it's ignored. */
  handleUnhandledError(caught: CaughtError): void
  /** Registers a navigation boundary, to give it the navigation errors. Returns a function that unregisters it. */
  registerNavigationBoundary(boundary: NavigationBoundaryHandle): () => void
  /** Navigates again to the page of the given navigation error. */
  retryNavigation(caught: NavigationError): Promise<void>
}

/** Injection key of the error handling installed on the app. */
const ERROR_HANDLING_KEY: InjectionKey<ErrorHandlingContext> = Symbol('errorHandling')

/** Gets the error handling installed on the app, for the given feature (named in the error if it's not installed). */
export function injectErrorHandling(feature: string): ErrorHandlingContext {
  const context: ErrorHandlingContext | undefined = inject(ERROR_HANDLING_KEY, undefined)
  if (!context) {
    throw new Error(`${feature} requires the error handling: install it with \`app.use(createErrorHandling())\` first.`)
  }
  return context
}

/** Logs a caught error to the console, as Vue does when the app has no error handler. */
function logCaughtError(caught: CaughtError): void {
  logError(caught.error)
}

/** Creates the error handling of an app: catches the errors, normalizes them, and gives them to the app. */
export function createErrorHandling(options: ErrorHandlingOptions = {}): ErrorHandling {
  const {
    router,
    onError = logCaughtError,
    onUnhandledError,
    ignore,
    throttleMs = DEFAULT_THROTTLE_MS,
    reloadOnChunkLoadError = true,
    isChunkLoadError: isAppChunkLoadError,
  } = options

  /** Navigation boundaries currently mounted, in the order they were mounted. */
  const navigationBoundaries: Set<NavigationBoundaryHandle> = new Set()

  /** Timestamp of the last time an error with each message was given to `onUnhandledError()`. */
  const lastUnhandledTimestamps: Map<string, number> = new Map()

  /** Checks if an error with the given message was given to `onUnhandledError()` recently, and records it otherwise. */
  function isThrottled(message: string): boolean {
    const now: number = Date.now()
    // Forgets the messages older than the delay, so the map only keeps the recent ones
    for (const [recordedMessage, timestamp] of lastUnhandledTimestamps) {
      if (now - timestamp >= throttleMs) {
        lastUnhandledTimestamps.delete(recordedMessage)
      }
    }

    if (lastUnhandledTimestamps.has(message)) {
      return true
    }
    lastUnhandledTimestamps.set(message, now)
    return false
  }

  /** Checks if the given error is a failure to load a chunk: reported by Vite, or detected by the app. */
  function isChunkLoadError(error: unknown): boolean {
    return (
      isViteChunkLoadError(error) ||
      (isAppChunkLoadError !== undefined && callSafely(isAppChunkLoadError, error) === true)
    )
  }

  /** Checks if the app ignores the given error. An `ignore()` that fails doesn't ignore it, so it can't disappear silently. */
  function isIgnored(caught: CaughtError): boolean {
    return ignore !== undefined && callSafely(ignore, caught) === true
  }

  /** Gives an error that nothing else handled to the app, unless it was already handled or it's ignored. */
  function handleError(caught: CaughtError): void {
    // The same error can reach several handlers (e.g. reported, then rethrown)
    if (isHandled(caught.error)) {
      return
    }
    markAsHandled(caught.error)

    if (isIgnored(caught)) {
      return
    }

    callSafely(onError, caught)
    // Also prevents an infinite loop if `onUnhandledError()` itself causes the same error
    if (onUnhandledError && !isThrottled(caught.message)) {
      callSafely(onUnhandledError, caught)
    }
  }

  /** Registers the handlers of the errors thrown outside of Vue. Returns a function that removes them. */
  function handleWindowErrors(): () => void {
    // Promises rejected without being awaited or caught
    const onUnhandledRejection = (event: PromiseRejectionEvent): void => {
      // The error is given to `onError()` instead, which logs it by default (as Vue does with the component errors)
      event.preventDefault()
      handleError(createPromiseRejectionError(event, isChunkLoadError))
    }

    // Errors thrown outside of Vue (e.g. in timers, or in listeners added with `addEventListener()`)
    const onWindowError = (event: ErrorEvent): void => {
      event.preventDefault()
      handleError(createGlobalError(event, isChunkLoadError))
    }

    window.addEventListener('unhandledrejection', onUnhandledRejection)
    window.addEventListener('error', onWindowError)
    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
      window.removeEventListener('error', onWindowError)
    }
  }

  /** Registers the handlers of the navigation errors. Returns a function that removes them. */
  function handleNavigationErrors(): () => void {
    if (!router) {
      return () => {}
    }

    const removeErrorHandler: () => void = router.onError((error, to, from) => {
      // A new deployment may have removed the chunks of the running version: loading the page again gets the new ones
      if (reloadOnChunkLoadError && isChunkLoadError(error) && tryReloadPage(router.resolve(to).href)) {
        markAsHandled(error)
        return
      }

      const caught: NavigationError = createNavigationError(error, to, from, isChunkLoadError)
      // No component threw it: it can only be displayed by a navigation boundary
      for (const boundary of navigationBoundaries) {
        if (boundary.handleNavigationError(caught)) {
          return
        }
      }
      handleError(caught)
    })

    // Clears the errors of the navigation boundaries, so the user can leave an error with any link or the back button
    const removeAfterEach: () => void = router.afterEach((_to, _from, failure) => {
      if (failure) {
        return
      }
      for (const boundary of navigationBoundaries) {
        boundary.clearAfterNavigation()
      }
    })

    return () => {
      removeErrorHandler()
      removeAfterEach()
    }
  }

  const context: ErrorHandlingContext = {
    isChunkLoadError,
    isIgnored,

    handleBoundaryError(caught: CaughtError): void {
      if (isHandled(caught.error)) {
        return
      }
      markAsHandled(caught.error)
      callSafely(onError, caught)
    },

    handleUnhandledError: handleError,

    registerNavigationBoundary(boundary: NavigationBoundaryHandle): () => void {
      navigationBoundaries.add(boundary)
      return () => {
        navigationBoundaries.delete(boundary)
      }
    },

    async retryNavigation(caught: NavigationError): Promise<void> {
      try {
        await router?.push(caught.to.fullPath)
      } catch {
        // A new navigation error is handled by `router.onError()`
      }
    },
  }

  return {
    install(app: App): void {
      // An error handler set before this one still receives the errors
      const previousErrorHandler: AppConfig['errorHandler'] = app.config.errorHandler

      // Errors of the components that no error boundary handled
      app.config.errorHandler = (error, instance, info) => {
        handleError(createComponentError(error, instance, info, isChunkLoadError))
        if (previousErrorHandler) {
          // Like the other callbacks of the app, an error thrown by it is only logged
          callSafely(previousErrorHandler, error, instance, info)
        }
      }

      const removeHandlers: (() => void)[] = [trackChunkLoadErrors(), handleWindowErrors(), handleNavigationErrors()]
      app.onUnmount(() => {
        for (const removeHandler of removeHandlers) {
          removeHandler()
        }
        app.config.errorHandler = previousErrorHandler
      })

      app.provide(ERROR_HANDLING_KEY, context)
    },

    report(error: unknown): void {
      handleError(createReportedError(error, null, isChunkLoadError))
    },
  }
}
