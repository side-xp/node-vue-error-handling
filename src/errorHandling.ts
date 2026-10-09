import type { App, AppConfig, ComponentPublicInstance } from 'vue'
import type { CaughtError, ComponentError, ErrorHandling, ErrorHandlingOptions } from './types'
import { getVuePhase } from './vuePhases'

/** Default minimum delay before an error with the same message is given to `onUnhandledError()` again. */
const DEFAULT_THROTTLE_MS = 5_000

// #region Errors

/** Gets a readable message from any thrown value. */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.name
  }

  try {
    return String(error)
  } catch {
    // Some values can't be converted to a string (e.g. objects without prototype)
    return 'Unknown error'
  }
}

/** Creates the normalized error of an error caught by Vue. */
function createComponentError(error: unknown, instance: ComponentPublicInstance | null, info: string): ComponentError {
  return {
    source: 'component',
    error,
    message: getErrorMessage(error),
    phase: getVuePhase(info),
    vueInfo: info,
    instance,
  }
}

// #endregion

// #region Console

/** Logs an error to the console. */
function logError(error: unknown): void {
  // biome-ignore lint/suspicious/noConsole: last resort of the errors, when the app doesn't handle them or can't
  console.error(error)
}

/** Logs a caught error to the console, as Vue does when the app has no error handler. */
function logCaughtError(caught: CaughtError): void {
  logError(caught.error)
}

/** Calls a callback given by the app. An error thrown by the callback is only logged, since handling it could loop. */
function callSafely<TArgs extends unknown[], TResult>(
  callback: (...args: TArgs) => TResult,
  ...args: TArgs
): TResult | undefined {
  try {
    return callback(...args)
  } catch (callbackError) {
    logError(callbackError)
    return undefined
  }
}

// #endregion

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

  /** Gives a caught error to the app, unless it's ignored. */
  function handleError(caught: CaughtError): void {
    // An `ignore()` that fails doesn't ignore the error, so it can't disappear silently
    if (ignore && callSafely(ignore, caught) === true) {
      return
    }

    callSafely(onError, caught)
    // Also prevents an infinite loop if `onUnhandledError()` itself causes the same error
    if (onUnhandledError && !isThrottled(caught.message)) {
      callSafely(onUnhandledError, caught)
    }
  }

  return {
    install(app: App): void {
      // An error handler set before this one still receives the errors
      const previousErrorHandler: AppConfig['errorHandler'] = app.config.errorHandler

      // Errors of the components
      app.config.errorHandler = (error, instance, info) => {
        handleError(createComponentError(error, instance, info))
        if (previousErrorHandler) {
          // Like the other callbacks of the app, an error thrown by it is only logged
          callSafely(previousErrorHandler, error, instance, info)
        }
      }
    },
  }
}
