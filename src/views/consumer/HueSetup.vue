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

// Trigger hue-poller to run alive check (battery/reachable) for all sensors
async function triggerAliveCheck() {
  try {
    console.log('[HueSetup] Triggering alive check via hue-poller...')
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hue-poller`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({})
      }
    )

    const result = await response.json()
    console.log('[HueSetup] Alive check result:', result)
    return result
  } catch (e) {
    console.error('[HueSetup] Alive check failed:', e)
    return null
  }
}

// Check if already connected
onMounted(async () => {
  console.log('[HueSetup] onMounted starting...')

  // Wait for auth to be initialized
  let attempts = 0
  while (!authStore.initialized && attempts < 50) {
    await new Promise(resolve => setTimeout(resolve, 100))
    attempts++
  }
  console.log('[HueSetup] Auth initialized after', attempts, 'attempts. User:', authStore.user?.id)

  // Check if user is logged in
  if (!authStore.user?.id) {
    console.error('[HueSetup] No user ID available')
    error.value = 'Je moet ingelogd zijn om Hue te koppelen'
    loading.value = false
    return
  }

  // First check for pending connection from HueCallback.vue
  const pendingConnection = localStorage.getItem('hue_pending_connection')
  console.log('[HueSetup] Pending connection in localStorage:', pendingConnection ? 'YES' : 'NO')

  if (pendingConnection) {
    console.log('[HueSetup] Found pending Hue connection, saving to database...')
    console.log('[HueSetup] User ID:', authStore.user.id)

    try {
      const hueData = JSON.parse(pendingConnection)
      console.log('[HueSetup] Parsed hueData:', { ...hueData, access_token: '***', refresh_token: '***' })

      // Check if data is fresh (within 5 minutes)
      const dataAge = Date.now() - hueData.timestamp
      console.log('[HueSetup] Data age:', dataAge, 'ms (max 300000)')

      if (dataAge < 300000) {
        loading.value = true
        step.value = 2

        // Calculate token expiry
        const expiresAt = new Date(Date.now() + hueData.expires_in * 1000)

        // Get user's household_id
        const { data: profileData } = await supabase
          .from('profiles')
          .select('household_id')
          .eq('id', authStore.user.id)
          .single()

        const householdId = profileData?.household_id
        console.log('[HueSetup] Household ID:', householdId)

        // New integrations table format
        const insertData = {
          user_id: authStore.user.id,
          household_id: householdId,
          type: 'hue',
          name: 'Hue Bridge',
          config: {
            access_token: hueData.access_token,
            refresh_token: hueData.refresh_token,
            token_expires_at: expiresAt.toISOString(),
            bridge_username: hueData.bridge_username
          },
          status: 'active',
          last_sync_at: new Date().toISOString()
        }
        console.log('[HueSetup] Inserting data to integrations table')

        // Save to Supabase integrations table
        let saveError = null
        let savedData = null

        try {
          // Check if integration already exists
          const { data: existing } = await supabase
            .from('integrations')
            .select('id')
            .eq('user_id', authStore.user.id)
            .eq('type', 'hue')
            .maybeSingle()

          if (existing) {
            // Update existing
            console.log('[HueSetup] Updating existing integration:', existing.id)
            const updateResult = await supabase
              .from('integrations')
              .update({
                config: insertData.config,
                status: 'active',
                last_sync_at: insertData.last_sync_at,
                updated_at: new Date().toISOString()
              })
              .eq('id', existing.id)
              .select()

            savedData = updateResult.data
            saveError = updateResult.error
          } else {
            // Insert new
            console.log('[HueSetup] Creating new integration')
            const insertResult = await supabase
              .from('integrations')
              .insert(insertData)
              .select()

            savedData = insertResult.data
            saveError = insertResult.error
          }
        } catch (e) {
          console.error('[HueSetup] Supabase exception:', e)
          saveError = { message: e.message }
        }

        console.log('[HueSetup] Final result - data:', savedData, 'error:', saveError)

        // Remove from localStorage AFTER successful save
        localStorage.removeItem('hue_pending_connection')

        if (saveError) {
          console.error('[HueSetup] Save error:', saveError)
          error.value = 'Kon verbinding niet opslaan: ' + saveError.message
          step.value = 1
        } else {
          console.log('[HueSetup] Successfully saved to database')
          hueConnection.value = {
            access_token: hueData.access_token,
            refresh_token: hueData.refresh_token,
            bridge_username: hueData.bridge_username
          }
          success.value = 'Hue Bridge succesvol gekoppeld!'
          step.value = 3

          // Trigger alive check to get initial battery/reachable data
          await triggerAliveCheck()

          await loadSensors()
        }

        loading.value = false
        return
      } else {
        console.log('[HueSetup] Data too old, removing from localStorage')
        localStorage.removeItem('hue_pending_connection')
      }
    } catch (e) {
      console.error('[HueSetup] Error processing pending connection:', e)
      localStorage.removeItem('hue_pending_connection')
    }
  } else {
    console.log('[HueSetup] No pending connection, checking existing...')
  }

  await checkExistingConnection()
})

// Check for existing Hue connection in integrations table
async function checkExistingConnection() {
  console.log('[HueSetup] checkExistingConnection starting...')
  loading.value = true

  try {
    if (!authStore.user?.id) {
      console.log('[HueSetup] No user ID in checkExistingConnection')
      loading.value = false
      step.value = 1
      return
    }

    console.log('[HueSetup] Querying integrations for user:', authStore.user.id)
    const { data, error: fetchError } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', authStore.user.id)
      .eq('type', 'hue')
      .maybeSingle()

    console.log('[HueSetup] Query result - data:', data, 'error:', fetchError)

    if (data && !fetchError) {
      console.log('[HueSetup] Found existing connection')
      // Map integrations format to hueConnection format
      hueConnection.value = {
        id: data.id,
        access_token: data.config?.access_token,
        refresh_token: data.config?.refresh_token,
        bridge_username: data.config?.bridge_username,
        token_expires_at: data.config?.token_expires_at
      }
      step.value = 3

      // Check if token needs refresh
      if (data.config?.token_expires_at && new Date(data.config.token_expires_at) < new Date()) {
        await refreshToken()
      }

      // Load sensors
      await loadSensors()
    } else {
      console.log('[HueSetup] No existing connection, showing step 1')
      step.value = 1
    }
  } catch (e) {
    console.error('[HueSetup] Error in checkExistingConnection:', e)
    step.value = 1
  } finally {
    console.log('[HueSetup] checkExistingConnection done, step:', step.value)
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

    // Get user's household_id
    const { data: profileData } = await supabase
      .from('profiles')
      .select('household_id')
      .eq('id', authStore.user.id)
      .single()

    // Save to Supabase integrations table
    const { error: saveError } = await supabase
      .from('integrations')
      .upsert({
        user_id: authStore.user?.id,
        household_id: profileData?.household_id,
        type: 'hue',
        name: 'Hue Bridge',
        config: {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: expiresAt.toISOString(),
          bridge_username: username
        },
        status: 'active',
        last_sync_at: new Date().toISOString()
      }, { onConflict: 'user_id,type' })

    if (saveError) throw saveError

    hueConnection.value = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      bridge_username: username
    }

    success.value = 'Hue Bridge succesvol gekoppeld!'
    step.value = 3

    // Trigger alive check to get initial battery/reachable data
    await triggerAliveCheck()

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

    // Update in integrations table
    await supabase
      .from('integrations')
      .update({
        config: {
          ...hueConnection.value,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: expiresAt.toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('user_id', authStore.user?.id)
      .eq('type', 'hue')

    hueConnection.value.access_token = tokenData.access_token
    hueConnection.value.refresh_token = tokenData.refresh_token
  } catch (e) {
    console.error('Token refresh failed:', e)
    error.value = 'Sessie verlopen. Koppel opnieuw.'
    step.value = 1
    hueConnection.value = null
  }
}

// Load sensors from Hue Bridge (motion + contact sensors)
async function loadSensors() {
  if (!hueConnection.value) return

  loading.value = true

  try {
    // Load both v1 motion sensors and v2 contact sensors
    const [motionSensors, contactSensors] = await Promise.all([
      hueService.getAllSensorStates(
        hueConnection.value.access_token,
        hueConnection.value.bridge_username
      ),
      hueService.getContactSensors(
        hueConnection.value.access_token,
        hueConnection.value.bridge_username
      ).catch(err => {
        console.warn('[HueSetup] Contact sensors not available:', err)
        return []
      })
    ])

    // Combine both sensor types
    sensors.value = [...motionSensors, ...contactSensors]
    console.log('[HueSetup] Loaded sensors:', sensors.value.length, '(motion:', motionSensors.length, ', contact:', contactSensors.length, ')')
  } catch (e) {
    console.error('Failed to load sensors:', e)
    error.value = 'Kon sensoren niet laden'
  } finally {
    loading.value = false
  }
}

// Sync sensor data to database (rooms + room_events)
async function syncSensorData() {
  if (!hueConnection.value || sensors.value.length === 0) return

  syncingData.value = true
  error.value = ''

  try {
    const now = new Date().toISOString()

    // Get integration ID
    const { data: integration } = await supabase
      .from('integrations')
      .select('id')
      .eq('user_id', authStore.user?.id)
      .eq('type', 'hue')
      .single()

    if (!integration) {
      throw new Error('Geen Hue integratie gevonden')
    }

    let roomsCreated = 0
    let eventsCreated = 0

    // Cache for room IDs
    const roomCache = new Map()

    for (const sensor of sensors.value) {
      const roomName = sensor.name
      console.log(`[Sync] Processing sensor: ${roomName}, type: ${sensor.type || 'motion'}, presence: ${sensor.presence}, presenceUpdated: ${sensor.presenceUpdated}`)

      // 1. Get or create room
      let roomId = roomCache.get(roomName)

      if (!roomId) {
        // Try to find existing room
        const { data: existingRoom } = await supabase
          .from('rooms')
          .select('id')
          .eq('name', roomName)
          .eq('integration_id', integration.id)
          .maybeSingle()

        if (existingRoom) {
          roomId = existingRoom.id
          console.log(`[Sync] Found existing room: ${roomName} -> ${roomId}`)
        } else {
          // Create new room
          const { data: newRoom, error: createError } = await supabase
            .from('rooms')
            .insert({
              name: roomName,
              integration_id: integration.id
            })
            .select('id')
            .single()

          if (createError) {
            console.error(`[Sync] Failed to create room ${roomName}:`, createError)
            continue
          }

          roomId = newRoom.id
          roomsCreated++
          console.log(`[Sync] Created new room: ${roomName} -> ${roomId}`)
        }

        roomCache.set(roomName, roomId)
      }

      if (!roomId) continue

      // 2. Create room_event for motion sensors (always create if sensor has presenceUpdated)
      if (sensor.presenceUpdated) {
        console.log(`[Sync] Inserting motion event for ${roomName}, presence: ${sensor.presence}, at: ${sensor.presenceUpdated}`)
        const { error: eventError } = await supabase
          .from('room_events')
          .insert({
            room_id: roomId,
            source: 'motion',
            recorded_at: sensor.presenceUpdated
          })

        if (eventError) {
          console.error(`[Sync] Failed to insert motion event for ${roomName}:`, eventError)
        } else {
          eventsCreated++
          console.log(`[Sync] ✓ Motion event created for ${roomName}`)
        }
      }

      // 3. Create room_event for contact sensors (door)
      if (sensor.type === 'contact') {
        console.log(`[Sync] Inserting door event for ${roomName}, contact: ${sensor.contact_report}, at: ${sensor.lastUpdated || now}`)
        const { error: eventError } = await supabase
          .from('room_events')
          .insert({
            room_id: roomId,
            source: 'door',
            recorded_at: sensor.lastUpdated || now
          })

        if (eventError) {
          console.error(`[Sync] Failed to insert door event for ${roomName}:`, eventError)
        } else {
          eventsCreated++
          console.log(`[Sync] ✓ Door event created for ${roomName}`)
        }
      }
    }

    success.value = `${roomsCreated} kamers, ${eventsCreated} events gesynchroniseerd!`
    console.log(`[Sync] Complete: ${roomsCreated} rooms, ${eventsCreated} events`)

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
    // Delete from integrations table
    await supabase
      .from('integrations')
      .delete()
      .eq('user_id', authStore.user?.id)
      .eq('type', 'hue')

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
