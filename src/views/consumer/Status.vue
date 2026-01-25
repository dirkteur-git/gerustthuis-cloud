<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { supabase } from '@/services/supabase'
import { RefreshCw, Activity, Home } from 'lucide-vue-next'

// Data
const rooms = ref([])
const events = ref([])
const loading = ref(true)
const lastUpdate = ref(null)

// Fetch data from Supabase
const fetchData = async () => {
  loading.value = true

  try {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // Get all rooms
    const { data: roomsData } = await supabase
      .from('rooms')
      .select('id, name')

    if (!roomsData || roomsData.length === 0) {
      loading.value = false
      return
    }

    rooms.value = roomsData
    const roomMap = new Map(roomsData.map(r => [r.id, r.name]))

    // Get events from last 24h
    let allEvents = []
    let offset = 0
    const batchSize = 1000

    while (true) {
      const { data: batch } = await supabase
        .from('room_events')
        .select('id, room_id, source, recorded_at')
        .gte('recorded_at', dayAgo)
        .order('recorded_at', { ascending: false })
        .range(offset, offset + batchSize - 1)

      if (!batch || batch.length === 0) break
      allEvents = allEvents.concat(batch)
      if (batch.length < batchSize) break
      offset += batchSize
    }

    // Add room name to events
    events.value = allEvents.map(e => ({
      ...e,
      room: roomMap.get(e.room_id) || 'Onbekend'
    }))

    lastUpdate.value = new Date()
    console.log(`[Status] Loaded ${rooms.value.length} rooms, ${events.value.length} events (24h)`)
  } catch (error) {
    console.error('Error fetching data:', error)
  } finally {
    loading.value = false
  }
}

// Room stats with sparkline data
const roomStats = computed(() => {
  const stats = []

  for (const room of rooms.value) {
    const roomEvents = events.value.filter(e => e.room === room.name)

    // Get last activity
    const lastEvent = roomEvents[0]
    const lastActivity = lastEvent ? new Date(lastEvent.recorded_at) : null

    // Generate sparkline data (24 hours, 1 point per hour)
    const sparkline = generateSparkline(roomEvents)

    // Count today's events
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayCount = roomEvents.filter(e => new Date(e.recorded_at) >= today).length

    stats.push({
      id: room.id,
      name: room.name,
      lastActivity,
      todayCount,
      totalEvents: roomEvents.length,
      sparkline
    })
  }

  // Sort by last activity (most recent first)
  return stats.sort((a, b) => {
    if (!a.lastActivity) return 1
    if (!b.lastActivity) return -1
    return b.lastActivity - a.lastActivity
  })
})

// Generate sparkline data for a room
const generateSparkline = (roomEvents) => {
  const now = new Date()
  const points = []

  // 24 data points, one per hour going back 24h
  for (let i = 23; i >= 0; i--) {
    const hourStart = new Date(now)
    hourStart.setHours(now.getHours() - i, 0, 0, 0)
    const hourEnd = new Date(hourStart)
    hourEnd.setHours(hourEnd.getHours() + 1)

    const count = roomEvents.filter(e => {
      const t = new Date(e.recorded_at)
      return t >= hourStart && t < hourEnd
    }).length

    points.push(count)
  }

  return points
}

// Create SVG path for sparkline
const getSparklinePath = (data) => {
  if (!data || data.length === 0) return ''

  const max = Math.max(...data, 1)
  const width = 120
  const height = 32
  const padding = 2

  const points = data.map((val, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2)
    const y = height - padding - ((val / max) * (height - padding * 2))
    return `${x},${y}`
  })

  return `M ${points.join(' L ')}`
}

// Format time ago
const formatTimeAgo = (timestamp) => {
  if (!timestamp) return 'Geen activiteit'
  const diff = Date.now() - new Date(timestamp).getTime()
  if (diff < 60000) return 'Nu'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min geleden`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} uur geleden`
  return `${Math.floor(diff / 86400000)} dagen geleden`
}

// Format last update time
const formatLastUpdate = () => {
  if (!lastUpdate.value) return ''
  return lastUpdate.value.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// Check if recent activity
const isRecent = (timestamp) => {
  if (!timestamp) return false
  return Date.now() - timestamp.getTime() < 30 * 60 * 1000 // 30 minutes
}

// Auto refresh
let refreshInterval
onMounted(async () => {
  await fetchData()
  refreshInterval = setInterval(fetchData, 30000)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Status</h1>
        <p class="text-gray-500">Kamer activiteit - laatste 24 uur</p>
      </div>
      <div class="flex items-center gap-4">
        <div v-if="lastUpdate" class="text-sm text-gray-500">
          Laatste refresh: {{ formatLastUpdate() }}
        </div>
        <button
          @click="fetchData"
          class="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
        >
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': loading }" />
        </button>
      </div>
    </div>

    <!-- Room Cards Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="room in roomStats"
        :key="room.id"
        class="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
      >
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 rounded-lg flex items-center justify-center"
              :class="isRecent(room.lastActivity) ? 'bg-emerald-100' : 'bg-gray-100'"
            >
              <Home
                class="w-5 h-5"
                :class="isRecent(room.lastActivity) ? 'text-emerald-600' : 'text-gray-400'"
              />
            </div>
            <div>
              <h3 class="font-semibold text-gray-900">{{ room.name }}</h3>
              <p class="text-sm text-gray-500">{{ formatTimeAgo(room.lastActivity) }}</p>
            </div>
          </div>
          <div class="text-right">
            <p class="text-lg font-bold text-gray-900">{{ room.todayCount }}</p>
            <p class="text-xs text-gray-400">vandaag</p>
          </div>
        </div>

        <!-- Mini Sparkline -->
        <div class="h-8 w-full">
          <svg width="100%" height="32" viewBox="0 0 120 32" preserveAspectRatio="none">
            <path
              :d="getSparklinePath(room.sparkline)"
              fill="none"
              :stroke="isRecent(room.lastActivity) ? '#10b981' : '#9ca3af'"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>

        <p class="text-xs text-gray-400 text-center mt-1">24 uur activiteit</p>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="roomStats.length === 0 && !loading" class="text-center py-16">
      <Activity class="w-12 h-12 text-gray-300 mx-auto mb-4" />
      <h3 class="text-lg font-medium text-gray-900 mb-2">Geen kamers gevonden</h3>
      <p class="text-gray-500">Er zijn nog geen kamers met activiteit.</p>
    </div>
  </div>
</template>
