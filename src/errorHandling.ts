import type { App, AppConfig, ComponentPublicInstance } from 'vue'
import type { CaughtError, ComponentError, ErrorHandling, ErrorHandlingOptions } from './types'
import { getVuePhase } from './vuePhases'

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

/** Logs an error to the console, as Vue does when the app has no error handler. */
function logToConsole(caught: CaughtError): void {
  // biome-ignore lint/suspicious/noConsole: default destination of the errors, when the app doesn't give one
  console.error(caught.error)
}

/** Creates the error handling of an app: catches the errors, normalizes them, and gives them to the app. */
export function createErrorHandling(options: ErrorHandlingOptions = {}): ErrorHandling {
  const { onError = logToConsole } = options

  return {
    install(app: App): void {
      // An error handler set before this one still receives the errors
      const previousErrorHandler: AppConfig['errorHandler'] = app.config.errorHandler

      // Errors of the components
      app.config.errorHandler = (error, instance, info) => {
        onError(createComponentError(error, instance, info))
        previousErrorHandler?.(error, instance, info)
      }
    },
  }
}
