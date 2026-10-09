import type { VuePhase } from './types'

/** Link to the error reference given by Vue as `info` in production builds, followed by the code of the error type. */
const ERROR_REFERENCE_URL = 'https://vuejs.org/error-reference/#runtime-'

/**
 * Error types of Vue, by code, with the description given as `info` to the error hooks in development builds.
 * Production builds give a link to the error reference instead (e.g. `https://vuejs.org/error-reference/#runtime-0`).
 * See https://vuejs.org/error-reference/#runtime-errors
 */
export const VUE_ERROR_TYPES: Record<string, { description: string; phase: VuePhase }> = {
  sp: { description: 'serverPrefetch hook', phase: 'hook' },
  bc: { description: 'beforeCreate hook', phase: 'setup' },
  c: { description: 'created hook', phase: 'setup' },
  bm: { description: 'beforeMount hook', phase: 'mount' },
  m: { description: 'mounted hook', phase: 'mount' },
  bu: { description: 'beforeUpdate hook', phase: 'update' },
  u: { description: 'updated', phase: 'update' },
  bum: { description: 'beforeUnmount hook', phase: 'unmount' },
  um: { description: 'unmounted hook', phase: 'unmount' },
  a: { description: 'activated hook', phase: 'hook' },
  da: { description: 'deactivated hook', phase: 'hook' },
  ec: { description: 'errorCaptured hook', phase: 'hook' },
  rtc: { description: 'renderTracked hook', phase: 'hook' },
  rtg: { description: 'renderTriggered hook', phase: 'hook' },
  0: { description: 'setup function', phase: 'setup' },
  1: { description: 'render function', phase: 'render' },
  2: { description: 'watcher getter', phase: 'watcher' },
  3: { description: 'watcher callback', phase: 'watcher' },
  4: { description: 'watcher cleanup function', phase: 'watcher' },
  5: { description: 'native event handler', phase: 'eventHandler' },
  6: { description: 'component event handler', phase: 'eventHandler' },
  7: { description: 'vnode hook', phase: 'other' },
  8: { description: 'directive hook', phase: 'other' },
  9: { description: 'transition hook', phase: 'other' },
  10: { description: 'app errorHandler', phase: 'other' },
  11: { description: 'app warnHandler', phase: 'other' },
  12: { description: 'ref function', phase: 'other' },
  13: { description: 'async component loader', phase: 'asyncComponent' },
  14: { description: 'scheduler flush', phase: 'other' },
  15: { description: 'component update', phase: 'update' },
  16: { description: 'app unmount cleanup function', phase: 'other' },
}

/** Phases of the errors caught by Vue, by `info` given to the error hooks, in both their development and production forms. */
const PHASES_BY_INFO: Map<string, VuePhase> = new Map(
  Object.entries(VUE_ERROR_TYPES).flatMap(([code, { description, phase }]) => [
    [description, phase],
    [`${ERROR_REFERENCE_URL}${code}`, phase],
  ]),
)

/** Gets the phase of an error caught by Vue, from the `info` given to the error hooks. */
export function getVuePhase(info: string): VuePhase {
  return PHASES_BY_INFO.get(info) ?? 'other'
}
