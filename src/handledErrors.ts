/** Errors already handled, so they're ignored when they reach another handler. Doesn't keep them in memory. */
const handledErrors: WeakSet<object> = new WeakSet()

/** Checks if the given error can be recorded: a `WeakSet` only holds objects, not primitive values. */
function isRecordable(error: unknown): error is object {
  return (typeof error === 'object' && error !== null) || typeof error === 'function'
}

/**
 * Marks the given error as handled, so the error handling ignores it if it's rethrown or reaches another handler.
 * Use it for an error handled by the app but rethrown on purpose. The error itself is not modified.
 * Primitive values (e.g. `throw 'message'`) can't be marked.
 */
export function markAsHandled(error: unknown): void {
  if (isRecordable(error)) {
    handledErrors.add(error)
  }
}

/** Checks if the given error was already handled. */
export function isHandled(error: unknown): boolean {
  return isRecordable(error) && handledErrors.has(error)
}
