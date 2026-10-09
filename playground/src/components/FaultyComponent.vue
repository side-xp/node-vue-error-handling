<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

/** Phases in which this component can fail. */
export type FaultyPhase = 'setup' | 'render' | 'mount' | 'watcher'

const props = defineProps<{
  /** The phase in which this component throws an error. */
  failsIn: FaultyPhase
}>()

/** Throws an error for the given phase, if it's the one this component fails in. */
function failIn(phase: FaultyPhase): void {
  if (props.failsIn === phase) {
    throw new Error(`FaultyComponent failed in ${phase}`)
  }
}

/** Value of the watcher, changed after the component is mounted. */
const watched = ref(0)

failIn('setup')
onMounted(() => {
  failIn('mount')
  watched.value++
})
watch(watched, () => failIn('watcher'))

/** Value displayed by the template, which fails during the render. */
function getLabel(): string {
  failIn('render')
  return `Fails in ${props.failsIn}`
}
</script>

<template>
  <span>{{ getLabel() }}</span>
</template>
