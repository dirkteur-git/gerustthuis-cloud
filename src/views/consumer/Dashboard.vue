<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { supabase } from '@/services/supabase'
import {
  RefreshCw,
  Activity,
  Clock,
  Eye,
  DoorOpen,
  Thermometer,
  Droplets,
  Radio,
  ChevronDown,
  ChevronUp,
  Table
} from 'lucide-vue-next'

// Data
const motionEvents = ref([])
const doorEvents = ref([])
const allSensorReadings = ref([])
const loading = ref(true)
const lastUpdate = ref(null)
const expandedSensor = ref(null)

// Fetch data from Supabase
const fetchData = async () => {
  loading.value = true

  try {
    // Get data from last 7 days for weekly heatmap
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [motionRes, doorRes, readingsRes] = await Promise.all([
      supabase
        .from('motion_events')
        .select('*')
        .gte('recorded_at', weekAgo)
        .order('recorded_at', { ascending: false })
        .limit(2000),
      supabase
        .from('door_events')
        .select('*')
        .gte('recorded_at', weekAgo)
        .order('recorded_at', { ascending: false })
        .limit(1000),
      supabase
        .from('sensor_readings')
        .select('*')
        .gte('recorded_at', weekAgo)
        .order('recorded_at', { ascending: false })
        .limit(1000)
    ])

    if (motionRes.data) motionEvents.value = motionRes.data
    if (doorRes.data) doorEvents.value = doorRes.data
    if (readingsRes.data) allSensorReadings.value = readingsRes.data

  } catch (error) {
    console.error('Error fetching data:', error)
  }

  lastUpdate.value = new Date()
  loading.value = false
}

// Calculate motion duration by pairing motion=true with next motion=false
const calculateMotionDurations = (events, room) => {
  // Filter events for this room and sort by time ascending
  const roomEvents = events
    .filter(e => e.room === room)
    .sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at))

  const durations = []

  for (let i = 0; i < roomEvents.length; i++) {
    const event = roomEvents[i]
    if (event.motion) {
      // Find the next "no motion" event
      let endTime = null
      for (let j = i + 1; j < roomEvents.length; j++) {
        if (!roomEvents[j].motion) {
          endTime = new Date(roomEvents[j].recorded_at)
          break
        }
      }

      const startTime = new Date(event.recorded_at)
      let duration = null
      let durationDisplay = '-'

      if (endTime) {
        duration = endTime - startTime
        if (duration < 60000) {
          durationDisplay = `${Math.round(duration / 1000)}s`
        } else if (duration < 3600000) {
          durationDisplay = `${Math.round(duration / 60000)}m`
        } else {
          durationDisplay = `${Math.round(duration / 3600000)}u`
        }
      }

      durations.push({
        timestamp: event.recorded_at,
        duration,
        durationDisplay
      })
    }
  }

  // Return in descending order (newest first)
  return durations.reverse()
}

// Unique sensors list (excluding temperature/alive sensors)
const sensors = computed(() => {
  const sensorMap = new Map()

  // Get unique rooms from motion events
  const motionRooms = new Set(motionEvents.value.map(e => e.room))

  // Motion sensors - only show motion events with duration
  for (const room of motionRooms) {
    const key = `motion_${room}`
    const durations = calculateMotionDurations(motionEvents.value, room)

    sensorMap.set(key, {
      id: key,
      type: 'motion',
      name: room,
      icon: Eye,
      events: durations
    })
  }

  // Door sensors - show open/close with duration
  const doorRooms = new Set(doorEvents.value.map(e => e.room))

  for (const room of doorRooms) {
    const key = `door_${room}`
    const roomDoorEvents = doorEvents.value
      .filter(e => e.room === room)
      .sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at))

    const events = []

    for (let i = 0; i < roomDoorEvents.length; i++) {
      const event = roomDoorEvents[i]
      // contact = false means door opened
      if (!event.contact) {
        // Find next close event
        let endTime = null
        for (let j = i + 1; j < roomDoorEvents.length; j++) {
          if (roomDoorEvents[j].contact) {
            endTime = new Date(roomDoorEvents[j].recorded_at)
            break
          }
        }

        const startTime = new Date(event.recorded_at)
        let duration = null
        let durationDisplay = '-'

        if (endTime) {
          duration = endTime - startTime
          if (duration < 60000) {
            durationDisplay = `${Math.round(duration / 1000)}s`
          } else if (duration < 3600000) {
            durationDisplay = `${Math.round(duration / 60000)}m`
          } else {
            durationDisplay = `${Math.round(duration / 3600000)}u`
          }
        }

        events.push({
          timestamp: event.recorded_at,
          duration,
          durationDisplay,
          display: 'Geopend'
        })
      }
    }

    sensorMap.set(key, {
      id: key,
      type: 'door',
      name: room,
      icon: DoorOpen,
      events: events.reverse()
    })
  }

  return Array.from(sensorMap.values())
})

// Week heatmap data: days (y) x hours (x)
const weekHeatmap = computed(() => {
  const dayNames = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za']
  const heatmap = []

  // Initialize grid: 7 days x 24 hours
  for (let day = 0; day < 7; day++) {
    const dayData = {
      name: dayNames[day],
      hours: []
    }
    for (let hour = 0; hour < 24; hour++) {
      dayData.hours.push({ hour, count: 0 })
    }
    heatmap.push(dayData)
  }

  // Count motion events per day/hour
  for (const event of motionEvents.value) {
    if (!event.motion) continue
    const date = new Date(event.recorded_at)
    const day = date.getDay()
    const hour = date.getHours()
    heatmap[day].hours[hour].count++
  }

  // Count door events per day/hour
  for (const event of doorEvents.value) {
    const date = new Date(event.recorded_at)
    const day = date.getDay()
    const hour = date.getHours()
    heatmap[day].hours[hour].count++
  }

  return heatmap
})

// Max count for heatmap color scaling
const maxHeatmapCount = computed(() => {
  let max = 1
  for (const day of weekHeatmap.value) {
    for (const hour of day.hours) {
      if (hour.count > max) max = hour.count
    }
  }
  return max
})

// Get heatmap cell color
const getHeatmapColor = (count) => {
  if (count === 0) return 'bg-gray-100'
  const intensity = count / maxHeatmapCount.value
  if (intensity < 0.25) return 'bg-emerald-200'
  if (intensity < 0.5) return 'bg-emerald-400'
  if (intensity < 0.75) return 'bg-emerald-500'
  return 'bg-emerald-600'
}

// Today's activity count (excluding temperature)
const todayStats = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const motionCount = motionEvents.value.filter(e =>
    e.motion && new Date(e.recorded_at) >= today
  ).length

  const doorCount = doorEvents.value.filter(e =>
    new Date(e.recorded_at) >= today
  ).length

  return {
    motion: motionCount,
    door: doorCount,
    total: motionCount + doorCount
  }
})

// Last activity
const lastActivity = computed(() => {
  let latest = null
  let location = '-'
  let type = ''

  for (const event of motionEvents.value) {
    if (event.motion) {
      const time = new Date(event.recorded_at)
      if (!latest || time > latest) {
        latest = time
        location = event.room
        type = 'motion'
      }
    }
  }

  for (const event of doorEvents.value) {
    const time = new Date(event.recorded_at)
    if (!latest || time > latest) {
      latest = time
      location = event.room
      type = 'door'
    }
  }

  return { time: latest, location, type }
})

// Format functions
const formatTime = (timestamp) => {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

const formatDateTime = (timestamp) => {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  return date.toLocaleString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const formatTimeAgo = (timestamp) => {
  if (!timestamp) return '-'
  const diff = Date.now() - new Date(timestamp).getTime()
  if (diff < 60000) return 'Nu'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min geleden`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} uur geleden`
  return `${Math.floor(diff / 86400000)} dagen geleden`
}

// Toggle sensor details
const toggleSensor = (sensorId) => {
  if (expandedSensor.value === sensorId) {
    expandedSensor.value = null
  } else {
    expandedSensor.value = sensorId
  }
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
  <div class="p-6 max-w-7xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p class="text-gray-500">Activiteit overzicht</p>
      </div>
      <button
        @click="fetchData"
        class="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': loading }" />
        <span v-if="lastUpdate">{{ formatTimeAgo(lastUpdate) }}</span>
      </button>
    </div>

    <!-- Status Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <div class="bg-white rounded-xl border border-gray-200 p-6">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Activity class="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p class="text-3xl font-bold text-gray-900">{{ todayStats.total }}</p>
            <p class="text-sm text-gray-500">Activiteiten vandaag</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-gray-200 p-6">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
            <Eye class="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p class="text-3xl font-bold text-gray-900">{{ todayStats.motion }}</p>
            <p class="text-sm text-gray-500">Bewegingen</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-gray-200 p-6">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
            <DoorOpen class="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p class="text-3xl font-bold text-gray-900">{{ todayStats.door }}</p>
            <p class="text-sm text-gray-500">Deur events</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Last Activity -->
    <div class="bg-white rounded-xl border border-gray-200 p-6 mb-8">
      <div class="flex items-center gap-4">
        <div class="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center">
          <Clock class="w-7 h-7 text-gray-600" />
        </div>
        <div>
          <p class="text-sm text-gray-500">Laatste activiteit</p>
          <p class="text-xl font-semibold text-gray-900">
            {{ lastActivity.location }}
            <span class="text-gray-400 font-normal">·</span>
            {{ formatTimeAgo(lastActivity.time) }}
          </p>
        </div>
      </div>
    </div>

    <!-- Week Heatmap -->
    <div class="bg-white rounded-xl border border-gray-200 p-6 mb-8">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Activiteit per uur (afgelopen 7 dagen)</h2>
      <p class="text-sm text-gray-500 mb-6">Drukte gebaseerd op beweging en deur sensoren</p>

      <!-- Hour labels -->
      <div class="flex mb-2">
        <div class="w-10"></div>
        <div class="flex-1 flex">
          <template v-for="hour in 24" :key="hour">
            <div class="flex-1 text-center text-xs text-gray-400" v-if="(hour - 1) % 3 === 0">
              {{ hour - 1 }}
            </div>
            <div class="flex-1" v-else></div>
          </template>
        </div>
      </div>

      <!-- Heatmap grid -->
      <div class="space-y-1">
        <div v-for="day in weekHeatmap" :key="day.name" class="flex items-center gap-2">
          <div class="w-8 text-sm text-gray-500 font-medium">{{ day.name }}</div>
          <div class="flex-1 flex gap-0.5">
            <div
              v-for="hourData in day.hours"
              :key="hourData.hour"
              class="flex-1 h-6 rounded-sm transition-colors cursor-default"
              :class="getHeatmapColor(hourData.count)"
              :title="`${day.name} ${hourData.hour}:00 - ${hourData.count} events`"
            />
          </div>
        </div>
      </div>

      <!-- Legend -->
      <div class="flex items-center justify-end gap-2 mt-4 text-xs text-gray-500">
        <span>Minder</span>
        <div class="w-4 h-4 rounded-sm bg-gray-100"></div>
        <div class="w-4 h-4 rounded-sm bg-emerald-200"></div>
        <div class="w-4 h-4 rounded-sm bg-emerald-400"></div>
        <div class="w-4 h-4 rounded-sm bg-emerald-500"></div>
        <div class="w-4 h-4 rounded-sm bg-emerald-600"></div>
        <span>Meer</span>
      </div>
    </div>

    <!-- Sensors with measurements table -->
    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div class="p-6 border-b border-gray-100">
        <div class="flex items-center gap-2">
          <Table class="w-5 h-5 text-gray-400" />
          <h2 class="text-lg font-semibold text-gray-900">Sensoren & Metingen</h2>
        </div>
        <p class="text-sm text-gray-500 mt-1">Klik op een sensor om alle metingen te zien</p>
      </div>

      <div v-if="sensors.length === 0" class="p-12 text-center">
        <Activity class="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p class="text-gray-500">Geen sensor data gevonden</p>
        <p class="text-sm text-gray-400 mt-1">Wachtend op data van Home Assistant...</p>
      </div>

      <div v-else class="divide-y divide-gray-100">
        <div v-for="sensor in sensors" :key="sensor.id">
          <!-- Sensor Header -->
          <button
            @click="toggleSensor(sensor.id)"
            class="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div class="flex items-center gap-4">
              <div
                class="w-10 h-10 rounded-lg flex items-center justify-center"
                :class="sensor.type === 'motion' ? 'bg-blue-100' : 'bg-purple-100'"
              >
                <component
                  :is="sensor.icon"
                  class="w-5 h-5"
                  :class="sensor.type === 'motion' ? 'text-blue-600' : 'text-purple-600'"
                />
              </div>
              <div class="text-left">
                <p class="font-medium text-gray-900">{{ sensor.name }}</p>
                <p class="text-sm text-gray-500">
                  {{ sensor.type === 'motion' ? 'Bewegingssensor' : 'Deursensor' }}
                  · {{ sensor.events.length }} metingen
                </p>
              </div>
            </div>
            <ChevronDown
              v-if="expandedSensor !== sensor.id"
              class="w-5 h-5 text-gray-400"
            />
            <ChevronUp
              v-else
              class="w-5 h-5 text-gray-400"
            />
          </button>

          <!-- Sensor Measurements Table -->
          <div
            v-if="expandedSensor === sensor.id"
            class="bg-gray-50 border-t border-gray-100"
          >
            <div class="max-h-96 overflow-y-auto">
              <table class="w-full">
                <thead class="bg-gray-100 sticky top-0">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tijdstip
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duur
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 bg-white">
                  <tr
                    v-for="(event, index) in sensor.events.slice(0, 100)"
                    :key="index"
                    class="hover:bg-gray-50"
                  >
                    <td class="px-6 py-3 text-sm text-gray-600">
                      {{ formatDateTime(event.timestamp) }}
                    </td>
                    <td class="px-6 py-3">
                      <span
                        class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                        :class="event.durationDisplay !== '-' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'"
                      >
                        {{ event.durationDisplay }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div v-if="sensor.events.length > 100" class="px-6 py-3 text-sm text-gray-500 bg-gray-50 text-center">
                Toont 100 van {{ sensor.events.length }} metingen
              </div>
              <div v-if="sensor.events.length === 0" class="px-6 py-8 text-sm text-gray-500 text-center">
                Geen {{ sensor.type === 'motion' ? 'bewegingen' : 'openingen' }} gevonden
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
