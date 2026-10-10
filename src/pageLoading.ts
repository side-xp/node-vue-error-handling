/** Loads the given URL. In its own module, so the tests can replace it (jsdom can't load pages). */
export function loadPage(url: string): void {
  window.location.assign(url)
}
