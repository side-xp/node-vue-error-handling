<script setup lang="ts">
import { IGNORED_ERROR_PREFIX } from '../errorHandling'

/** Number of the next numbered error, so each one has a different message. */
let nextErrorNumber = 1

/** Throws an error with the given message. */
function fail(message: string): void {
  throw new Error(message)
}
</script>

<template>
  <section>
    <h2>Notifications</h2>
    <p>
      Errors that nothing else handled are given to <code>onUnhandledError()</code>, which displays a notification in
      this playground.
    </p>
    <div class="actions">
      <button type="button" @click="fail(`Numbered error #${nextErrorNumber++}`)">Throw a new error</button>
    </div>
  </section>

  <section>
    <h2>Throttling</h2>
    <p>
      Click several times: an error with the same message is notified at most once every 5 seconds, but it's still
      listed in the <strong>Caught errors</strong> panel every time.
    </p>
    <div class="actions">
      <button type="button" @click="fail('Repeated error')">Throw the same error</button>
    </div>
  </section>

  <section>
    <h2>Ignored errors</h2>
    <p>
      The errors whose message starts with <code>{{ IGNORED_ERROR_PREFIX }}</code> are ignored: neither listed nor
      notified.
    </p>
    <div class="actions">
      <button type="button" @click="fail(`${IGNORED_ERROR_PREFIX} Ignored error`)">Throw an ignored error</button>
    </div>
  </section>
</template>
