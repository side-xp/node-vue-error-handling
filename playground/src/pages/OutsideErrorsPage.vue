<script setup lang="ts">
import { markAsHandled } from '@side-xp/vue-error-handling'
import { errorHandling } from '../errorHandling'

/** Throws an error in a timer, outside of Vue. */
function failInTimer(): void {
  setTimeout(() => {
    throw new Error('Timer failed')
  })
}

/** Throws a value that is not an error in a timer, outside of Vue. */
function failWithStringInTimer(): void {
  setTimeout(() => {
    // On purpose, to try the values that are not errors
    throw 'A string thrown in a timer'
  })
}

/** Rejects a promise without catching it. Returns nothing, so Vue doesn't catch it as an event handler error. */
function rejectUncaught(): void {
  void Promise.reject(new Error('Request failed'))
}

/** Catches an error, and reports it. */
function reportCaughtError(): void {
  try {
    JSON.parse('{')
  } catch (error) {
    errorHandling.report(error)
  }
}

/** Reports an error, then rethrows it: it's handled only once. */
function reportAndRethrow(): void {
  const error: Error = new Error('Reported, then rethrown')
  errorHandling.report(error)
  throw error
}

/** Marks an error as handled, then throws it outside of Vue: it's ignored. */
function markAndThrowInTimer(): void {
  setTimeout(() => {
    const error: Error = new Error('Marked as handled')
    markAsHandled(error)
    throw error
  })
}
</script>

<template>
  <section>
    <h2>Uncaught errors</h2>
    <p>Errors that Vue can't catch, caught from the <code>error</code> and <code>unhandledrejection</code> events.</p>
    <div class="actions">
      <button type="button" @click="failInTimer">Throw in a timer</button>
      <button type="button" @click="failWithStringInTimer">Throw a string in a timer</button>
      <button type="button" @click="rejectUncaught">Reject a promise without catching it</button>
    </div>
  </section>

  <section>
    <h2>Reported errors</h2>
    <p>Errors caught by the app, and reported with <code>report()</code>.</p>
    <div class="actions">
      <button type="button" @click="reportCaughtError">Report a caught error</button>
      <button type="button" @click="reportAndRethrow">Report, then rethrow (listed once)</button>
    </div>
  </section>

  <section>
    <h2>Errors marked as handled</h2>
    <p>Errors marked with <code>markAsHandled()</code> are ignored when they're thrown: neither listed nor notified.</p>
    <div class="actions">
      <button type="button" @click="markAndThrowInTimer">Mark as handled, then throw in a timer</button>
    </div>
  </section>
</template>
