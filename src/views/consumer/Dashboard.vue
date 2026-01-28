<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/services/supabase'
import {
  RefreshCw,
  Activity,
  Eye,
  DoorOpen,
  Lightbulb,
  TrendingUp,
  Wifi,
  Filter
} from 'lucide-vue-next'

const router = useRouter()

// Data
const rooms = ref([])
const events = ref([])
const latestMeasurements = ref([])
const sensors = ref([]) // Motion sensors for alive check
const loading = ref(true)
const lastUpdate = ref(null)
const selectedRooms = ref([])
const showRoomFilter = ref(false)
const showSensorModal = ref(false)

// Fetch data from Supabase
const fetchData = async () => {
  loading.value = true

  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // Get all rooms
    const { data: roomsData } = await supabase
      .from('rooms')
      .select('id, name')

    if (!roomsData || roomsData.length === 0) {
      loading.value = false
      return
    }

    rooms.value = roomsData
    // Initialize selected rooms with all rooms
    if (selectedRooms.value.length === 0) {
      selectedRooms.value = roomsData.map(r => r.name)
    }
    const roomMap = new Map(roomsData.map(r => [r.id, r.name]))

    // Get events with pagination
    let allEvents = []
    let offset = 0
    const batchSize = 1000

    while (true) {
      const { data: batch } = await supabase
        .from('room_events')
        .select('id, room_id, source, recorded_at')
        .gte('recorded_at', weekAgo)
        .order('recorded_at', { ascending: false })
        .range(offset, offset + batchSize - 1)

      if (!batch || batch.length === 0) break
      allEvents = allEvents.concat(batch)
      if (batch.length < batchSize) break
      offset += batchSize
    }

    // Add room name to events
    console.log('[Dashboard] Raw events from DB:', allEvents.length)
    console.log('[Dashboard] Sample raw event:', allEvents[0])
    console.log('[Dashboard] Room map keys:', [...roomMap.keys()])

    events.value = allEvents.map(e => ({
      ...e,
      room: roomMap.get(e.room_id) || 'Onbekend'
    }))

    console.log('[Dashboard] Events with room names:', events.value.slice(0, 3))

    // Fetch latest measurements (simple query first)
    const { data: measurementsData, error: measError, count: measCount } = await supabase
      .from('measurements')
      .select('*', { count: 'exact' })
      .order('recorded_at', { ascending: false })
      .limit(20)

    console.log('[Dashboard] Measurements query result:', { data: measurementsData?.length, error: measError, totalCount: measCount })

    if (measError) {
      console.error('[Dashboard] Error fetching measurements:', measError)
    } else if (measurementsData && measurementsData.length > 0) {
      // Get item details separately
      const itemIds = [...new Set(measurementsData.map(m => m.item_id))]
      const { data: itemsData } = await supabase
        .from('items')
        .select('id, name, type, room_id')
        .in('id', itemIds)

      const itemMap = new Map(itemsData?.map(i => [i.id, i]) || [])

      latestMeasurements.value = measurementsData.map(m => {
        const item = itemMap.get(m.item_id)
        return {
          ...m,
          itemName: item?.name || 'Onbekend item',
          itemType: item?.type || 'unknown',
          roomName: roomMap.get(item?.room_id) || '-'
        }
      })
      console.log('[Dashboard] Latest measurements:', latestMeasurements.value.slice(0, 5))
    } else {
      console.log('[Dashboard] No measurements found in database')
      latestMeasurements.value = []
    }

    // Fetch sensors with their latest measurement
    const { data: sensorsData } = await supabase
      .from('items')
      .select('id, name, room_id, type')
      .eq('type', 'sensor')

    if (sensorsData && sensorsData.length > 0) {
      const sensorIds = sensorsData.map(s => s.id)
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

      // Alive check: use temperature/presence/contact (polled every minute)
      // This is the reliable alive indicator for all sensor types
      const { data: aliveChecks } = await supabase
        .from('measurements')
        .select('item_id, capability, recorded_at')
        .in('item_id', sensorIds)
        .in('capability', ['temperature', 'presence', 'contact'])
        .gte('recorded_at', hourAgo)
        .order('recorded_at', { ascending: false })

      // Check if sensor has contact capability (to determine sensor type)
      const { data: contactChecks } = await supabase
        .from('measurements')
        .select('item_id')
        .in('item_id', sensorIds)
        .eq('capability', 'contact')
        .limit(100)

      const sensorsWithContact = new Set(contactChecks?.map(m => m.item_id) || [])
      const sensorsWithAliveCheck = new Set(aliveChecks?.map(m => m.item_id) || [])

      // Determine alive status per sensor
      sensors.value = sensorsData.map(s => {
        const isContactSensor = sensorsWithContact.has(s.id)
        const alive = sensorsWithAliveCheck.has(s.id)

        return {
          ...s,
          roomName: roomMap.get(s.room_id) || '-',
          alive,
          sensorType: isContactSensor ? 'contact' : 'motion'
        }
      })

      console.log('[Dashboard] Sensors:', sensors.value.length, 'alive:', sensors.value.filter(s => s.alive).length)
    }

    lastUpdate.value = new Date()
    console.log(`[Dashboard] Loaded ${rooms.value.length} rooms, ${events.value.length} events, ${sensors.value.length} sensors`)
  } catch (error) {
    console.error('Error fetching data:', error)
  } finally {
    loading.value = false
  }
}

// Today's stats
const todayStats = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const todayEvents = events.value.filter(e => new Date(e.recorded_at) >= today)

  return {
    total: todayEvents.length,
    motion: todayEvents.filter(e => e.source === 'motion').length,
    light: todayEvents.filter(e => e.source === 'light').length,
    door: todayEvents.filter(e => e.source === 'door').length
  }
})

// Pattern score - placeholder until check_nu is implemented
const patternScore = computed(() => {
  return { score: 100, level: 'ok', label: 'Normaal' }
})

// Sensor score - based on alive check (measurement within 60 minutes per sensor)
const sensorScore = computed(() => {
  const totalSensors = sensors.value.length
  const aliveSensors = sensors.value.filter(s => s.alive).length
  const score = totalSensors > 0 ? Math.round((aliveSensors / totalSensors) * 100) : 100

  return {
    score,
    healthy: aliveSensors,
    total: totalSensors,
    level: score >= 80 ? 'ok' : score >= 50 ? 'let_op' : 'zorg',
    sensors: sensors.value // voor debugging/details
  }
})

// Toggle room filter
const toggleRoomFilter = (roomName) => {
  const idx = selectedRooms.value.indexOf(roomName)
  if (idx >= 0) {
    selectedRooms.value.splice(idx, 1)
  } else {
    selectedRooms.value.push(roomName)
  }
}

const selectAllRooms = () => {
  selectedRooms.value = rooms.value.map(r => r.name)
}

const deselectAllRooms = () => {
  selectedRooms.value = []
}

// Filtered events for heatmap
const filteredEvents = computed(() => {
  if (selectedRooms.value.length === 0) return []
  return events.value.filter(e => selectedRooms.value.includes(e.room))
})

// Week heatmap - uses filtered events
const weekHeatmap = computed(() => {
  const dayNames = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za']
  const heatmap = []
  const now = new Date()

  for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
    const date = new Date(now)
    date.setDate(date.getDate() - daysAgo)
    date.setHours(0, 0, 0, 0)

    const dayData = {
      name: dayNames[date.getDay()],
      date: date,
      dateStr: date.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit' }),
      hours: Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0, events: [] }))
    }
    heatmap.push(dayData)
  }

  // Use filtered events
  for (const event of filteredEvents.value) {
    const eventDate = new Date(event.recorded_at)

    for (const dayData of heatmap) {
      const dayStart = dayData.date.getTime()
      const dayEnd = dayStart + 24 * 60 * 60 * 1000

      if (eventDate.getTime() >= dayStart && eventDate.getTime() < dayEnd) {
        const hour = eventDate.getHours()
        dayData.hours[hour].count++
        dayData.hours[hour].events.push(event)
        break
      }
    }
  }

  return heatmap
})

// Heatmap modal
const showHeatmapModal = ref(false)
const selectedHeatmapCell = ref(null)

const onHeatmapCellClick = (day, hourData) => {
  if (hourData.count === 0) return

  const byRoom = new Map()
  for (const event of hourData.events) {
    if (!byRoom.has(event.room)) {
      byRoom.set(event.room, { motion: 0, light: 0, door: 0 })
    }
    byRoom.get(event.room)[event.source]++
  }

  selectedHeatmapCell.value = {
    day: day.name,
    date: day.dateStr,
    hour: hourData.hour,
    totalCount: hourData.count,
    rooms: Array.from(byRoom.entries()).map(([room, counts]) => ({
      room,
      ...counts,
      total: counts.motion + counts.light + counts.door
    })).sort((a, b) => b.total - a.total)
  }
  showHeatmapModal.value = true
}

const maxHeatmapCount = computed(() => {
  let max = 1
  for (const day of weekHeatmap.value) {
    for (const hour of day.hours) {
      if (hour.count > max) max = hour.count
    }
  }
  return max
})

const getHeatmapColor = (count) => {
  if (count === 0) return 'bg-gray-100'
  const intensity = count / maxHeatmapCount.value
  if (intensity < 0.25) return 'bg-emerald-200'
  if (intensity < 0.5) return 'bg-emerald-400'
  if (intensity < 0.75) return 'bg-emerald-500'
  return 'bg-emerald-600'
}

// Format functions
const formatTimeAgo = (timestamp) => {
  if (!timestamp) return '-'
  const diff = Date.now() - new Date(timestamp).getTime()
  if (diff < 60000) return 'Nu'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min geleden`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} uur geleden`
  return `${Math.floor(diff / 86400000)} dagen geleden`
}

const formatDateTime = (timestamp) => {
  if (!timestamp) return '-'
  return new Date(timestamp).toLocaleString('nl-NL', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
  })
}

const getSourceIcon = (source) => {
  if (source === 'motion') return Eye
  if (source === 'light') return Lightbulb
  if (source === 'door') return DoorOpen
  return Activity
}

const getSourceColor = (source) => {
  if (source === 'motion') return 'text-blue-600 bg-blue-100'
  if (source === 'light') return 'text-yellow-600 bg-yellow-100'
  if (source === 'door') return 'text-purple-600 bg-purple-100'
  return 'text-gray-600 bg-gray-100'
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
        <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p class="text-gray-500">Kamer activiteit</p>
      </div>
      <button
        @click="fetchData"
        class="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
      >
        <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': loading }" />
        <span v-if="lastUpdate">{{ formatTimeAgo(lastUpdate) }}</span>
      </button>
    </div>

    <!-- Score Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
      <!-- Pattern Score -->
      <button
        @click="router.push('/patronen')"
        class="bg-white rounded-xl border border-gray-200 p-6 text-left hover:border-emerald-300 hover:shadow-md transition-all"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div
              class="w-14 h-14 rounded-xl flex items-center justify-center"
              :class="{
                'bg-emerald-100': patternScore.level === 'ok',
                'bg-yellow-100': patternScore.level === 'let_op',
                'bg-orange-100': patternScore.level === 'zorg'
              }"
            >
              <TrendingUp
                class="w-7 h-7"
                :class="{
                  'text-emerald-600': patternScore.level === 'ok',
                  'text-yellow-600': patternScore.level === 'let_op',
                  'text-orange-600': patternScore.level === 'zorg'
                }"
              />
            </div>
            <div>
              <p class="text-sm text-gray-500">Patroonscore</p>
              <p class="text-lg font-semibold text-gray-900">{{ patternScore.label }}</p>
            </div>
          </div>
          <div class="text-right">
            <p
              class="text-4xl font-bold"
              :class="{
                'text-emerald-600': patternScore.level === 'ok',
                'text-yellow-600': patternScore.level === 'let_op',
                'text-orange-600': patternScore.level === 'zorg'
              }"
            >
              {{ patternScore.score }}
            </p>
            <p class="text-xs text-gray-400">/ 100</p>
          </div>
        </div>
      </button>

      <!-- Sensor Score -->
      <button
        @click="showSensorModal = true"
        class="bg-white rounded-xl border border-gray-200 p-6 text-left hover:border-blue-300 hover:shadow-md transition-all"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div
              class="w-14 h-14 rounded-xl flex items-center justify-center"
              :class="{
                'bg-emerald-100': sensorScore.level === 'ok',
                'bg-yellow-100': sensorScore.level === 'let_op',
                'bg-orange-100': sensorScore.level === 'zorg'
              }"
            >
              <Wifi
                class="w-7 h-7"
                :class="{
                  'text-emerald-600': sensorScore.level === 'ok',
                  'text-yellow-600': sensorScore.level === 'let_op',
                  'text-orange-600': sensorScore.level === 'zorg'
                }"
              />
            </div>
            <div>
              <p class="text-sm text-gray-500">Sensorscore</p>
              <p class="text-lg font-semibold text-gray-900">{{ sensorScore.healthy }}/{{ sensorScore.total }} actief</p>
            </div>
          </div>
          <div class="text-right">
            <p
              class="text-4xl font-bold"
              :class="{
                'text-emerald-600': sensorScore.level === 'ok',
                'text-yellow-600': sensorScore.level === 'let_op',
                'text-orange-600': sensorScore.level === 'zorg'
              }"
            >
              {{ sensorScore.score }}
            </p>
            <p class="text-xs text-gray-400">/ 100</p>
          </div>
        </div>
      </button>
    </div>

    <!-- Week Heatmap -->
    <div class="bg-white rounded-xl border border-gray-200 p-6 mb-8">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">Activiteit per uur</h2>
          <p class="text-sm text-gray-500">Klik op een cel voor details</p>
        </div>
        <div class="relative">
          <button
            @click="showRoomFilter = !showRoomFilter"
            class="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <Filter class="w-4 h-4 text-gray-500" />
            <span>{{ selectedRooms.length }}/{{ rooms.length }} kamers</span>
          </button>

          <!-- Room Filter Dropdown -->
          <div
            v-if="showRoomFilter"
            class="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10"
          >
            <div class="p-3 border-b border-gray-100 flex justify-between">
              <button @click="selectAllRooms" class="text-xs text-blue-600 hover:underline">Alles</button>
              <button @click="deselectAllRooms" class="text-xs text-gray-500 hover:underline">Geen</button>
            </div>
            <div class="p-2 max-h-64 overflow-y-auto">
              <label
                v-for="room in rooms"
                :key="room.id"
                class="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  :checked="selectedRooms.includes(room.name)"
                  @change="toggleRoomFilter(room.name)"
                  class="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span class="text-sm text-gray-700">{{ room.name }}</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div class="flex mb-2">
        <div class="w-20"></div>
        <div class="flex-1 flex">
          <template v-for="hour in 24" :key="hour">
            <div class="flex-1 text-center text-xs text-gray-400" v-if="(hour - 1) % 3 === 0">
              {{ hour - 1 }}
            </div>
            <div class="flex-1" v-else></div>
          </template>
        </div>
      </div>

      <div class="space-y-1">
        <div v-for="day in weekHeatmap" :key="day.dateStr" class="flex items-center gap-2">
          <div class="w-20 text-sm text-gray-500">
            <span class="font-medium">{{ day.name }}</span>
            <span class="text-gray-400 ml-1">{{ day.dateStr }}</span>
          </div>
          <div class="flex-1 flex gap-0.5">
            <div
              v-for="hourData in day.hours"
              :key="hourData.hour"
              class="flex-1 h-6 rounded-sm transition-colors"
              :class="[
                getHeatmapColor(hourData.count),
                hourData.count > 0 ? 'cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-1' : ''
              ]"
              :title="`${day.name} ${hourData.hour}:00 - ${hourData.count} activiteiten`"
              @click="onHeatmapCellClick(day, hourData)"
            />
          </div>
        </div>
      </div>

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

    <!-- Heatmap Modal -->
    <Teleport to="body">
      <div
        v-if="showHeatmapModal && selectedHeatmapCell"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        @click.self="showHeatmapModal = false"
      >
        <div class="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
          <div class="p-6 border-b border-gray-100">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-lg font-semibold text-gray-900">
                  {{ selectedHeatmapCell.day }} {{ selectedHeatmapCell.date }}
                </h3>
                <p class="text-sm text-gray-500">
                  {{ selectedHeatmapCell.hour }}:00 - {{ selectedHeatmapCell.hour + 1 }}:00
                </p>
              </div>
              <div class="text-right">
                <p class="text-2xl font-bold text-primary">{{ selectedHeatmapCell.totalCount }}</p>
                <p class="text-xs text-gray-500">activiteiten</p>
              </div>
            </div>
          </div>
          <div class="p-6 max-h-80 overflow-y-auto">
            <div class="space-y-3">
              <div
                v-for="roomData in selectedHeatmapCell.rooms"
                :key="roomData.room"
                class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <span class="font-medium text-gray-900">{{ roomData.room }}</span>
                <div class="flex items-center gap-3">
                  <span v-if="roomData.motion > 0" class="flex items-center gap-1 text-sm text-blue-600">
                    <Eye class="w-4 h-4" /> {{ roomData.motion }}
                  </span>
                  <span v-if="roomData.light > 0" class="flex items-center gap-1 text-sm text-yellow-600">
                    <Lightbulb class="w-4 h-4" /> {{ roomData.light }}
                  </span>
                  <span v-if="roomData.door > 0" class="flex items-center gap-1 text-sm text-purple-600">
                    <DoorOpen class="w-4 h-4" /> {{ roomData.door }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div class="p-4 bg-gray-50 border-t border-gray-100">
            <button @click="showHeatmapModal = false" class="w-full py-2 text-sm font-medium text-gray-600 hover:text-gray-900">
              Sluiten
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Sensor Status Modal -->
    <Teleport to="body">
      <div
        v-if="showSensorModal"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        @click.self="showSensorModal = false"
      >
        <div class="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
          <div class="p-6 border-b border-gray-100">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-lg font-semibold text-gray-900">Sensor Status</h3>
                <p class="text-sm text-gray-500">Activiteit in laatste uur</p>
              </div>
              <div class="text-right">
                <p class="text-2xl font-bold" :class="{
                  'text-emerald-600': sensorScore.level === 'ok',
                  'text-yellow-600': sensorScore.level === 'let_op',
                  'text-orange-600': sensorScore.level === 'zorg'
                }">{{ sensorScore.healthy }}/{{ sensorScore.total }}</p>
                <p class="text-xs text-gray-500">actief</p>
              </div>
            </div>
          </div>
          <div class="p-6 max-h-80 overflow-y-auto">
            <div class="space-y-2">
              <div
                v-for="sensor in sensorScore.sensors"
                :key="sensor.id"
                class="flex items-center justify-between p-3 rounded-lg"
                :class="sensor.alive ? 'bg-emerald-50' : 'bg-red-50'"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="w-3 h-3 rounded-full"
                    :class="sensor.alive ? 'bg-emerald-500' : 'bg-red-500'"
                  ></div>
                  <div>
                    <p class="font-medium text-gray-900">{{ sensor.name }}</p>
                    <p class="text-xs text-gray-500">{{ sensor.roomName }} · {{ sensor.sensorType === 'contact' ? 'Deur' : 'Motion' }}</p>
                  </div>
                </div>
                <span
                  class="text-sm font-medium"
                  :class="sensor.alive ? 'text-emerald-600' : 'text-red-600'"
                >
                  {{ sensor.alive ? 'Actief' : 'Inactief' }}
                </span>
              </div>
            </div>
          </div>
          <div class="p-4 bg-gray-50 border-t border-gray-100">
            <button @click="showSensorModal = false" class="w-full py-2 text-sm font-medium text-gray-600 hover:text-gray-900">
              Sluiten
            </button>
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>
