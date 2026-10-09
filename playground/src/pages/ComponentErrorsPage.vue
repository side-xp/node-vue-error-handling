<script setup lang="ts">
import { ref } from 'vue'
import FaultyComponent, { type FaultyPhase } from '../components/FaultyComponent.vue'

/** Phases in which a faulty component can be mounted. */
const PHASES: FaultyPhase[] = ['setup', 'render', 'mount', 'watcher']

/** The phase of the faulty component currently mounted, if any. */
const mountedPhase = ref<FaultyPhase | null>(null)

/** Throws an error from an event handler. */
function failInHandler(): void {
  throw new Error('Event handler failed')
}

/** Rejects from an async event handler. */
async function failInAsyncHandler(): Promise<void> {
  await Promise.resolve()
  throw new Error('Async event handler failed')
}
</script>

<template>
  <section>
    <h2>Lifecycle</h2>
    <p>Mounts a component that fails in the given phase.</p>
    <div class="actions">
      <button type="button" v-for="phase in PHASES" :key="phase" @click="mountedPhase = phase">{{ phase }}</button>
      <button type="button" :disabled="!mountedPhase" @click="mountedPhase = null">Unmount</button>
    </div>
    <p v-if="mountedPhase">
      Mounted: <FaultyComponent :key="mountedPhase" :fails-in="mountedPhase" />
    </p>
  </section>

  <section>
    <h2>Event handlers</h2>
    <div class="actions">
      <button type="button" @click="failInHandler">Throw</button>
      <button type="button" @click="failInAsyncHandler">Reject (async)</button>
    </div>
  </section>
</template>
