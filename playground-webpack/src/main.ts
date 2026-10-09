import { createErrorHandling } from '@side-xp/vue-error-handling'
import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'

const app = createApp(App)
app.use(
  createErrorHandling({
    router,
    // The detection of webpack's chunk loading failures, as documented in the README
    isChunkLoadError: (error) => error instanceof Error && error.name === 'ChunkLoadError',
  }),
)
app.use(router)
app.mount('#app')
