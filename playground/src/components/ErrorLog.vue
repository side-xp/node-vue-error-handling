<script setup lang="ts">
import type { CaughtError } from '@side-xp/vue-error-handling'
import type { ComponentPublicInstance } from 'vue'
import { clearErrorLog, errorLog } from '../errorLog'

/** Gets the name of the given component. */
function getComponentName(instance: ComponentPublicInstance | null): string {
  return instance?.$options.name ?? instance?.$options.__name ?? 'anonymous'
}

/** Describes where an error was caught. */
function describeContext(caught: CaughtError): string {
  switch (caught.source) {
    case 'component':
      return `${caught.phase} of <${getComponentName(caught.instance)}> (Vue info: "${caught.vueInfo}")`
    case 'promise':
      return 'Promise rejected without being caught'
    case 'global':
      return `Thrown outside of Vue, at ${caught.event.filename || 'unknown file'}:${caught.event.lineno}`
    case 'reported':
      return caught.instance ? `Reported by <${getComponentName(caught.instance)}>` : 'Reported by the app'
  }
}
</script>

<template>
  <aside class="error-log">
    <header>
      <h2>Caught errors ({{ errorLog.length }})</h2>
      <button type="button" :disabled="errorLog.length === 0" @click="clearErrorLog">Clear</button>
    </header>
    <ol v-if="errorLog.length > 0">
      <li v-for="{ id, caught } in errorLog" :key="id">
        <strong>[{{ caught.source }}]</strong> {{ caught.message }}
        <small>{{ describeContext(caught) }}</small>
      </li>
    </ol>
    <p v-else>No error caught yet.</p>
  </aside>
</template>

<style scoped>
.error-log {
  margin-top: 2rem;
  padding: 1rem;
  border: 1px solid currentColor;
  border-radius: 0.5rem;
}

.error-log header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.error-log small {
  display: block;
  opacity: 0.7;
}
</style>
