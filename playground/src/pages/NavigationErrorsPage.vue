<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { shouldPageLoadFail } from '../navigationScenarios'
</script>

<template>
  <section>
    <h2>Navigation errors</h2>
    <p>
      The router view of the playground is wrapped in a navigation boundary: it displays the errors of the page, and the
      navigations that fail. Leave the error with <strong>Retry</strong>, any link, or the back button of the browser.
    </p>
    <ul>
      <li><RouterLink to="/navigation-errors/guard-fails">A navigation guard that throws</RouterLink></li>
      <li>
        <RouterLink to="/navigation-errors/load-fails">A page that fails to load</RouterLink>
        <label><input v-model="shouldPageLoadFail" type="checkbox" /> The loading fails (uncheck it, then retry)</label>
      </li>
      <li><RouterLink to="/navigation-errors/setup-fails">A page that fails in its setup</RouterLink></li>
    </ul>
  </section>
</template>
