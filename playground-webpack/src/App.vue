<script setup lang="ts">
import { ErrorBoundary } from '@side-xp/vue-error-handling'
import { RouterLink, RouterView } from 'vue-router'

/** Loads the whole app again. */
function reload(): void {
  window.location.reload()
}
</script>

<template>
  <header>
    <h1>Vue Error Handling webpack playground</h1>
    <nav>
      <RouterLink to="/">Home</RouterLink>
    </nav>
  </header>
  <main>
    <ErrorBoundary navigation>
      <RouterView />
      <template #fallback="{ error, retry }">
        <h2>This page can't be displayed</h2>
        <p class="fallback">{{ error.message }}</p>
        <p>Chunk loading failure: {{ error.isChunkLoadError }}</p>
        <div class="actions">
          <button type="button" @click="retry">Retry</button>
          <button v-if="error.isChunkLoadError" type="button" @click="reload">Reload</button>
        </div>
      </template>
    </ErrorBoundary>
  </main>
</template>
