<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import ErrorLog from './components/ErrorLog.vue'
</script>

<template>
  <header>
    <h1>Vue Error Handling playground</h1>
    <nav>
      <RouterLink to="/">Home</RouterLink>
      <RouterLink to="/component-errors">Component errors</RouterLink>
    </nav>
  </header>
  <main>
    <RouterView />
  </main>
  <ErrorLog />
</template>
