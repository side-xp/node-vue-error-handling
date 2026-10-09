<script setup lang="ts">
import { ErrorBoundary } from '@side-xp/vue-error-handling'
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
      <RouterLink to="/navigation-errors">Navigation errors</RouterLink>
    </nav>
  </header>
  <main>
    <!-- Page boundary: the errors of the page, and the navigation errors -->
    <ErrorBoundary navigation>
      <RouterView />
      <template #fallback="{ error, retry }">
        <h2>This page can't be displayed</h2>
        <p class="fallback">{{ error.message }}.</p>
        <button type="button" @click="retry">Retry</button>
        <p>Or leave it with the navigation, or the back button of the browser.</p>
      </template>
    </ErrorBoundary>
  </main>
  <ErrorLog />
  <NotificationList />
</template>
