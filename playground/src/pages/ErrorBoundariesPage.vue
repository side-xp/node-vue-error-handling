<script setup lang="ts">
import { ErrorBoundary } from '@side-xp/vue-error-handling'
import { type Component, defineAsyncComponent, ref } from 'vue'
import FaultyComponent from '../components/FaultyComponent.vue'
import LiveFeed from '../components/LiveFeed.vue'

/** Delay of the async component loader, to see it loading. */
const LOADING_DELAY_MS = 500

/** Whether the widget fails in its setup. */
const shouldWidgetFail = ref(true)

/** Whether the async component fails to load. */
const shouldLoadingFail = ref(true)

/** Whether the scenarios that fail when mounted are mounted. */
const isNestedMounted = ref(false)
const isFailingFallbackMounted = ref(false)

/** An async component whose loader fails while `shouldLoadingFail` is checked. */
const AsyncWidget: Component = defineAsyncComponent(async () => {
  await new Promise((resolve) => setTimeout(resolve, LOADING_DELAY_MS))
  if (shouldLoadingFail.value) {
    throw new Error('The async component failed to load')
  }
  return { render: () => 'Async component loaded.' }
})

/** Fails like a save action. */
function save(): void {
  throw new Error('The save failed')
}
</script>

<template>
  <section>
    <h2>Fallback</h2>
    <p>A widget that fails in its setup is replaced by the fallback. Uncheck the option, then retry.</p>
    <label><input v-model="shouldWidgetFail" type="checkbox" /> The widget fails</label>
    <ErrorBoundary>
      <FaultyComponent v-if="shouldWidgetFail" fails-in="setup" />
      <p v-else>Widget displayed.</p>
      <template #fallback="{ error, retry }">
        <p class="fallback">The widget can't be displayed ({{ error.message }}).</p>
        <button type="button" @click="retry">Retry</button>
      </template>
    </ErrorBoundary>
  </section>

  <section>
    <h2>Async component</h2>
    <p>An async component that fails to load is replaced by the fallback. Retrying loads it again.</p>
    <label><input v-model="shouldLoadingFail" type="checkbox" /> The loading fails</label>
    <ErrorBoundary>
      <AsyncWidget />
      <template #fallback="{ error, retry }">
        <p class="fallback">{{ error.message }}.</p>
        <button type="button" @click="retry">Retry</button>
      </template>
    </ErrorBoundary>
  </section>

  <section>
    <h2>Inline error</h2>
    <p>The errors of the button are displayed under it, instead of a notification. The button stays usable.</p>
    <ErrorBoundary :filter="['eventHandler']" v-slot="{ error, clear }">
      <button type="button" @click="clear(); save()">Save</button>
      <p v-if="error" class="fallback">{{ error.message }}.</p>
    </ErrorBoundary>
  </section>

  <section>
    <h2>Nested boundaries</h2>
    <p>The inner boundary only handles event handler errors: the setup error goes to the outer one.</p>
    <button type="button" @click="isNestedMounted = !isNestedMounted">{{ isNestedMounted ? 'Unmount' : 'Mount' }}</button>
    <ErrorBoundary v-if="isNestedMounted">
      <ErrorBoundary :filter="['eventHandler']">
        <FaultyComponent fails-in="setup" />
      </ErrorBoundary>
      <template #fallback="{ error }">
        <p class="fallback">Handled by the outer boundary: {{ error.message }}.</p>
      </template>
    </ErrorBoundary>
  </section>

  <section>
    <h2>Failing fallback</h2>
    <p>The fallback of the inner boundary fails too: its error goes to the outer boundary.</p>
    <button type="button" @click="isFailingFallbackMounted = !isFailingFallbackMounted">
      {{ isFailingFallbackMounted ? 'Unmount' : 'Mount' }}
    </button>
    <ErrorBoundary v-if="isFailingFallbackMounted">
      <ErrorBoundary>
        <FaultyComponent fails-in="setup" />
        <template #fallback>
          <FaultyComponent fails-in="render" />
        </template>
      </ErrorBoundary>
      <template #fallback="{ error }">
        <p class="fallback">Handled by the outer boundary: {{ error.message }}.</p>
      </template>
    </ErrorBoundary>
  </section>
  <section>
    <h2>Reported errors</h2>
    <p>
      The feed parses its messages in a callback that Vue doesn't call, and reports the errors with
      <code>useErrorHandling()</code>: they go to the closest boundary, like a thrown error.
    </p>
    <h3>In a boundary</h3>
    <ErrorBoundary>
      <LiveFeed />
      <template #fallback="{ error, retry }">
        <p class="fallback">The feed stopped ({{ error.message }}).</p>
        <button type="button" @click="retry">Reconnect</button>
      </template>
    </ErrorBoundary>
    <h3>Outside of a boundary</h3>
    <p>The errors go to the app, which displays a notification.</p>
    <LiveFeed />
  </section>
</template>
