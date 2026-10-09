<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import ErrorLog from './components/ErrorLog.vue'
import NotificationList from './components/NotificationList.vue'
</script>

<template>
  <header>
    <h1>Vue Error Handling playground</h1>
    <nav>
      <RouterLink to="/">Home</RouterLink>
      <RouterLink to="/component-errors">Component errors</RouterLink>
      <RouterLink to="/unhandled-errors">Unhandled errors</RouterLink>
      <RouterLink to="/outside-errors">Errors outside of Vue</RouterLink>
      <RouterLink to="/error-boundaries">Error boundaries</RouterLink>
    </nav>
  </header>
  <main>
    <RouterView />
  </main>
  <ErrorLog />
  <NotificationList />
</template>
