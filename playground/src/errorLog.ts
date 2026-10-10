import type { CaughtError } from '@side-xp/vue-error-handling'
import { type ShallowReactive, shallowReactive } from 'vue'

/** An error received by the error handling of the playground. */
export interface ErrorLogEntry {
  id: number
  caught: CaughtError
}

/** Errors received by the error handling, displayed on screen to check how they're normalized. */
export const errorLog: ShallowReactive<ErrorLogEntry[]> = shallowReactive([])

/** Id of the next entry. */
let nextId = 0

/** Adds an error to the log. */
export function logError(caught: CaughtError): void {
  errorLog.unshift({ id: nextId++, caught })
}

/** Clears the log. */
export function clearErrorLog(): void {
  errorLog.splice(0)
}
