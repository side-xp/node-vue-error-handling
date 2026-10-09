import type { ComponentPublicInstance } from 'vue'
import type { ComponentError, GlobalError, PromiseRejectionError, ReportedError } from './types'
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
export function createComponentError(
  error: unknown,
  instance: ComponentPublicInstance | null,
  info: string,
): ComponentError {
  return {
    source: 'component',
    error,
    message: getErrorMessage(error),
    phase: getVuePhase(info),
    vueInfo: info,
    instance,
  }
}

/** Creates the normalized error of a promise rejected without being caught. */
export function createPromiseRejectionError(event: PromiseRejectionEvent): PromiseRejectionError {
  return {
    source: 'promise',
    error: event.reason,
    message: getErrorMessage(event.reason),
    event,
  }
}

/** Creates the normalized error of an error thrown outside of Vue. */
export function createGlobalError(event: ErrorEvent): GlobalError {
  return {
    source: 'global',
    error: event.error,
    // The error is hidden for the scripts of other origins, but the event still has a message
    message: event.error == null ? event.message : getErrorMessage(event.error),
    event,
  }
}

/** Creates the normalized error of an error reported by the app, from the given component if any. */
export function createReportedError(error: unknown, instance: ComponentPublicInstance | null = null): ReportedError {
  return {
    source: 'reported',
    error,
    message: getErrorMessage(error),
    instance,
  }
}
