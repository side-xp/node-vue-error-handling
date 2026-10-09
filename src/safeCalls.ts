/** Logs an error to the console. */
export function logError(error: unknown): void {
  // biome-ignore lint/suspicious/noConsole: last resort of the errors, when the app doesn't handle them or can't
  console.error(error)
}

/** Calls a callback given by the app. An error thrown by the callback is only logged, since handling it could loop. */
export function callSafely<TArgs extends unknown[], TResult>(
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
