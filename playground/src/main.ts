import { createApp } from 'vue'
import App from './App.vue'
import { errorHandling } from './errorHandling'
import { router } from './router'
import './style.css'

const app = createApp(App)
// Before the router, so the errors of the first navigation are handled
app.use(errorHandling)
app.use(router)
app.mount('#app')
