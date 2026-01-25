import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './assets/main.css'

console.log('[App] Starting GerustThuis...')

const app = createApp(App)

// Global error handler - log but don't break
app.config.errorHandler = (err, instance, info) => {
  console.error('[Vue Error]', err)
  console.error('[Component]', instance?.$options?.name || 'Unknown')
  console.error('[Info]', info)
}

// Handle unhandled promise rejections - just log, don't break
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Promise Rejection]', event.reason)
  event.preventDefault()
})

app.use(createPinia())
app.use(router)

// Mount app immediately - don't wait for router.isReady()
clearTimeout(window.__loadTimeout)
const loadingEl = document.getElementById('app-loading')
if (loadingEl) {
  loadingEl.classList.add('hidden')
}
app.mount('#app')
console.log('[App] Mounted')
