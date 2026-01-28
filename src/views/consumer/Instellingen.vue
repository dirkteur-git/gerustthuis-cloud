<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/services/supabase'
import hueService from '@/services/hue'
import measurementService from '@/services/measurementService'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import Tabs from '@/components/ui/Tabs.vue'
import {
  Radio,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Trash2,
  Home,
  Activity,
  Lightbulb,
  ChevronRight,
  X
} from 'lucide-vue-next'

const authStore = useAuthStore()

// Tabs
const tabs = [
  { id: 'profile', label: 'Profiel' },
  { id: 'notifications', label: 'Notificaties' },
  { id: 'sensors', label: 'Sensoren' },
  { id: 'integrations', label: 'Integraties' }
]

const activeTab = ref('profile')

// Profile form
const profile = ref({
  firstName: authStore.user?.firstName || '',
  lastName: authStore.user?.lastName || '',
  email: authStore.user?.email || '',
  phone: ''
})

// Notification settings
const notifications = ref({
  dailySummary: true,
  dailySummaryTime: '08:00',
  instantAlerts: true,
  alertEmail: true,
  alertSms: false,
  alertPush: true,
  nightMode: true,
  nightStart: '22:00',
  nightEnd: '07:00'
})

// ============================================
// Integraties Logic
// ============================================
const integrationLoading = ref(true)
const syncing = ref(false)
const integrationError = ref('')
const integrationSuccess = ref('')
const showHueDetails = ref(false)
const dbIntegrations = ref([])

onMounted(async () => {
  await loadIntegrations()
})

async function loadIntegrations() {
  integrationLoading.value = true
  integrationError.value = ''

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
      console.warn('[Instellingen] Fetch error:', fetchError)
      // Niet als fout tonen - gewoon lege lijst (kan RLS zijn of nog geen integraties)
    }
    dbIntegrations.value = data || []
  } catch (e) {
    console.error('[Instellingen] Error:', e)
    // Stille fout - toon gewoon lege kaarten
    dbIntegrations.value = []
  } finally {
    integrationLoading.value = false
  }
}

const hueIntegration = computed(() => dbIntegrations.value.find(i => i.type === 'hue'))
const isHueConfigured = computed(() => hueService.isConfigured())

function handleHueClick() {
  if (hueIntegration.value) {
    showHueDetails.value = true
  } else {
    connectHue()
  }
}

function connectHue() {
  if (!isHueConfigured.value) {
    integrationError.value = 'Hue API niet geconfigureerd'
    return
  }
  const state = crypto.randomUUID()
  localStorage.setItem('hue_oauth_state', state)
  const authUrl = hueService.getAuthorizationUrl(state)
  window.location.href = authUrl
}

async function disconnectHue() {
  if (!hueIntegration.value) return
  if (!confirm('Weet je zeker dat je Philips Hue wilt ontkoppelen?')) return

  try {
    await supabase.from('items').delete().eq('integration_id', hueIntegration.value.id)
    await supabase.from('rooms').delete().eq('integration_id', hueIntegration.value.id)
    await supabase.from('integrations').delete().eq('id', hueIntegration.value.id)

    integrationSuccess.value = 'Philips Hue ontkoppeld'
    showHueDetails.value = false
    await loadIntegrations()
  } catch (e) {
    integrationError.value = 'Kon niet ontkoppelen'
  }
}

async function syncHueRooms() {
  if (!hueIntegration.value) return

  syncing.value = true
  integrationError.value = ''
  integrationSuccess.value = ''

  try {
    const config = hueIntegration.value.config
    const accessToken = config?.access_token
    const username = config?.bridge_username

    if (!accessToken || !username) {
      integrationError.value = 'Hue niet correct geconfigureerd'
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
        .eq('integration_id', hueIntegration.value.id)
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
          integration_id: hueIntegration.value.id,
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
          .eq('integration_id', hueIntegration.value.id)
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
          integration_id: hueIntegration.value.id,
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
          .eq('integration_id', hueIntegration.value.id)
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
          integration_id: hueIntegration.value.id,
          hue_unique_id: light.uniqueid,
          config: { type: light.type, modelid: light.modelid }
        })
      }
    }

    // ============================================
    // STAP 4: Sla ALLE measurements op (RAW data)
    // ============================================
    let measurementsCreated = 0

    // Sensor measurements
    for (const sensor of hueData.sensors) {
      const { data: sensorItem } = await supabase
        .from('items')
        .select('id, room_id')
        .eq('hue_unique_id', sensor.id)
        .maybeSingle()

      if (sensorItem) {
        const count = await measurementService.saveSensorMeasurements(sensor, sensorItem.id)
        measurementsCreated += count
      }
    }

    // Light measurements
    for (const light of hueData.lights) {
      const { data: lightItem } = await supabase
        .from('items')
        .select('id')
        .eq('hue_unique_id', light.uniqueid)
        .maybeSingle()

      if (lightItem) {
        const count = await measurementService.saveLightMeasurements(light, lightItem.id)
        measurementsCreated += count
      }
    }

    console.log(`[Instellingen] Created ${measurementsCreated} measurements`)

    // ============================================
    // STAP 5: Maak room_events van presence/contact changes
    // ============================================
    let eventsCreated = 0

    for (const sensor of hueData.sensors) {
      const { data: sensorItem } = await supabase
        .from('items')
        .select('id, room_id')
        .eq('hue_unique_id', sensor.id)
        .maybeSingle()

      if (sensorItem?.room_id) {
        // Motion event (alleen als presence=true)
        if (sensor.presence && sensor.presenceUpdated) {
          const { error: eventError } = await supabase
            .from('room_events')
            .insert({
              room_id: sensorItem.room_id,
              source: 'motion',
              recorded_at: sensor.presenceUpdated
            })
          if (!eventError) eventsCreated++
        }

        // Contact/door event
        if (sensor.type === 'contact' && sensor.lastUpdated) {
          const { error: eventError } = await supabase
            .from('room_events')
            .insert({
              room_id: sensorItem.room_id,
              source: 'door',
              recorded_at: sensor.lastUpdated
            })
          if (!eventError) eventsCreated++
        }
      }
    }

    // Light events (als een lamp aan gaat)
    for (const light of hueData.lights) {
      if (light.state?.on) {
        const { data: lightItem } = await supabase
          .from('items')
          .select('id, room_id')
          .eq('hue_unique_id', light.uniqueid)
          .maybeSingle()

        if (lightItem?.room_id) {
          const { error: eventError } = await supabase
            .from('room_events')
            .insert({
              room_id: lightItem.room_id,
              source: 'light',
              recorded_at: new Date().toISOString()
            })
          if (!eventError) eventsCreated++
        }
      }
    }

    console.log(`[Instellingen] Created ${eventsCreated} room events`)

    await supabase
      .from('integrations')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', hueIntegration.value.id)

    integrationSuccess.value = `Sync voltooid: ${hueData.rooms.length} kamers, ${hueData.sensors.length} sensoren, ${hueData.lights.length} lampen, ${measurementsCreated} metingen, ${eventsCreated} events`
    await loadIntegrations()
  } catch (e) {
    console.error('[Instellingen] Sync error:', e)
    integrationError.value = 'Sync mislukt: ' + e.message
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
</script>

<template>
  <div class="p-6 max-w-5xl mx-auto space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-gray-900 mb-1">Instellingen</h1>
      <p class="text-gray-600">Beheer je account en voorkeuren</p>
    </div>

    <Tabs :tabs="tabs" v-model="activeTab">
      <!-- Profile -->
      <template #profile>
        <Card>
          <h3 class="text-lg font-bold text-gray-900 mb-6">Jouw gegevens</h3>
          <div class="space-y-4 max-w-md">
            <div class="grid sm:grid-cols-2 gap-4">
              <Input v-model="profile.firstName" label="Voornaam" />
              <Input v-model="profile.lastName" label="Achternaam" />
            </div>
            <Input v-model="profile.email" label="E-mailadres" type="email" />
            <Input v-model="profile.phone" label="Telefoonnummer" type="tel" />
            <Button variant="primary">Opslaan</Button>
          </div>
        </Card>

        <Card class="mt-6">
          <h3 class="text-lg font-bold text-gray-900 mb-6">Wachtwoord wijzigen</h3>
          <div class="space-y-4 max-w-md">
            <Input label="Huidig wachtwoord" type="password" />
            <Input label="Nieuw wachtwoord" type="password" />
            <Input label="Bevestig nieuw wachtwoord" type="password" />
            <Button variant="primary">Wachtwoord wijzigen</Button>
          </div>
        </Card>
      </template>

      <!-- Notifications -->
      <template #notifications>
        <div class="grid lg:grid-cols-2 gap-6">
          <Card>
            <h3 class="text-lg font-bold text-gray-900 mb-6">Systeem Status</h3>
            <div class="space-y-4">
              <p class="text-sm text-gray-600 mb-4">
                Je kunt in de app altijd zien of het systeem actief is en of er afwijkingen zijn gedetecteerd.
              </p>
              <Checkbox v-model="notifications.dailySummary">
                Dagelijkse bevestiging dat systeem actief is
              </Checkbox>
              <Input
                v-if="notifications.dailySummary"
                v-model="notifications.dailySummaryTime"
                label="Tijdstip"
                type="time"
              />
            </div>
          </Card>

          <Card>
            <h3 class="text-lg font-bold text-gray-900 mb-6">Alerts</h3>
            <div class="space-y-4">
              <Checkbox v-model="notifications.instantAlerts">
                Ontvang directe alerts bij afwijkingen
              </Checkbox>
              <div v-if="notifications.instantAlerts" class="space-y-3 ml-7">
                <Checkbox v-model="notifications.alertEmail">Via e-mail</Checkbox>
                <Checkbox v-model="notifications.alertSms">Via SMS</Checkbox>
                <Checkbox v-model="notifications.alertPush">Via push notificatie</Checkbox>
              </div>
            </div>
          </Card>

          <Card class="lg:col-span-2">
            <h3 class="text-lg font-bold text-gray-900 mb-6">Nachtmodus</h3>
            <div class="space-y-4">
              <Checkbox v-model="notifications.nightMode">
                Alleen urgente alerts tijdens nachtmodus
              </Checkbox>
              <div v-if="notifications.nightMode" class="grid sm:grid-cols-2 gap-4 max-w-md">
                <Input v-model="notifications.nightStart" label="Start nachtmodus" type="time" />
                <Input v-model="notifications.nightEnd" label="Einde nachtmodus" type="time" />
              </div>
            </div>
            <div class="mt-6">
              <Button variant="primary">Opslaan</Button>
            </div>
          </Card>
        </div>
      </template>

      <!-- Sensors -->
      <template #sensors>
        <Card>
          <div class="text-center max-w-md mx-auto py-8">
            <div class="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Radio class="w-8 h-8 text-blue-600" />
            </div>
            <h2 class="text-xl font-semibold text-gray-900 mb-3">Sensoren beheren</h2>
            <p class="text-gray-500 mb-6">
              Bekijk en beheer de sensoren die gekoppeld zijn aan uw woning.
              Deze worden automatisch gesynchroniseerd via uw integraties.
            </p>
            <p class="text-sm text-gray-400">
              Sensoren worden beheerd via de Woning pagina
            </p>
          </div>
        </Card>
      </template>

      <!-- Integrations -->
      <template #integrations>
        <!-- Messages -->
        <div v-if="integrationError" class="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle class="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p class="text-red-700">{{ integrationError }}</p>
        </div>

        <div v-if="integrationSuccess" class="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
          <CheckCircle class="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <p class="text-green-700">{{ integrationSuccess }}</p>
        </div>

        <!-- Loading -->
        <div v-if="integrationLoading" class="flex items-center justify-center py-12">
          <RefreshCw class="w-8 h-8 text-gray-400 animate-spin" />
        </div>

        <!-- Integration Cards Grid -->
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <!-- Philips Hue -->
          <button
            @click="handleHueClick"
            class="bg-white rounded-2xl border-2 p-6 text-left transition-all hover:shadow-lg group"
            :class="hueIntegration ? 'border-green-400 hover:border-green-500' : 'border-gray-200 hover:border-[#0065D3]'"
          >
            <div class="flex items-start justify-between mb-4">
              <!-- Philips Hue official logo -->
              <div class="w-16 h-16 flex items-center justify-center">
                <svg viewBox="0 0 512 512" class="w-14 h-14">
                  <rect width="512" height="512" rx="100" fill="#0065D3"/>
                  <g fill="white">
                    <path d="M256 140c-64 0-116 52-116 116s52 116 116 116 116-52 116-116-52-116-116-116zm0 200c-46 0-84-38-84-84s38-84 84-84 84 38 84 84-38 84-84 84z"/>
                    <circle cx="256" cy="256" r="50"/>
                    <path d="M256 80c-8 0-16 8-16 16v32c0 8 8 16 16 16s16-8 16-16V96c0-8-8-16-16-16zM256 368c-8 0-16 8-16 16v32c0 8 8 16 16 16s16-8 16-16v-32c0-8-8-16-16-16zM380 244h32c8 0 16 8 16 16s-8 16-16 16h-32c-8 0-16-8-16-16s8-16 16-16zM100 244h32c8 0 16 8 16 16s-8 16-16 16h-32c-8 0-16-8-16-16s8-16 16-16z"/>
                  </g>
                </svg>
              </div>
              <span
                v-if="hueIntegration"
                class="flex items-center gap-1.5 text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded-full"
              >
                <CheckCircle class="w-3.5 h-3.5" />
                Verbonden
              </span>
            </div>
            <h3 class="text-lg font-bold text-gray-900 mb-1">Philips Hue</h3>
            <p class="text-sm text-gray-500 mb-4">Motion sensoren en lampen</p>
            <div class="flex items-center text-sm font-medium" :class="hueIntegration ? 'text-green-600' : 'text-[#0065D3]'">
              {{ hueIntegration ? 'Beheren' : 'Toevoegen' }}
              <ChevronRight class="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          <!-- Home Assistant -->
          <div class="bg-white rounded-2xl border-2 border-gray-200 p-6 text-left opacity-50 cursor-not-allowed">
            <div class="flex items-start justify-between mb-4">
              <!-- Home Assistant official logo -->
              <div class="w-16 h-16 flex items-center justify-center">
                <svg viewBox="0 0 240 240" class="w-14 h-14">
                  <rect width="240" height="240" rx="40" fill="#18BCF2"/>
                  <path d="M120 20L200 100V180C200 191 191 200 180 200H60C49 200 40 191 40 180V100L120 20Z" fill="white"/>
                  <path d="M120 60L160 100V160H140V120H100V160H80V100L120 60Z" fill="#18BCF2"/>
                </svg>
              </div>
              <span class="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">Binnenkort</span>
            </div>
            <h3 class="text-lg font-bold text-gray-900 mb-1">Home Assistant</h3>
            <p class="text-sm text-gray-500 mb-4">Lokale sensoren via Pi</p>
            <div class="flex items-center text-sm font-medium text-gray-400">Binnenkort beschikbaar</div>
          </div>

          <!-- Aqara -->
          <div class="bg-white rounded-2xl border-2 border-gray-200 p-6 text-left opacity-50 cursor-not-allowed">
            <div class="flex items-start justify-between mb-4">
              <!-- Aqara official logo style -->
              <div class="w-16 h-16 flex items-center justify-center">
                <svg viewBox="0 0 240 240" class="w-14 h-14">
                  <rect width="240" height="240" rx="40" fill="#47B881"/>
                  <circle cx="120" cy="100" r="40" fill="white"/>
                  <rect x="80" y="130" width="80" height="60" rx="10" fill="white"/>
                  <circle cx="100" cy="155" r="8" fill="#47B881"/>
                  <circle cx="140" cy="155" r="8" fill="#47B881"/>
                </svg>
              </div>
              <span class="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">Binnenkort</span>
            </div>
            <h3 class="text-lg font-bold text-gray-900 mb-1">Aqara</h3>
            <p class="text-sm text-gray-500 mb-4">Zigbee sensoren</p>
            <div class="flex items-center text-sm font-medium text-gray-400">Binnenkort beschikbaar</div>
          </div>
        </div>
      </template>
    </Tabs>

    <!-- Hue Details Modal -->
    <Teleport to="body">
      <div
        v-if="showHueDetails && hueIntegration"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        @click.self="showHueDetails = false"
      >
        <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
          <div class="p-6 border-b border-gray-100 flex items-center justify-between">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 flex items-center justify-center">
                <svg viewBox="0 0 100 100" class="w-10 h-10">
                  <circle cx="50" cy="50" r="48" fill="#0065D3"/>
                  <path d="M50 20 L65 45 L50 42 L35 45 Z" fill="white"/>
                  <ellipse cx="50" cy="60" rx="25" ry="18" fill="white" opacity="0.9"/>
                  <ellipse cx="50" cy="65" rx="20" ry="12" fill="white"/>
                </svg>
              </div>
              <div>
                <h2 class="text-xl font-bold text-gray-900">Philips Hue</h2>
                <p class="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle class="w-4 h-4" />
                  Verbonden
                </p>
              </div>
            </div>
            <button
              @click="showHueDetails = false"
              class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <div class="p-6">
            <div class="grid grid-cols-3 gap-4 mb-6">
              <div class="text-center p-4 bg-gray-50 rounded-xl">
                <Home class="w-6 h-6 text-gray-400 mx-auto mb-2" />
                <p class="text-2xl font-bold text-gray-900">{{ hueIntegration.rooms?.length || 0 }}</p>
                <p class="text-xs text-gray-500">Kamers</p>
              </div>
              <div class="text-center p-4 bg-gray-50 rounded-xl">
                <Activity class="w-6 h-6 text-gray-400 mx-auto mb-2" />
                <p class="text-2xl font-bold text-gray-900">{{ hueIntegration.items?.filter(i => i.type === 'sensor').length || 0 }}</p>
                <p class="text-xs text-gray-500">Sensoren</p>
              </div>
              <div class="text-center p-4 bg-gray-50 rounded-xl">
                <Lightbulb class="w-6 h-6 text-gray-400 mx-auto mb-2" />
                <p class="text-2xl font-bold text-gray-900">{{ hueIntegration.items?.filter(i => i.type === 'light').length || 0 }}</p>
                <p class="text-xs text-gray-500">Lampen</p>
              </div>
            </div>

            <div v-if="hueIntegration.rooms?.length" class="mb-6">
              <h4 class="text-sm font-medium text-gray-700 mb-3">Kamers</h4>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="room in hueIntegration.rooms"
                  :key="room.id"
                  class="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-full"
                >
                  {{ room.name }}
                </span>
              </div>
            </div>

            <p class="text-sm text-gray-500 mb-6">
              Laatste synchronisatie: {{ formatTimeAgo(hueIntegration.last_sync_at) }}
            </p>

            <div class="flex gap-3">
              <button
                @click="syncHueRooms"
                :disabled="syncing"
                class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw class="w-5 h-5" :class="{ 'animate-spin': syncing }" />
                {{ syncing ? 'Synchroniseren...' : 'Synchroniseren' }}
              </button>
              <button
                @click="disconnectHue"
                class="px-4 py-3 text-red-600 font-medium rounded-xl hover:bg-red-50 transition-colors"
              >
                <Trash2 class="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
