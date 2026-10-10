<script setup lang="ts">
import { notifications } from '../notifications'
</script>

<template>
  <ul class="notification-list">
    <li v-for="{ id, text } in notifications" :key="id">{{ text }}</li>
  </ul>
</template>

<style scoped>
.notification-list {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.notification-list li {
  margin-top: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid currentColor;
  background: Canvas;
}
</style>
