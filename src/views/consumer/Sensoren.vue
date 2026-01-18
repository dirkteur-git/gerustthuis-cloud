<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { supabase } from '@/services/supabase'
import {
  Thermometer,
  Eye,
  DoorOpen,
  RefreshCw,
  Activity,
  ArrowLeft,
  BarChart3,
  Clock,
  MapPin
} from 'lucide-vue-next'

const sensorReadings = ref([])
const motionEvents = ref([])
const loading = ref(true)
const lastUpdate = ref(null)
const selectedRoom = ref(null)

// Rooms with their latest data
const rooms = computed(() => {
  const roomMap = new Map()

  // Process temperature readings
  for (const reading of sensorReadings.value) {
    if (!roomMap.has(reading.room)) {
      roomMap.set(reading.room, {
        name: reading.room,
        temperature: null,
        lastMotion: null,
        motionCount: 0,
        isActive: false
      })
    }
    const room = roomMap.get(reading.room)
    if (reading.sensor_type === 'temperature' && (!room.temperature || new Date(reading.recorded_at) > new Date(room.temperatureTime))) {
      room.temperature = reading.value
      room.temperatureTime = reading.recorded_at
    }
  }

  // Process motion events
  for (const event of motionEvents.value) {
    if (!roomMap.has(event.room)) {
      roomMap.set(event.room, {
        name: event.room,
        temperature: null,
        lastMotion: null,
        motionCount: 0,
        isActive: false
      })
    }
    const room = roomMap.get(event.room)
    if (event.motion) {
      room.motionCount++
      if (!room.lastMotion || new Date(event.recorded_at) > new Date(room.lastMotion)) {
        room.lastMotion = event.recorded_at
        // Active if motion in last 30 minutes
        room.isActive = (Date.now() - new Date(event.recorded_at).getTime()) < 30 * 60 * 1000
      }
    }
  }

  return Array.from(roomMap.values()).sort((a, b) => {
    // Active rooms first, then by name
    if (a.isActive !== b.isActive) return b.isActive - a.isActive
    return a.name.localeCompare(b.name)
  })
})

// Activity chart for selected room (24 hours)
const chartData = computed(() => {
  if (!selectedRoom.value) return []

  const roomMotion = motionEvents.value.filter(e => e.room === selectedRoom.value.name && e.motion)
  const hourlyData = new Map()
  const now = new Date()

  // Initialize last 24 hours
  for (let i = 23; i >= 0; i--) {
    const hour = new Date(now)
    hour.setHours(now.getHours() - i, 0, 0, 0)
    const key = hour.toISOString().slice(0, 13)
    hourlyData.set(key, { hour: key, count: 0, label: hour.getHours() + ':00' })
  }

  // Count events per hour
  for (const event of roomMotion) {
    const hour = new Date(event.recorded_at).toISOString().slice(0, 13)
    if (hourlyData.has(hour)) {
      hourlyData.get(hour).count++
    }
  }

  return Array.from(hourlyData.values())
})

const maxCount = computed(() => {
  return Math.max(...chartData.value.map(d => d.count), 1)
})

// Recent motion events for selected room
const recentMotion = computed(() => {
  if (!selectedRoom.value) return []
  return motionEvents.value
    .filter(e => e.room === selectedRoom.value.name && e.motion)
    .slice(0, 20)
})

// Temperature history for selected room
const temperatureHistory = computed(() => {
  if (!selectedRoom.value) return []
  return sensorReadings.value
    .filter(r => r.room === selectedRoom.value.name && r.sensor_type === 'temperature')
    .slice(0, 20)
})

// Stats
const stats = computed(() => {
  const activeRooms = rooms.value.filter(r => r.isActive).length
  const totalMotion = motionEvents.value.filter(e => e.motion).length
  const avgTemp = sensorReadings.value
    .filter(r => r.sensor_type === 'temperature')
    .reduce((sum, r, _, arr) => sum + r.value / arr.length, 0)

  return {
    activeRooms,
    totalRooms: rooms.value.length,
    totalMotion,
    avgTemp: avgTemp ? avgTemp.toFixed(1) : '-'
  }
})

const fetchData = async () => {
  loading.value = true

  try {
    // Fetch sensor readings (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const [readingsRes, motionRes] = await Promise.all([
      supabase
        .from('sensor_readings')
        .select('*')
        .gte('recorded_at', yesterday)
        .order('recorded_at', { ascending: false })
        .limit(500),
      supabase
        .from('motion_events')
        .select('*')
        .gte('recorded_at', yesterday)
        .order('recorded_at', { ascending: false })
        .limit(500)
    ])

    if (readingsRes.data) sensorReadings.value = readingsRes.data
    if (motionRes.data) motionEvents.value = motionRes.data

    // Auto-select first room if none selected
    if (!selectedRoom.value && rooms.value.length > 0) {
      selectedRoom.value = rooms.value[0]
    }

  } catch (error) {
    console.error('Error fetching data:', error)
  }

  lastUpdate.value = new Date()
  loading.value = false
}

const formatTime = (timestamp) => {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date

  if (diff < 60000) return 'Nu'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} uur`
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

const formatDateTime = (timestamp) => {
  return new Date(timestamp).toLocaleString('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// Auto refresh
let refreshInterval
onMounted(() => {
  fetchData()
  refreshInterval = setInterval(fetchData, 30000)
})

onUnmounted(() => {
  clearInterval(refreshInterval)
})
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-6 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <router-link to="/app" class="p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors">
              <ArrowLeft class="w-5 h-5" />
            </router-link>
            <div>
              <h1 class="text-xl font-semibold text-gray-900">Sensoren Dashboard</h1>
              <p class="text-sm text-gray-500">{{ stats.totalRooms }} kamers, {{ stats.activeRooms }} actief</p>
            </div>
          </div>
          <button
            @click="fetchData"
            class="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': loading }" />
            <span v-if="lastUpdate">{{ formatTime(lastUpdate) }}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="max-w-7xl mx-auto px-6 py-8">
      <!-- Stats Cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div class="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Activity class="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p class="text-2xl font-bold text-gray-900">{{ stats.activeRooms }}</p>
              <p class="text-sm text-gray-500">Actieve kamers</p>
            </div>
          </div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Eye class="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p class="text-2xl font-bold text-gray-900">{{ stats.totalMotion }}</p>
              <p class="text-sm text-gray-500">Bewegingen (24u)</p>
            </div>
          </div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <Thermometer class="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p class="text-2xl font-bold text-gray-900">{{ stats.avgTemp }}°</p>
              <p class="text-sm text-gray-500">Gem. temperatuur</p>
            </div>
          </div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <MapPin class="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p class="text-2xl font-bold text-gray-900">{{ stats.totalRooms }}</p>
              <p class="text-sm text-gray-500">Totaal kamers</p>
            </div>
          </div>
        </div>
      </div>

      <div class="grid lg:grid-cols-3 gap-6">
        <!-- Room List -->
        <div class="lg:col-span-1 space-y-3">
          <h2 class="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Kamers</h2>

          <div
            v-for="room in rooms"
            :key="room.name"
            @click="selectedRoom = room"
            class="bg-white rounded-xl p-4 border cursor-pointer transition-all shadow-sm"
            :class="[
              selectedRoom?.name === room.name
                ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                : 'border-gray-200 hover:border-gray-300 hover:shadow'
            ]"
          >
            <div class="flex items-start justify-between">
              <div class="flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-lg flex items-center justify-center"
                  :class="room.isActive ? 'bg-emerald-100' : 'bg-gray-100'"
                >
                  <Eye
                    class="w-5 h-5"
                    :class="room.isActive ? 'text-emerald-600' : 'text-gray-400'"
                  />
                </div>
                <div>
                  <h3 class="font-medium text-gray-900">{{ room.name }}</h3>
                  <p class="text-sm text-gray-500">{{ room.motionCount }} bewegingen</p>
                </div>
              </div>
              <span
                class="px-2 py-1 rounded-full text-xs font-medium"
                :class="room.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'"
              >
                {{ room.isActive ? 'Actief' : 'Rustig' }}
              </span>
            </div>

            <div class="mt-4 flex items-center justify-between text-sm">
              <div class="flex items-center gap-2 text-gray-500" v-if="room.temperature">
                <Thermometer class="w-4 h-4" />
                <span>{{ room.temperature.toFixed(1) }}°C</span>
              </div>
              <div class="flex items-center gap-1 text-gray-400">
                <Clock class="w-4 h-4" />
                <span>{{ formatTime(room.lastMotion) }}</span>
              </div>
            </div>
          </div>

          <div v-if="rooms.length === 0 && !loading" class="text-center py-12">
            <Activity class="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p class="text-gray-500">Geen data gevonden</p>
            <p class="text-sm text-gray-400 mt-1">Wachtend op sensor data...</p>
          </div>
        </div>

        <!-- Room Detail -->
        <div class="lg:col-span-2 space-y-6">
          <template v-if="selectedRoom">
            <!-- Room Info -->
            <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div class="p-6 border-b border-gray-100">
                <div class="flex items-center gap-4">
                  <div
                    class="w-14 h-14 rounded-xl flex items-center justify-center"
                    :class="selectedRoom.isActive ? 'bg-emerald-100' : 'bg-gray-100'"
                  >
                    <Eye
                      class="w-7 h-7"
                      :class="selectedRoom.isActive ? 'text-emerald-600' : 'text-gray-400'"
                    />
                  </div>
                  <div>
                    <h2 class="text-xl font-semibold text-gray-900">{{ selectedRoom.name }}</h2>
                    <p class="text-gray-500">{{ selectedRoom.motionCount }} bewegingen vandaag</p>
                  </div>
                  <span
                    class="ml-auto px-3 py-1 rounded-full text-sm font-medium"
                    :class="selectedRoom.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'"
                  >
                    {{ selectedRoom.isActive ? 'Actief' : 'Rustig' }}
                  </span>
                </div>
              </div>

              <!-- Current Values -->
              <div class="p-6">
                <h3 class="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
                  Huidige Waarden
                </h3>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div class="bg-gray-50 rounded-lg p-4" v-if="selectedRoom.temperature">
                    <div class="flex items-center gap-2 mb-1">
                      <Thermometer class="w-4 h-4 text-orange-500" />
                      <p class="text-xs text-gray-500 uppercase tracking-wider">Temperatuur</p>
                    </div>
                    <p class="text-2xl font-semibold text-gray-900">{{ selectedRoom.temperature.toFixed(1) }}°C</p>
                  </div>
                  <div class="bg-gray-50 rounded-lg p-4">
                    <div class="flex items-center gap-2 mb-1">
                      <Eye class="w-4 h-4 text-blue-500" />
                      <p class="text-xs text-gray-500 uppercase tracking-wider">Laatste beweging</p>
                    </div>
                    <p class="text-2xl font-semibold text-gray-900">{{ formatTime(selectedRoom.lastMotion) }}</p>
                  </div>
                  <div class="bg-gray-50 rounded-lg p-4">
                    <div class="flex items-center gap-2 mb-1">
                      <Activity class="w-4 h-4 text-emerald-500" />
                      <p class="text-xs text-gray-500 uppercase tracking-wider">Bewegingen</p>
                    </div>
                    <p class="text-2xl font-semibold text-gray-900">{{ selectedRoom.motionCount }}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Activity Chart -->
            <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div class="flex items-center gap-2 mb-6">
                <BarChart3 class="w-5 h-5 text-gray-400" />
                <h3 class="text-lg font-semibold text-gray-900">Activiteit (24 uur)</h3>
              </div>

              <div class="h-40 flex items-end gap-1">
                <div
                  v-for="(bar, index) in chartData"
                  :key="index"
                  class="flex-1 flex flex-col items-center"
                >
                  <div
                    class="w-full rounded-t transition-all duration-300"
                    :class="bar.count > 0 ? 'bg-emerald-500' : 'bg-gray-200'"
                    :style="{ height: Math.max((bar.count / maxCount) * 100, bar.count > 0 ? 8 : 2) + '%' }"
                  />
                  <span
                    v-if="index % 4 === 0"
                    class="text-xs text-gray-400 mt-2"
                  >
                    {{ bar.label }}
                  </span>
                </div>
              </div>

              <div class="flex justify-between mt-4 text-sm text-gray-500">
                <span>{{ chartData.reduce((sum, d) => sum + d.count, 0) }} events totaal</span>
                <span>Max: {{ maxCount }} per uur</span>
              </div>
            </div>

            <!-- Recent Motion -->
            <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div class="p-6 border-b border-gray-100">
                <h3 class="text-lg font-semibold text-gray-900">Recente Bewegingen</h3>
              </div>
              <div class="max-h-60 overflow-y-auto">
                <div v-if="recentMotion.length === 0" class="p-6 text-center text-gray-500">
                  Geen bewegingen gedetecteerd
                </div>
                <div v-else class="divide-y divide-gray-100">
                  <div
                    v-for="(event, index) in recentMotion"
                    :key="index"
                    class="px-6 py-3 flex items-center justify-between hover:bg-gray-50"
                  >
                    <div class="flex items-center gap-3">
                      <div class="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                        <Eye class="w-4 h-4 text-emerald-600" />
                      </div>
                      <span class="text-sm text-gray-700">Beweging gedetecteerd</span>
                    </div>
                    <span class="text-sm text-gray-500">{{ formatDateTime(event.recorded_at) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Temperature History -->
            <div v-if="temperatureHistory.length > 0" class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div class="p-6 border-b border-gray-100">
                <h3 class="text-lg font-semibold text-gray-900">Temperatuur Historie</h3>
              </div>
              <div class="max-h-60 overflow-y-auto">
                <div class="divide-y divide-gray-100">
                  <div
                    v-for="(reading, index) in temperatureHistory"
                    :key="index"
                    class="px-6 py-3 flex items-center justify-between hover:bg-gray-50"
                  >
                    <div class="flex items-center gap-3">
                      <div class="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                        <Thermometer class="w-4 h-4 text-orange-600" />
                      </div>
                      <span class="text-lg font-medium text-gray-900">{{ reading.value.toFixed(1) }}°C</span>
                    </div>
                    <span class="text-sm text-gray-500">{{ formatDateTime(reading.recorded_at) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- Empty State -->
          <div v-else class="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
            <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <MapPin class="w-8 h-8 text-gray-400" />
            </div>
            <h3 class="text-lg font-medium text-gray-900 mb-1">Selecteer een kamer</h3>
            <p class="text-gray-500">Klik op een kamer om details en grafieken te bekijken</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
