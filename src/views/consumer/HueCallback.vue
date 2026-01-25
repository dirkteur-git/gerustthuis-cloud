<script setup>
console.log('[HueCallback] Script setup starting...')

import { onMounted, ref } from 'vue'
import hueService from '@/services/hue'
import { RefreshCw, AlertCircle, CheckCircle } from 'lucide-vue-next'

console.log('[HueCallback] Imports done')

const error = ref('')
const status = ref('Initialiseren...')
const success = ref(false)

console.log('[HueCallback] Refs initialized')

onMounted(async () => {
  console.log('[HueCallback] onMounted called')
  const urlParams = new URLSearchParams(window.location.search)
  const code = urlParams.get('code')
  const errorParam = urlParams.get('error')

  console.log('HueCallback - URL:', window.location.href)
  console.log('HueCallback - Code:', code)

  if (errorParam) {
    error.value = `Hue authenticatie geweigerd: ${urlParams.get('error_description') || errorParam}`
    return
  }

  if (!code) {
    error.value = 'Geen autorisatiecode ontvangen van Hue'
    return
  }

  status.value = 'Token ophalen van Hue...'

  try {
    // Exchange code for token
    console.log('Exchanging code for token...')
    const tokenData = await hueService.exchangeCodeForToken(code)
    console.log('Token received:', tokenData)

    status.value = 'Bridge koppelen...'

    // Link bridge and get username
    const username = await hueService.linkBridge(tokenData.access_token)
    console.log('Bridge username:', username)

    // Store in localStorage temporarily - will be saved to DB on the protected page
    const hueData = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      bridge_username: username,
      timestamp: Date.now()
    }
    localStorage.setItem('hue_pending_connection', JSON.stringify(hueData))
    console.log('Hue data saved to localStorage')

    status.value = 'Hue Bridge gekoppeld!'
    success.value = true

    // Redirect to Hue page which will save to DB
    setTimeout(() => {
      window.location.href = '/app/hue'
    }, 1000)

  } catch (e) {
    console.error('OAuth callback error:', e)
    error.value = 'Kon niet verbinden met Hue Bridge: ' + e.message
  }
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
      <div v-else-if="success">
        <CheckCircle class="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h2 class="text-xl font-semibold text-gray-900 mb-2">Gelukt!</h2>
        <p class="text-gray-500">{{ status }}</p>
      </div>
      <div v-else>
        <RefreshCw class="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
        <h2 class="text-xl font-semibold text-gray-900 mb-2">Verbinden met Hue...</h2>
        <p class="text-gray-500">{{ status }}</p>
      </div>
    </div>
  </div>
</template>
