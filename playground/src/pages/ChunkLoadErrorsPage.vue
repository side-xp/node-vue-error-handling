<script setup lang="ts">
import { RouterLink } from 'vue-router'

/** Whether the playground runs in a production build, where Vite reports the chunk loading failures. */
const isProduction: boolean = import.meta.env.PROD
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
</template>
