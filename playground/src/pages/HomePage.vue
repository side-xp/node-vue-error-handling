<script setup lang="ts">
import { hello } from '@side-xp/vue-error-handling'

// @todo Placeholder checking that the library is resolved: replace it with the scenarios of each feature
const greeting: string = hello('playground')
</script>

<template>
  <p>{{ greeting }}</p>
</template>
