import { createErrorHandling } from '@side-xp/vue-error-handling'
import { createApp } from 'vue'
import App from './App.vue'
import { logError } from './errorLog'
import { router } from './router'
import './style.css'

const app = createApp(App)
app.use(
  createErrorHandling({
    onError: (caught) => {
      console.error(caught.error)
      logError(caught)
    },
  }),
)
app.use(router)
app.mount('#app')
