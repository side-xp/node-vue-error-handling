import { createErrorHandling, type ErrorHandling } from '@side-xp/vue-error-handling'
import { logError } from './errorLog'
import { notify } from './notifications'

/** Prefix of the messages of the errors to ignore, to try the `ignore()` option. */
export const IGNORED_ERROR_PREFIX = '[ignored]'

/** Error handling of the playground. */
export const errorHandling: ErrorHandling = createErrorHandling({
  onError: (caught) => {
    console.error(caught.error)
    logError(caught)
  },
  onUnhandledError: (caught) => notify(`Something went wrong: ${caught.message}`),
  ignore: (caught) => caught.message.startsWith(IGNORED_ERROR_PREFIX),
})
