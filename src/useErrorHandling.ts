import { type ComponentPublicInstance, getCurrentInstance, inject } from 'vue'
import { createReportedError } from './caughtErrors'
import { ERROR_BOUNDARY_KEY, type ErrorBoundaryHandle } from './errorBoundary'
import { type ErrorHandlingContext, injectErrorHandling } from './errorHandling'
import type { ReportedError, UseErrorHandlingReturn } from './types'

/**
 * Gives access to the error handling from a component. Must be called in its `setup()`.
 * Its `report()` gives the errors caught by the component to the closest error boundary first, then to the parent
 * boundaries, then to the app (like a thrown error).
 */
export function useErrorHandling(): UseErrorHandlingReturn {
  if (!getCurrentInstance()) {
    throw new Error('useErrorHandling() must be called in the `setup()` of a component.')
  }

  const context: ErrorHandlingContext = injectErrorHandling('useErrorHandling()')
  const boundary: ErrorBoundaryHandle | null = inject(ERROR_BOUNDARY_KEY, null)
  const instance: ComponentPublicInstance | null = getCurrentInstance()?.proxy ?? null

  return {
    report(error: unknown): void {
      const caught: ReportedError = createReportedError(error, instance)
      for (let current: ErrorBoundaryHandle | null = boundary; current; current = current.parent) {
        if (current.handleReportedError(caught)) {
          return
        }
      }
      context.handleUnhandledError(caught)
    },
  }
}
