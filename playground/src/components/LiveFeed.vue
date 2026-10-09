<script setup lang="ts">
import { useErrorHandling } from '@side-xp/vue-error-handling'
import { ref } from 'vue'

const { report } = useErrorHandling()

/** Last message received. */
const lastMessage = ref('No message yet.')

/** Simulates a message received from a socket: Vue doesn't call this callback, so it can't catch its errors. */
function receiveMessage(payload: string): void {
  setTimeout(() => {
    try {
      lastMessage.value = JSON.parse(payload).text
    } catch (error) {
      report(error)
    }
  })
}
</script>

<template>
  <p>Live feed: {{ lastMessage }}</p>
  <div class="actions">
    <button type="button" @click="receiveMessage('{ &quot;text&quot;: &quot;Hello!&quot; }')">Receive a message</button>
    <button type="button" @click="receiveMessage('{ invalid')">Receive an invalid message</button>
  </div>
</template>
