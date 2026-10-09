import type { ComponentPublicInstance } from 'vue'
import type { RouteLocationNormalized, RouteLocationNormalizedLoaded } from 'vue-router'
import type { ComponentError, GlobalError, NavigationError, PromiseRejectionError, ReportedError } from './types'
import { getVuePhase } from './vuePhases'

/** Checks if an error is a failure to load a chunk, with the detection of the error handling. */
export type ChunkLoadErrorDetector = (error: unknown) => boolean

/** Gets the `message` property of an object that is not an `Error` (e.g. `{ message, code }`), if it's a non-empty string. */
function getMessageProperty(error: object): string | undefined {
  try {
    const { message } = error as { message?: unknown }
    return typeof message === 'string' && message !== '' ? message : undefined
  } catch {
    // The property can be a getter that throws
    return undefined
  }
}

/** Gets a readable message from any thrown value. */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.name
  }

  if (typeof error === 'object' && error !== null) {
    const message: string | undefined = getMessageProperty(error)
    if (message !== undefined) {
      return message
    }
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
  isChunkLoadError: ChunkLoadErrorDetector,
): ComponentError {
  return {
    source: 'component',
    error,
    message: getErrorMessage(error),
    isChunkLoadError: isChunkLoadError(error),
    phase: getVuePhase(info),
    vueInfo: info,
    instance,
  }
}

/** Creates the normalized error of a promise rejected without being caught. */
export function createPromiseRejectionError(
  event: PromiseRejectionEvent,
  isChunkLoadError: ChunkLoadErrorDetector,
): PromiseRejectionError {
  return {
    source: 'promise',
    error: event.reason,
    message: getErrorMessage(event.reason),
    isChunkLoadError: isChunkLoadError(event.reason),
    event,
  }
}

/** Creates the normalized error of an error thrown outside of Vue. */
export function createGlobalError(event: ErrorEvent, isChunkLoadError: ChunkLoadErrorDetector): GlobalError {
  return {
    source: 'global',
    error: event.error,
    // The error is hidden for the scripts of other origins, but the event still has a message
    message: event.error == null ? event.message : getErrorMessage(event.error),
    isChunkLoadError: isChunkLoadError(event.error),
    event,
  }
}

/** Creates the normalized error of a navigation that failed. */
export function createNavigationError(
  error: unknown,
  to: RouteLocationNormalized,
  from: RouteLocationNormalizedLoaded,
  isChunkLoadError: ChunkLoadErrorDetector,
): NavigationError {
  return {
    source: 'navigation',
    error,
    message: getErrorMessage(error),
    isChunkLoadError: isChunkLoadError(error),
    to,
    from,
  }
}

/** Creates the normalized error of an error reported by the app, from the given component if any. */
export function createReportedError(
  error: unknown,
  instance: ComponentPublicInstance | null,
  isChunkLoadError: ChunkLoadErrorDetector,
): ReportedError {
  return {
    source: 'reported',
    error,
    message: getErrorMessage(error),
    isChunkLoadError: isChunkLoadError(error),
    instance,
  }
}
