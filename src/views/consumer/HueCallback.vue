<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { RefreshCw, AlertCircle } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const error = ref('')

onMounted(() => {
  console.log('HueCallback mounted, query:', route.query)

  const code = route.query.code
  const state = route.query.state
  const errorParam = route.query.error

  if (errorParam) {
    error.value = `Hue authenticatie geweigerd: ${route.query.error_description || errorParam}`
    return
  }

  if (!code) {
    error.value = 'Geen autorisatiecode ontvangen van Hue'
    return
  }

  // Store the code and state in localStorage for the HueSetup page to process
  localStorage.setItem('hue_oauth_code', code)
  if (state) {
    localStorage.setItem('hue_oauth_callback_state', state)
  }

  console.log('Stored OAuth code, redirecting to /app/hue')

  // Redirect to the Hue setup page which will process the code
  router.replace('/app/hue')
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-xl border border-gray-200 p-8 max-w-md w-full text-center">
      <div v-if="error">
        <AlertCircle class="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 class="text-xl font-semibold text-gray-900 mb-2">Fout bij koppelen</h2>
        <p class="text-gray-500 mb-6">{{ error }}</p>
        <a
          href="/app/hue"
          class="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 text-white font-medium rounded-xl hover:bg-amber-600 transition-colors"
        >
          Opnieuw proberen
        </a>
      </div>
      <div v-else>
        <RefreshCw class="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
        <h2 class="text-xl font-semibold text-gray-900 mb-2">Verbinden met Hue...</h2>
        <p class="text-gray-500">Even geduld, je wordt doorgestuurd</p>
      </div>
    </div>
  </div>
</template>
