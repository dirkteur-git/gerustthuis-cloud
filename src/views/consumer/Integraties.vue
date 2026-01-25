<script setup>
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/services/supabase'
import hueService from '@/services/hue'
import {
  Plug,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Trash2,
  Home,
  Activity,
  Lightbulb,
  Plus,
  Settings,
  Wifi,
  WifiOff
} from 'lucide-vue-next'

const authStore = useAuthStore()
const loading = ref(true)
const syncing = ref(false)
const error = ref('')
const success = ref('')

// Integration data from database
const integrations = ref([])

// Available integration types
const availableIntegrations = [
  {
    id: 'hue',
    name: 'Philips Hue',
    description: 'Motion sensoren en lampen',
    icon: 'hue',
    enabled: true
  },
  {
    id: 'home_assistant',
    name: 'Home Assistant',
    description: 'Lokale sensoren via Pi',
    icon: 'ha',
    enabled: false,
    comingSoon: true
  },
  {
    id: 'aqara',
    name: 'Aqara',
    description: 'Zigbee sensoren',
    icon: 'aqara',
    enabled: false,
    comingSoon: true
  }
]

// Load integrations on mount
onMounted(async () => {
  console.log('[Integraties] Component mounted')
  try {
    await loadIntegrations()
  } catch (e) {
    console.error('[Integraties] Mount error:', e)
    loading.value = false
  }
})

async function loadIntegrations() {
  loading.value = true
  error.value = ''

  try {
    const { data, error: fetchError } = await supabase
      .from('integrations')
      .select(`
        *,
        rooms:rooms(id, name, hue_group_id),
        items:items(id, name, type, room_id)
      `)
      .order('created_at', { ascending: false })

    if (fetchError) {
      console.warn('[Integraties] Fetch error:', fetchError)
    }
    integrations.value = data || []
    console.log('[Integraties] Loaded:', integrations.value.length, 'integrations')
  } catch (e) {
    console.error('[Integraties] Error:', e)
    integrations.value = []
  } finally {
    loading.value = false
  }
}

// Get connected integration by type
const getIntegration = (type) => {
  return integrations.value.find(i => i.type === type)
}

// Computed: active integrations
const activeIntegrations = computed(() => {
  return integrations.value.filter(i => i.status === 'active')
})

// Computed: available (not yet connected) integrations
const notConnectedIntegrations = computed(() => {
  return availableIntegrations.filter(ai => {
    const connected = integrations.value.find(i => i.type === ai.id)
    return !connected && ai.enabled
  })
})

// Computed: coming soon integrations
const comingSoonIntegrations = computed(() => {
  return availableIntegrations.filter(ai => ai.comingSoon)
})

const hueIntegration = computed(() => getIntegration('hue'))
const isHueConfigured = computed(() => hueService.isConfigured())

// Start Hue OAuth flow
function connectHue() {
  if (!isHueConfigured.value) {
    error.value = 'Hue API niet geconfigureerd'
    return
  }
  const state = crypto.randomUUID()
  localStorage.setItem('hue_oauth_state', state)
  const authUrl = hueService.getAuthorizationUrl(state)
  window.location.href = authUrl
}

// Disconnect integration
async function disconnectIntegration(integration) {
  const typeName = integration.type === 'hue' ? 'Philips Hue' : integration.name
  if (!confirm(`Weet je zeker dat je ${typeName} wilt ontkoppelen?`)) return

  try {
    // Delete related items and rooms first
    await supabase.from('items').delete().eq('integration_id', integration.id)
    await supabase.from('rooms').delete().eq('integration_id', integration.id)
    await supabase.from('integrations').delete().eq('id', integration.id)

    success.value = `${typeName} ontkoppeld`
    await loadIntegrations()
  } catch (e) {
    console.error('[Integraties] Disconnect error:', e)
    error.value = 'Kon niet ontkoppelen: ' + e.message
  }
}

// Sync rooms from Hue
async function syncHueRooms(integration) {
  if (!integration) return

  syncing.value = true
  error.value = ''
  success.value = ''

  try {
    const config = integration.config
    const accessToken = config?.access_token
    const username = config?.bridge_username

    if (!accessToken || !username) {
      error.value = 'Hue niet correct geconfigureerd'
      return
    }

    const hueData = await hueService.getFullConfig(accessToken, username)

    const { data: profileData } = await supabase
      .from('profiles')
      .select('household_id')
      .eq('id', authStore.user.id)
      .single()

    const householdId = profileData?.household_id

    // Sync rooms
    for (const room of hueData.rooms) {
      const { data: existingRoom } = await supabase
        .from('rooms')
        .select('id')
        .eq('integration_id', integration.id)
        .eq('hue_group_id', room.id)
        .maybeSingle()

      if (existingRoom) {
        await supabase
          .from('rooms')
          .update({ name: room.name, hue_class: room.class, last_synced_at: new Date().toISOString() })
          .eq('id', existingRoom.id)
      } else {
        await supabase.from('rooms').insert({
          name: room.name,
          household_id: householdId,
          integration_id: integration.id,
          hue_group_id: room.id,
          hue_class: room.class,
          last_synced_at: new Date().toISOString()
        })
      }
    }

    // Sync sensors
    for (const sensor of hueData.sensors) {
      const sensorRoom = hueData.rooms.find(r => r.sensorDetails?.some(s => s.id === sensor.id))
      let roomId = null
      if (sensorRoom) {
        const { data: dbRoom } = await supabase
          .from('rooms')
          .select('id')
          .eq('integration_id', integration.id)
          .eq('hue_group_id', sensorRoom.id)
          .maybeSingle()
        roomId = dbRoom?.id
      }

      const { data: existingItem } = await supabase
        .from('items')
        .select('id')
        .eq('hue_unique_id', sensor.id)
        .maybeSingle()

      if (existingItem) {
        await supabase
          .from('items')
          .update({ name: sensor.name, room_id: roomId, config: { battery: sensor.battery, reachable: sensor.reachable } })
          .eq('id', existingItem.id)
      } else {
        await supabase.from('items').insert({
          name: sensor.name,
          type: 'sensor',
          room_id: roomId,
          household_id: householdId,
          integration_id: integration.id,
          hue_unique_id: sensor.id,
          config: { battery: sensor.battery, reachable: sensor.reachable }
        })
      }
    }

    // Sync lights
    for (const light of hueData.lights) {
      const lightRoom = hueData.rooms.find(r => r.lights?.includes(light.id))
      let roomId = null
      if (lightRoom) {
        const { data: dbRoom } = await supabase
          .from('rooms')
          .select('id')
          .eq('integration_id', integration.id)
          .eq('hue_group_id', lightRoom.id)
          .maybeSingle()
        roomId = dbRoom?.id
      }

      const { data: existingItem } = await supabase
        .from('items')
        .select('id')
        .eq('hue_unique_id', light.uniqueid)
        .maybeSingle()

      if (existingItem) {
        await supabase
          .from('items')
          .update({ name: light.name, room_id: roomId, config: { type: light.type, modelid: light.modelid } })
          .eq('id', existingItem.id)
      } else {
        await supabase.from('items').insert({
          name: light.name,
          type: 'light',
          room_id: roomId,
          household_id: householdId,
          integration_id: integration.id,
          hue_unique_id: light.uniqueid,
          config: { type: light.type, modelid: light.modelid }
        })
      }
    }

    await supabase
      .from('integrations')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', integration.id)

    success.value = `Sync voltooid: ${hueData.rooms.length} kamers, ${hueData.sensors.length} sensoren, ${hueData.lights.length} lampen`
    await loadIntegrations()
  } catch (e) {
    console.error('[Integraties] Sync error:', e)
    error.value = 'Sync mislukt: ' + e.message
  } finally {
    syncing.value = false
  }
}

const formatTimeAgo = (timestamp) => {
  if (!timestamp) return 'Nooit'
  const diff = Date.now() - new Date(timestamp).getTime()
  if (diff < 60000) return 'Nu'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min geleden`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} uur geleden`
  return `${Math.floor(diff / 86400000)} dagen geleden`
}

const getIntegrationIcon = (type) => {
  if (type === 'hue') return 'hue'
  if (type === 'home_assistant') return 'ha'
  if (type === 'aqara') return 'aqara'
  return 'default'
}
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-900 flex items-center gap-3">
        <Plug class="w-7 h-7" />
        Integraties
      </h1>
      <p class="text-gray-500 mt-1">Koppel je smart home systemen met GerustThuis</p>
    </div>

    <!-- Messages -->
    <div v-if="error" class="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
      <AlertCircle class="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
      <p class="text-red-700">{{ error }}</p>
    </div>

    <div v-if="success" class="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
      <CheckCircle class="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
      <p class="text-green-700">{{ success }}</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <RefreshCw class="w-8 h-8 text-gray-400 animate-spin" />
    </div>

    <div v-else class="space-y-8">
      <!-- SECTION 1: Actieve Integraties -->
      <section v-if="activeIntegrations.length > 0">
        <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Wifi class="w-5 h-5 text-green-500" />
          Actieve Integraties
        </h2>

        <div class="space-y-3">
          <div
            v-for="integration in activeIntegrations"
            :key="integration.id"
            class="bg-white rounded-xl border border-gray-200 p-5"
          >
            <div class="flex items-center justify-between">
              <!-- Left: Logo + Info -->
              <div class="flex items-center gap-4">
                <!-- Hue Logo -->
                <div v-if="integration.type === 'hue'" class="w-12 h-12 flex items-center justify-center">
                  <svg viewBox="0 0 512 512" class="w-10 h-10">
                    <rect width="512" height="512" rx="100" fill="#0065D3"/>
                    <g fill="white">
                      <path d="M256 140c-64 0-116 52-116 116s52 116 116 116 116-52 116-116-52-116-116-116zm0 200c-46 0-84-38-84-84s38-84 84-84 84 38 84 84-38 84-84 84z"/>
                      <circle cx="256" cy="256" r="50"/>
                    </g>
                  </svg>
                </div>

                <div>
                  <h3 class="font-semibold text-gray-900">{{ integration.name || 'Philips Hue' }}</h3>
                  <div class="flex items-center gap-4 mt-1 text-sm text-gray-500">
                    <span class="flex items-center gap-1">
                      <Home class="w-4 h-4" />
                      {{ integration.rooms?.length || 0 }} kamers
                    </span>
                    <span class="flex items-center gap-1">
                      <Activity class="w-4 h-4" />
                      {{ integration.items?.filter(i => i.type === 'sensor').length || 0 }} sensoren
                    </span>
                    <span class="flex items-center gap-1">
                      <Lightbulb class="w-4 h-4" />
                      {{ integration.items?.filter(i => i.type === 'light').length || 0 }} lampen
                    </span>
                  </div>
                  <p class="text-xs text-gray-400 mt-1">
                    Laatste sync: {{ formatTimeAgo(integration.last_sync_at) }}
                  </p>
                </div>
              </div>

              <!-- Right: Actions -->
              <div class="flex items-center gap-2">
                <button
                  @click="syncHueRooms(integration)"
                  :disabled="syncing"
                  class="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                >
                  <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': syncing }" />
                  Sync
                </button>
                <button
                  @click="disconnectIntegration(integration)"
                  class="inline-flex items-center gap-2 px-4 py-2 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Trash2 class="w-4 h-4" />
                  Ontkoppelen
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Empty state when no integrations -->
      <div v-if="activeIntegrations.length === 0" class="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
        <WifiOff class="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 class="text-lg font-medium text-gray-900 mb-2">Geen actieve integraties</h3>
        <p class="text-gray-500 mb-4">Koppel een smart home systeem om te beginnen</p>
      </div>

      <!-- SECTION 2: Integratie Toevoegen -->
      <section v-if="notConnectedIntegrations.length > 0">
        <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Plus class="w-5 h-5 text-gray-400" />
          Integratie Toevoegen
        </h2>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <!-- Hue (if not connected) -->
          <button
            v-for="available in notConnectedIntegrations"
            :key="available.id"
            @click="available.id === 'hue' ? connectHue() : null"
            class="bg-white rounded-xl border-2 border-gray-200 p-5 text-left transition-all hover:border-blue-400 hover:shadow-md group"
          >
            <div class="flex items-center gap-3 mb-3">
              <!-- Hue Logo -->
              <div v-if="available.id === 'hue'" class="w-10 h-10 flex items-center justify-center">
                <svg viewBox="0 0 512 512" class="w-8 h-8">
                  <rect width="512" height="512" rx="100" fill="#0065D3"/>
                  <g fill="white">
                    <path d="M256 140c-64 0-116 52-116 116s52 116 116 116 116-52 116-116-52-116-116-116zm0 200c-46 0-84-38-84-84s38-84 84-84 84 38 84 84-38 84-84 84z"/>
                    <circle cx="256" cy="256" r="50"/>
                  </g>
                </svg>
              </div>
              <div>
                <h3 class="font-semibold text-gray-900">{{ available.name }}</h3>
                <p class="text-sm text-gray-500">{{ available.description }}</p>
              </div>
            </div>
            <div class="flex items-center text-sm font-medium text-blue-600 group-hover:text-blue-700">
              <Plus class="w-4 h-4 mr-1" />
              Toevoegen
            </div>
          </button>
        </div>
      </section>

      <!-- SECTION 3: Binnenkort Beschikbaar -->
      <section v-if="comingSoonIntegrations.length > 0">
        <h2 class="text-lg font-semibold text-gray-500 mb-4">Binnenkort Beschikbaar</h2>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="coming in comingSoonIntegrations"
            :key="coming.id"
            class="bg-gray-50 rounded-xl border border-gray-200 p-5 opacity-60"
          >
            <div class="flex items-center gap-3 mb-3">
              <!-- Home Assistant Logo -->
              <div v-if="coming.id === 'home_assistant'" class="w-10 h-10 flex items-center justify-center">
                <svg viewBox="0 0 240 240" class="w-8 h-8">
                  <rect width="240" height="240" rx="40" fill="#18BCF2"/>
                  <path d="M120 20L200 100V180C200 191 191 200 180 200H60C49 200 40 191 40 180V100L120 20Z" fill="white"/>
                  <path d="M120 60L160 100V160H140V120H100V160H80V100L120 60Z" fill="#18BCF2"/>
                </svg>
              </div>
              <!-- Aqara Logo -->
              <div v-else-if="coming.id === 'aqara'" class="w-10 h-10 flex items-center justify-center">
                <svg viewBox="0 0 240 240" class="w-8 h-8">
                  <rect width="240" height="240" rx="40" fill="#47B881"/>
                  <circle cx="120" cy="100" r="40" fill="white"/>
                  <rect x="80" y="130" width="80" height="60" rx="10" fill="white"/>
                </svg>
              </div>
              <div>
                <h3 class="font-semibold text-gray-700">{{ coming.name }}</h3>
                <p class="text-sm text-gray-500">{{ coming.description }}</p>
              </div>
            </div>
            <span class="inline-block text-xs font-medium text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
              Binnenkort
            </span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
