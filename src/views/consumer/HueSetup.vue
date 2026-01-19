<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/services/supabase'
import hueService from '@/services/hue'
import {
  Lightbulb,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Wifi,
  Eye,
  Thermometer,
  Sun,
  Battery
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const loading = ref(false)
const error = ref('')
const success = ref('')
const step = ref(1)
const hueConnection = ref(null)
const sensors = ref([])
const syncingData = ref(false)

// Check if already connected
onMounted(async () => {
  await checkExistingConnection()

  // Handle OAuth callback
  if (route.query.code) {
    await handleOAuthCallback(route.query.code)
  }
})

// Check for existing Hue connection
async function checkExistingConnection() {
  loading.value = true

  try {
    if (!authStore.user?.id) {
      loading.value = false
      return
    }

    const { data, error: fetchError } = await supabase
      .from('hue_connections')
      .select('*')
      .eq('user_id', authStore.user.id)
      .single()

    if (data && !fetchError) {
      hueConnection.value = data
      step.value = 3

      // Check if token needs refresh
      if (new Date(data.token_expires_at) < new Date()) {
        await refreshToken()
      }

      // Load sensors
      await loadSensors()
    }
  } catch (e) {
    console.log('No existing Hue connection or table not found')
  } finally {
    loading.value = false
  }
}

// Start OAuth flow
function startOAuth() {
  const state = crypto.randomUUID()
  localStorage.setItem('hue_oauth_state', state)

  const authUrl = hueService.getAuthorizationUrl(state)
  window.location.href = authUrl
}

// Handle OAuth callback
async function handleOAuthCallback(code) {
  loading.value = true
  error.value = ''
  step.value = 2

  try {
    // Exchange code for token
    const tokenData = await hueService.exchangeCodeForToken(code)

    // Link bridge and get username
    const username = await hueService.linkBridge(tokenData.access_token)

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000)

    // Save to Supabase
    const { error: saveError } = await supabase
      .from('hue_connections')
      .upsert({
        user_id: authStore.user?.id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: expiresAt.toISOString(),
        bridge_username: username,
        connected_at: new Date().toISOString()
      })

    if (saveError) throw saveError

    hueConnection.value = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      bridge_username: username
    }

    success.value = 'Hue Bridge succesvol gekoppeld!'
    step.value = 3

    // Load sensors
    await loadSensors()

    // Clean up URL
    router.replace({ path: route.path })
  } catch (e) {
    console.error('OAuth callback error:', e)
    error.value = 'Kon niet verbinden met Hue Bridge: ' + e.message
    step.value = 1
  } finally {
    loading.value = false
  }
}

// Refresh access token
async function refreshToken() {
  try {
    const tokenData = await hueService.refreshAccessToken(hueConnection.value.refresh_token)

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000)

    await supabase
      .from('hue_connections')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: expiresAt.toISOString()
      })
      .eq('user_id', authStore.user?.id)

    hueConnection.value.access_token = tokenData.access_token
    hueConnection.value.refresh_token = tokenData.refresh_token
  } catch (e) {
    console.error('Token refresh failed:', e)
    error.value = 'Sessie verlopen. Koppel opnieuw.'
    step.value = 1
    hueConnection.value = null
  }
}

// Load sensors from Hue Bridge
async function loadSensors() {
  if (!hueConnection.value) return

  loading.value = true

  try {
    sensors.value = await hueService.getAllSensorStates(
      hueConnection.value.access_token,
      hueConnection.value.bridge_username
    )
  } catch (e) {
    console.error('Failed to load sensors:', e)
    error.value = 'Kon sensoren niet laden'
  } finally {
    loading.value = false
  }
}

// Sync sensor data to database
async function syncSensorData() {
  if (!hueConnection.value || sensors.value.length === 0) return

  syncingData.value = true
  error.value = ''

  try {
    const now = new Date().toISOString()

    for (const sensor of sensors.value) {
      // Save motion event if presence detected
      if (sensor.presence !== undefined) {
        await supabase.from('motion_events').insert({
          user_id: authStore.user?.id,
          room: sensor.name,
          motion: sensor.presence,
          recorded_at: sensor.presenceUpdated || now,
          source: 'hue'
        })
      }
    }

    success.value = `${sensors.value.length} sensoren gesynchroniseerd!`

    // Reload sensors
    await loadSensors()
  } catch (e) {
    console.error('Sync error:', e)
    error.value = 'Synchronisatie mislukt: ' + e.message
  } finally {
    syncingData.value = false
  }
}

// Disconnect Hue
async function disconnect() {
  if (!confirm('Weet je zeker dat je de Hue Bridge wilt ontkoppelen?')) return

  loading.value = true

  try {
    await supabase
      .from('hue_connections')
      .delete()
      .eq('user_id', authStore.user?.id)

    hueConnection.value = null
    sensors.value = []
    step.value = 1
    success.value = 'Hue Bridge ontkoppeld'
  } catch (e) {
    error.value = 'Kon niet ontkoppelen'
  } finally {
    loading.value = false
  }
}

// Check if Hue is configured
const isHueConfigured = computed(() => hueService.isConfigured())

// Format time
const formatTime = (timestamp) => {
  if (!timestamp) return '-'
  return new Date(timestamp).toLocaleTimeString('nl-NL', {
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-900">Philips Hue Koppelen</h1>
      <p class="text-gray-500 mt-1">Verbind je Hue motion sensoren met Sensor.Care</p>
    </div>

    <!-- Error/Success messages -->
    <div v-if="error" class="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
      <AlertCircle class="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
      <p class="text-red-700">{{ error }}</p>
    </div>

    <div v-if="success" class="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
      <CheckCircle class="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
      <p class="text-green-700">{{ success }}</p>
    </div>

    <!-- Not configured warning -->
    <div v-if="!isHueConfigured" class="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
      <div class="flex items-start gap-3">
        <AlertCircle class="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
        <div>
          <p class="text-yellow-800 font-medium">Hue API niet geconfigureerd</p>
          <p class="text-yellow-700 text-sm mt-1">
            Voeg VITE_HUE_CLIENT_ID en VITE_HUE_CLIENT_SECRET toe aan je .env bestand.
            Registreer eerst een app op
            <a href="https://developers.meethue.com/" target="_blank" class="underline">developers.meethue.com</a>
          </p>
        </div>
      </div>
    </div>

    <!-- Step 1: Not connected -->
    <div v-if="step === 1" class="bg-white rounded-xl border border-gray-200 p-8">
      <div class="text-center">
        <div class="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Lightbulb class="w-10 h-10 text-amber-600" />
        </div>

        <h2 class="text-xl font-semibold text-gray-900 mb-2">Verbind met Philips Hue</h2>
        <p class="text-gray-500 mb-8 max-w-md mx-auto">
          Koppel je Hue Bridge om motion sensor data automatisch te synchroniseren met Sensor.Care.
        </p>

        <button
          @click="startOAuth"
          :disabled="!isHueConfigured || loading"
          class="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 text-white font-medium rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ExternalLink class="w-5 h-5" />
          Verbinden met Hue
        </button>

        <p class="text-sm text-gray-400 mt-4">
          Je wordt doorgestuurd naar Philips om in te loggen
        </p>
      </div>
    </div>

    <!-- Step 2: Connecting -->
    <div v-if="step === 2" class="bg-white rounded-xl border border-gray-200 p-8">
      <div class="text-center">
        <RefreshCw class="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
        <h2 class="text-xl font-semibold text-gray-900 mb-2">Verbinden...</h2>
        <p class="text-gray-500">Even geduld, we koppelen je Hue Bridge</p>
      </div>
    </div>

    <!-- Step 3: Connected -->
    <div v-if="step === 3" class="space-y-6">
      <!-- Connection status -->
      <div class="bg-white rounded-xl border border-gray-200 p-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Wifi class="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 class="font-semibold text-gray-900">Hue Bridge Verbonden</h3>
              <p class="text-sm text-gray-500">{{ sensors.length }} sensoren gevonden</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="loadSensors"
              :disabled="loading"
              class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw class="w-5 h-5" :class="{ 'animate-spin': loading }" />
            </button>
            <button
              @click="disconnect"
              class="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              Ontkoppelen
            </button>
          </div>
        </div>
      </div>

      <!-- Sensors list -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div class="p-6 border-b border-gray-100">
          <div class="flex items-center justify-between">
            <h3 class="font-semibold text-gray-900">Motion Sensoren</h3>
            <button
              @click="syncSensorData"
              :disabled="syncingData || sensors.length === 0"
              class="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
            >
              <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': syncingData }" />
              Synchroniseren
            </button>
          </div>
        </div>

        <div v-if="sensors.length === 0" class="p-8 text-center text-gray-500">
          Geen motion sensoren gevonden op je Hue Bridge
        </div>

        <div v-else class="divide-y divide-gray-100">
          <div
            v-for="sensor in sensors"
            :key="sensor.id"
            class="p-4 hover:bg-gray-50 transition-colors"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-4">
                <div
                  class="w-10 h-10 rounded-lg flex items-center justify-center"
                  :class="sensor.presence ? 'bg-blue-100' : 'bg-gray-100'"
                >
                  <Eye
                    class="w-5 h-5"
                    :class="sensor.presence ? 'text-blue-600' : 'text-gray-400'"
                  />
                </div>
                <div>
                  <h4 class="font-medium text-gray-900">{{ sensor.name }}</h4>
                  <div class="flex items-center gap-4 mt-1 text-sm text-gray-500">
                    <span class="flex items-center gap-1">
                      <Eye class="w-3.5 h-3.5" />
                      {{ sensor.presence ? 'Beweging' : 'Geen beweging' }}
                    </span>
                    <span v-if="sensor.temperature" class="flex items-center gap-1">
                      <Thermometer class="w-3.5 h-3.5" />
                      {{ sensor.temperature.toFixed(1) }}°C
                    </span>
                    <span v-if="sensor.dark !== undefined" class="flex items-center gap-1">
                      <Sun class="w-3.5 h-3.5" />
                      {{ sensor.dark ? 'Donker' : 'Licht' }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="text-right">
                <div class="flex items-center gap-1 text-sm text-gray-500">
                  <Battery class="w-4 h-4" />
                  {{ sensor.battery || '-' }}%
                </div>
                <p class="text-xs text-gray-400 mt-1">
                  {{ formatTime(sensor.presenceUpdated) }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Info box -->
      <div class="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p class="text-sm text-blue-800">
          <strong>Tip:</strong> Klik op "Synchroniseren" om de huidige sensor status op te slaan.
          Voor automatische synchronisatie moet je een backend service draaien of een Supabase Edge Function gebruiken.
        </p>
      </div>
    </div>
  </div>
</template>
