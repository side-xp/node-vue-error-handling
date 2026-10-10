/** Checks if the code runs in a browser, and not on a server (e.g. while rendering the app with SSR). */
export function isBrowser(): boolean {
  return typeof window !== 'undefined'
}
