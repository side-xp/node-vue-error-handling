import { loadPage } from './pageLoading'

/** Session storage key of the timestamp of the last automatic reload. */
const RELOAD_STORAGE_KEY = 'vueErrorHandling:lastChunkLoadReload'

/** Minimum delay between 2 automatic reloads, so a page that still can't be loaded doesn't reload in a loop. */
const RELOAD_COOLDOWN_MS = 10_000

/** Errors reported by Vite as chunk loading failures. Doesn't keep them in memory. */
const viteChunkLoadErrors: WeakSet<object> = new WeakSet()

/** Checks if the given error was reported by Vite as a failure to load a chunk (e.g. after a new deployment). */
export function isViteChunkLoadError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && viteChunkLoadErrors.has(error)
}

/** Records the errors reported by Vite as chunk loading failures. Returns a function that stops recording them. */
export function trackChunkLoadErrors(): () => void {
  // In production builds, Vite dispatches this event when a lazy loaded chunk (or one of its dependencies) fails to
  // load, then rethrows the error
  const onPreloadError = (event: Event): void => {
    const payload: unknown = (event as Event & { payload?: unknown }).payload
    if (typeof payload === 'object' && payload !== null) {
      viteChunkLoadErrors.add(payload)
    }
  }

  window.addEventListener('vite:preloadError', onPreloadError)
  return () => window.removeEventListener('vite:preloadError', onPreloadError)
}

/** Loads the given URL, unless an automatic reload already happened recently. Returns `true` if the page is loading. */
export function tryReloadPage(url: string): boolean {
  try {
    const lastReload: number = Number(sessionStorage.getItem(RELOAD_STORAGE_KEY))
    if (Date.now() - lastReload < RELOAD_COOLDOWN_MS) {
      return false
    }
    sessionStorage.setItem(RELOAD_STORAGE_KEY, `${Date.now()}`)
  } catch {
    // Without storage, there's no way to prevent a reload loop
    return false
  }

  loadPage(url)
  return true
}
