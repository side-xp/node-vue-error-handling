<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <section>
    <h2>Chunk loading failures with webpack</h2>
    <p>
      Webpack doesn't report its chunk loading failures like Vite: they're detected with the
      <code>isChunkLoadError</code> option, which checks the name of webpack's errors (<code>ChunkLoadError</code>).
    </p>
    <ol>
      <li>Open this page, without visiting the page below yet.</li>
      <li>
        Simulate a new deployment: delete the chunk of the page,
        <code>playground-webpack/dist/DeployedPage.*.js</code>.
      </li>
      <li>
        <RouterLink to="/deployed-page">Go to the page</RouterLink>: its chunk fails to load, so the page is loaded
        again.
      </li>
      <li>
        The chunk is still missing after the reload (it was deleted, not deployed again): the page is not loaded again
        within 10 seconds, and the page boundary displays the error instead, flagged as a chunk loading failure.
      </li>
    </ol>
  </section>
</template>
