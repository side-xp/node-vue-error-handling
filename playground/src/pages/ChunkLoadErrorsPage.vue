<script setup lang="ts">
import { ErrorBoundary } from '@side-xp/vue-error-handling'
import { type Component, defineAsyncComponent, type Ref, ref } from 'vue'
import { RouterLink } from 'vue-router'

/** Whether the playground runs in a production build, where Vite reports the chunk loading failures. */
const isProduction: boolean = import.meta.env.PROD

/** Number of times the chunk of the widget was requested, to tell a new request from a cached failure. */
const loadAttempts: Ref<number> = ref(0)

/** An async component in its own chunk, loaded only when asked (so its chunk can be removed first). */
const LazyWidget: Component = defineAsyncComponent(() => {
  loadAttempts.value++
  return import('../components/LazyWidget.vue')
})

/** Whether the widget is displayed (its chunk is requested when it's displayed for the first time). */
const isWidgetShown: Ref<boolean> = ref(false)
</script>

<template>
  <section>
    <h2>Chunk loading failures</h2>
    <p>
      After a new deployment, the chunks of the previous version are no longer served: the users still running it fail
      to load the pages they haven't visited yet. When a navigation fails this way, the page is loaded again (at most
      once every 10 seconds), which gets the new version.
    </p>
    <p v-if="!isProduction" class="fallback">
      Vite only reports these failures in production builds: run <code>npm run playground:build</code>, then
      <code>npm run playground:preview</code>.
    </p>
    <ol>
      <li>Open this page in the production build, without visiting the page below yet.</li>
      <li>
        Simulate a new deployment: delete the chunk of the page, <code>playground/dist/assets/DeployedPage-*.js</code>.
      </li>
      <li>
        <RouterLink to="/deployed-page">Go to the page</RouterLink>: its chunk fails to load, so the page is loaded
        again.
      </li>
      <li>
        The chunk is still missing after the reload (it was deleted, not deployed again): the page is not loaded again
        within 10 seconds, and the page boundary displays the error instead.
      </li>
    </ol>
  </section>

  <section>
    <h2>Retrying an async component</h2>
    <p>
      Checks whether the browser requests a chunk that failed to load again, or keeps the failure: the boundary's
      <code>retry()</code> calls <code>import()</code> again, with the same URL. A temporary network failure is
      simulated by removing the chunk, then restoring it.
    </p>
    <ol>
      <li>Open this page in the production build (fresh tab, so the chunk was never requested).</li>
      <li>
        Rename the chunk of the widget, <code>playground/dist/assets/LazyWidget-*.js</code> (e.g. add
        <code>.bak</code>).
      </li>
      <li>Load the widget: the boundary displays the failure.</li>
      <li>Rename the chunk back to its original name.</li>
      <li>
        Retry: if the widget is displayed, the browser requested the chunk again. If the failure is displayed again, it
        kept the failure (check in the network tab of the developer tools whether a request was made).
      </li>
    </ol>
    <p>Load attempts: {{ loadAttempts }}</p>
    <button v-if="!isWidgetShown" type="button" @click="isWidgetShown = true">Load the widget</button>
    <ErrorBoundary v-else>
      <LazyWidget />
      <template #fallback="{ error, retry }">
        <p class="fallback">
          The widget can't be loaded ({{ error.message }}). Chunk loading failure:
          {{ error.isChunkLoadError ? 'yes' : 'no' }}.
        </p>
        <button type="button" @click="retry">Retry</button>
      </template>
    </ErrorBoundary>
  </section>
</template>
