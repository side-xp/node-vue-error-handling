import { type App, type AppConfig, type InjectionKey, inject } from 'vue'
import {
  createComponentError,
  createGlobalError,
  createPromiseRejectionError,
  createReportedError,
} from './caughtErrors'
import { isHandled, markAsHandled } from './handledErrors'
import { callSafely, logError } from './safeCalls'
import type { CaughtError, ErrorHandling, ErrorHandlingOptions } from './types'

/** Default minimum delay before an error with the same message is given to `onUnhandledError()` again. */
const DEFAULT_THROTTLE_MS = 5_000

/** What the error boundaries and `useErrorHandling()` get from the error handling installed on the app. */
export interface ErrorHandlingContext {
  /** Checks if the app ignores the given error. */
  isIgnored(caught: CaughtError): boolean
  /** Gives an error handled by an error boundary to `onError()`, unless it was already handled. */
  handleBoundaryError(caught: CaughtError): void
  /** Gives an error that no error boundary handled to the app, unless it was already handled or it's ignored. */
  handleUnhandledError(caught: CaughtError): void
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
  const { onError = logCaughtError, onUnhandledError, ignore, throttleMs = DEFAULT_THROTTLE_MS } = options

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
      handleError(createPromiseRejectionError(event))
    }

    // Errors thrown outside of Vue (e.g. in timers, or in listeners added with `addEventListener()`)
    const onWindowError = (event: ErrorEvent): void => {
      event.preventDefault()
      handleError(createGlobalError(event))
    }

    window.addEventListener('unhandledrejection', onUnhandledRejection)
    window.addEventListener('error', onWindowError)
    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
      window.removeEventListener('error', onWindowError)
    }
  }

  const context: ErrorHandlingContext = {
    isIgnored,

    handleBoundaryError(caught: CaughtError): void {
      if (isHandled(caught.error)) {
        return
      }
      markAsHandled(caught.error)
      callSafely(onError, caught)
    },

    handleUnhandledError: handleError,
  }

  return {
    install(app: App): void {
      // An error handler set before this one still receives the errors
      const previousErrorHandler: AppConfig['errorHandler'] = app.config.errorHandler

      // Errors of the components that no error boundary handled
      app.config.errorHandler = (error, instance, info) => {
        handleError(createComponentError(error, instance, info))
        if (previousErrorHandler) {
          // Like the other callbacks of the app, an error thrown by it is only logged
          callSafely(previousErrorHandler, error, instance, info)
        }
      }

      const removeWindowHandlers: () => void = handleWindowErrors()
      app.onUnmount(() => {
        removeWindowHandlers()
        app.config.errorHandler = previousErrorHandler
      })

      app.provide(ERROR_HANDLING_KEY, context)
    },

    report(error: unknown): void {
      handleError(createReportedError(error))
    },
  }
}
