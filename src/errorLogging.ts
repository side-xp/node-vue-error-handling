import type { ComponentPublicInstance } from 'vue'
import { logError } from './safeCalls'
import type { CaughtError } from './types'

/** Prefix of the logs, to tell them from the other logs of the app. */
const LOG_PREFIX = '[vue-error-handling]'

/** Gets the name of a component, as Vue displays it in its warnings. */
function getComponentName(instance: ComponentPublicInstance): string {
  const { name, __name } = instance.$options
  return name ?? __name ?? 'Anonymous'
}

/** Gets the trace of a component, from the component to the root (e.g. `at <Foo>` then `at <App>`), one per line. */
function getComponentTrace(instance: ComponentPublicInstance | null): string {
  const lines: string[] = []
  for (let current: ComponentPublicInstance | null = instance; current; current = current.$parent) {
    lines.push(`\n  at <${getComponentName(current)}>`)
  }
  return lines.join('')
}

/** Gets the description of a caught error, and the details of its context. */
function describeCaughtError(caught: CaughtError): { description: string; details: string[] } {
  switch (caught.source) {
    case 'component':
      return { description: 'Component error', details: [`phase: ${caught.phase}`] }
    case 'reported':
      return { description: 'Reported error', details: [] }
    case 'promise':
      return { description: 'Unhandled promise rejection', details: [] }
    case 'global': {
      const { filename, lineno, colno } = caught.event
      return { description: 'Uncaught error', details: filename ? [`at ${filename}:${lineno}:${colno}`] : [] }
    }
    case 'navigation':
      return { description: 'Navigation error', details: [`to: ${caught.to.fullPath}`] }
  }
}

/**
 * Logs a caught error to the console, with its context: Vue doesn't log its component trace anymore once an error
 * handler is set. The error is logged as is, so the console keeps its stack trace.
 */
export function logCaughtError(caught: CaughtError): void {
  const { description, details } = describeCaughtError(caught)
  if (caught.isChunkLoadError) {
    details.push('chunk loading failure')
  }

  const header: string = details.length > 0 ? `${description} (${details.join(', ')})` : description
  const trace: string =
    caught.source === 'component' || caught.source === 'reported' ? getComponentTrace(caught.instance) : ''
  // The browser hides the errors of the scripts from other origins: only the message is left
  const error: unknown = caught.source === 'global' && caught.error === null ? caught.message : caught.error

  logError(`${LOG_PREFIX} ${header}${trace}`, error)
}
