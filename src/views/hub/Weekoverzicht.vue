<script setup>
import { ref, onMounted, computed } from 'vue'
import { ArrowLeft, Calendar, Clock, TrendingUp, AlertTriangle, Activity, Sun, Moon, Home, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import sensorStorage from '@/services/sensorStorage'

const router = useRouter()

// State
const isLoading = ref(true)
const weekData = ref([]) // Array of 7 days with activity data
const selectedWeekStart = ref(getWeekStart(new Date()))
const floorPlanData = ref(null)
const rooms = ref([])

// Get Monday of the week for a given date
function getWeekStart(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust for Sunday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// Format date for display
const formatDate = (date) => {
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

const formatWeekRange = computed(() => {
  const start = selectedWeekStart.value
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return `${formatDate(start)} - ${formatDate(end)}`
})

// Days of the week
const weekDays = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']
const hours = Array.from({ length: 24 }, (_, i) => i)

// Navigate weeks
const goToPreviousWeek = () => {
  const prev = new Date(selectedWeekStart.value)
  prev.setDate(prev.getDate() - 7)
  selectedWeekStart.value = prev
  loadWeekData()
}

const goToNextWeek = () => {
  const next = new Date(selectedWeekStart.value)
  next.setDate(next.getDate() + 7)
  if (next <= new Date()) {
    selectedWeekStart.value = next
    loadWeekData()
  }
}

const goToCurrentWeek = () => {
  selectedWeekStart.value = getWeekStart(new Date())
  loadWeekData()
}

const isCurrentWeek = computed(() => {
  const currentWeekStart = getWeekStart(new Date())
  return selectedWeekStart.value.getTime() === currentWeekStart.getTime()
})

// Load floor plan to get room info
const loadFloorPlan = () => {
  try {
    const saved = localStorage.getItem('gerustthuis-floorplan-v6')
    if (saved) {
      floorPlanData.value = JSON.parse(saved)
      // Collect all rooms from all floors
      const allRooms = []
      for (const floorId in floorPlanData.value.rooms) {
        const floorRooms = floorPlanData.value.rooms[floorId] || []
        allRooms.push(...floorRooms)
      }
      rooms.value = allRooms
    }
  } catch (e) {
    console.error('Failed to load floor plan:', e)
  }
}

// Get room name by ID
const getRoomName = (roomId) => {
  const room = rooms.value.find(r => r.id === roomId)
  return room?.name || 'Onbekend'
}

// Load week data from Supabase
const loadWeekData = async () => {
  isLoading.value = true

  try {
    const weekStart = new Date(selectedWeekStart.value)
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)
    weekEnd.setHours(23, 59, 59, 999)

    console.log('[Weekoverzicht] Loading week', weekStart.toISOString(), 'to', weekEnd.toISOString())

    // 1 API call: get ALL active readings for the entire week
    const allReadings = await sensorStorage.getAllActiveReadings(
      weekStart.toISOString(),
      weekEnd.toISOString()
    )

    console.log('[Weekoverzicht] Got', allReadings.length, 'active readings for week')

    // Process readings into days in JS
    const days = []
    for (let d = 0; d < 7; d++) {
      const dayStart = new Date(weekStart)
      dayStart.setDate(dayStart.getDate() + d)
      dayStart.setHours(0, 0, 0, 0)

      const dayEnd = new Date(dayStart)
      dayEnd.setHours(23, 59, 59, 999)

      // Filter readings for this day
      const dayReadings = allReadings.filter(r => {
        const ts = new Date(r.recorded_at)
        return ts >= dayStart && ts <= dayEnd
      })

      const dayData = {
        date: new Date(dayStart),
        hours: Array(24).fill(0),
        firstActivity: null,
        lastActivity: null,
        totalEvents: dayReadings.length,
        roomActivity: {}
      }

      // Process readings (already sorted by time)
      if (dayReadings.length > 0) {
        dayData.firstActivity = new Date(dayReadings[0].recorded_at)
        dayData.lastActivity = new Date(dayReadings[dayReadings.length - 1].recorded_at)

        // Count per hour
        for (const reading of dayReadings) {
          const hour = new Date(reading.recorded_at).getHours()
          dayData.hours[hour]++
        }
      }

      console.log(`[Weekoverzicht] ${dayStart.toDateString()}: ${dayData.totalEvents} events, first: ${dayData.firstActivity?.toLocaleTimeString() || '-'}, last: ${dayData.lastActivity?.toLocaleTimeString() || '-'}`)
      days.push(dayData)
    }

    weekData.value = days

  } catch (error) {
    console.error('Failed to load week data:', error)
  } finally {
    isLoading.value = false
  }
}

// Calculate statistics
const weekStats = computed(() => {
  if (weekData.value.length === 0) return null

  const daysWithActivity = weekData.value.filter(d => d.totalEvents > 0)

  // Average first activity time
  const firstActivityTimes = daysWithActivity
    .filter(d => d.firstActivity)
    .map(d => d.firstActivity.getHours() * 60 + d.firstActivity.getMinutes())

  const avgFirstActivity = firstActivityTimes.length > 0
    ? Math.round(firstActivityTimes.reduce((a, b) => a + b, 0) / firstActivityTimes.length)
    : null

  // Average last activity time
  const lastActivityTimes = daysWithActivity
    .filter(d => d.lastActivity)
    .map(d => d.lastActivity.getHours() * 60 + d.lastActivity.getMinutes())

  const avgLastActivity = lastActivityTimes.length > 0
    ? Math.round(lastActivityTimes.reduce((a, b) => a + b, 0) / lastActivityTimes.length)
    : null

  // Total events
  const totalEvents = weekData.value.reduce((sum, d) => sum + d.totalEvents, 0)

  // Most active room
  const roomTotals = {}
  for (const day of weekData.value) {
    for (const [roomId, count] of Object.entries(day.roomActivity)) {
      roomTotals[roomId] = (roomTotals[roomId] || 0) + count
    }
  }
  const mostActiveRoom = Object.entries(roomTotals).sort((a, b) => b[1] - a[1])[0]

  return {
    avgFirstActivity,
    avgLastActivity,
    totalEvents,
    daysWithActivity: daysWithActivity.length,
    mostActiveRoom: mostActiveRoom ? { id: mostActiveRoom[0], count: mostActiveRoom[1] } : null
  }
})

// Format minutes to time string
const formatMinutesToTime = (minutes) => {
  if (minutes === null) return '-'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

// Get heatmap cell color based on activity
const getHeatmapColor = (count) => {
  if (count === 0) return 'bg-gray-100'
  if (count <= 2) return 'bg-green-200'
  if (count <= 5) return 'bg-green-300'
  if (count <= 10) return 'bg-green-400'
  if (count <= 20) return 'bg-green-500'
  return 'bg-green-600'
}

// Detect anomalies
const anomalies = computed(() => {
  if (!weekStats.value || weekData.value.length === 0) return []

  const alerts = []
  const avgFirst = weekStats.value.avgFirstActivity

  for (const day of weekData.value) {
    // Skip future days or days without activity
    if (day.date > new Date() || !day.firstActivity) continue

    const firstMinutes = day.firstActivity.getHours() * 60 + day.firstActivity.getMinutes()

    // Alert if first activity is more than 2 hours later than average
    if (avgFirst && firstMinutes > avgFirst + 120) {
      alerts.push({
        type: 'late_start',
        date: day.date,
        message: `Eerste activiteit om ${formatMinutesToTime(firstMinutes)} (normaal rond ${formatMinutesToTime(avgFirst)})`,
        severity: firstMinutes > avgFirst + 180 ? 'high' : 'medium'
      })
    }

    // Alert if very low activity
    if (day.totalEvents < 5 && day.date.toDateString() !== new Date().toDateString()) {
      alerts.push({
        type: 'low_activity',
        date: day.date,
        message: `Zeer weinig activiteit (${day.totalEvents} events)`,
        severity: day.totalEvents === 0 ? 'high' : 'medium'
      })
    }
  }

  return alerts.sort((a, b) => b.date - a.date)
})

// Get max activity for scaling
const maxHourlyActivity = computed(() => {
  let max = 1
  for (const day of weekData.value) {
    for (const count of day.hours) {
      if (count > max) max = count
    }
  }
  return max
})

onMounted(() => {
  loadFloorPlan()
  loadWeekData()
})
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <button @click="router.push('/hub')" class="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft class="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 class="text-xl font-bold text-gray-900">Weekoverzicht</h1>
            <p class="text-sm text-gray-500">Trendanalyse en activiteitspatronen</p>
          </div>
        </div>

        <!-- Week navigation -->
        <div class="flex items-center gap-2">
          <button @click="goToPreviousWeek" class="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronLeft class="w-5 h-5 text-gray-600" />
          </button>
          <button
            @click="goToCurrentWeek"
            class="px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 select-none cursor-pointer"
            :class="isCurrentWeek ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
          >
            <Calendar class="w-4 h-4" />
            <span>{{ formatWeekRange }}</span>
          </button>
          <button
            @click="goToNextWeek"
            :disabled="isCurrentWeek"
            class="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30"
          >
            <ChevronRight class="w-5 h-5 text-gray-600" />
          </button>
          <button @click="loadWeekData" class="p-2 hover:bg-gray-100 rounded-lg transition-colors ml-2">
            <RefreshCw class="w-5 h-5 text-gray-600" :class="isLoading ? 'animate-spin' : ''" />
          </button>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <!-- Loading -->
      <div v-if="isLoading" class="flex items-center justify-center py-20">
        <RefreshCw class="w-8 h-8 animate-spin text-primary" />
      </div>

      <template v-else>
        <!-- Stats Cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div class="flex items-center gap-3 mb-2">
              <div class="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Sun class="w-5 h-5 text-amber-600" />
              </div>
              <span class="text-sm text-gray-500">Gem. opstaan</span>
            </div>
            <p class="text-2xl font-bold text-gray-900">
              {{ formatMinutesToTime(weekStats?.avgFirstActivity) }}
            </p>
          </div>

          <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div class="flex items-center gap-3 mb-2">
              <div class="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Moon class="w-5 h-5 text-indigo-600" />
              </div>
              <span class="text-sm text-gray-500">Gem. laatste</span>
            </div>
            <p class="text-2xl font-bold text-gray-900">
              {{ formatMinutesToTime(weekStats?.avgLastActivity) }}
            </p>
          </div>

          <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div class="flex items-center gap-3 mb-2">
              <div class="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Activity class="w-5 h-5 text-green-600" />
              </div>
              <span class="text-sm text-gray-500">Totaal events</span>
            </div>
            <p class="text-2xl font-bold text-gray-900">
              {{ weekStats?.totalEvents || 0 }}
            </p>
          </div>

          <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div class="flex items-center gap-3 mb-2">
              <div class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Home class="w-5 h-5 text-blue-600" />
              </div>
              <span class="text-sm text-gray-500">Meest actief</span>
            </div>
            <p class="text-lg font-bold text-gray-900 truncate">
              {{ weekStats?.mostActiveRoom ? getRoomName(weekStats.mostActiveRoom.id) : '-' }}
            </p>
          </div>
        </div>

        <!-- Anomalies / Alerts -->
        <div v-if="anomalies.length > 0" class="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 class="font-semibold text-amber-800 flex items-center gap-2 mb-3">
            <AlertTriangle class="w-5 h-5" />
            Afwijkingen gedetecteerd
          </h3>
          <div class="space-y-2">
            <div
              v-for="(alert, idx) in anomalies"
              :key="idx"
              class="flex items-center gap-3 p-2 rounded-lg"
              :class="alert.severity === 'high' ? 'bg-red-100' : 'bg-amber-100'"
            >
              <span class="text-sm font-medium" :class="alert.severity === 'high' ? 'text-red-700' : 'text-amber-700'">
                {{ alert.date.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' }) }}
              </span>
              <span class="text-sm" :class="alert.severity === 'high' ? 'text-red-600' : 'text-amber-600'">
                {{ alert.message }}
              </span>
            </div>
          </div>
        </div>

        <!-- Heatmap -->
        <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 class="font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <TrendingUp class="w-5 h-5 text-primary" />
            Activiteit Heatmap
          </h3>

          <div class="overflow-x-auto">
            <div class="min-w-[700px]">
              <!-- Hour labels -->
              <div class="flex mb-2">
                <div class="w-16"></div>
                <div class="flex-1 flex">
                  <div v-for="hour in hours" :key="hour" class="flex-1 text-center text-[10px] text-gray-400">
                    {{ hour === 0 || hour === 6 || hour === 12 || hour === 18 ? `${hour}:00` : '' }}
                  </div>
                </div>
              </div>

              <!-- Day rows -->
              <div v-for="(day, dayIdx) in weekData" :key="dayIdx" class="flex items-center mb-1">
                <div class="w-16 text-sm text-gray-600 font-medium">
                  {{ weekDays[dayIdx] }} {{ day.date.getDate() }}
                </div>
                <div class="flex-1 flex gap-0.5">
                  <div
                    v-for="(count, hourIdx) in day.hours"
                    :key="hourIdx"
                    class="flex-1 h-6 rounded-sm transition-colors cursor-default select-none hover:ring-2 hover:ring-primary/50"
                    :class="getHeatmapColor(count)"
                    :title="`${weekDays[dayIdx]} ${hourIdx}:00 - ${count} events`"
                  ></div>
                </div>
              </div>

              <!-- Legend -->
              <div class="flex items-center justify-end gap-2 mt-4 text-xs text-gray-500">
                <span>Minder</span>
                <div class="w-4 h-4 rounded-sm bg-gray-100"></div>
                <div class="w-4 h-4 rounded-sm bg-green-200"></div>
                <div class="w-4 h-4 rounded-sm bg-green-300"></div>
                <div class="w-4 h-4 rounded-sm bg-green-400"></div>
                <div class="w-4 h-4 rounded-sm bg-green-500"></div>
                <div class="w-4 h-4 rounded-sm bg-green-600"></div>
                <span>Meer</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Daily Summary -->
        <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 class="font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Clock class="w-5 h-5 text-primary" />
            Dagelijks Overzicht
          </h3>

          <div class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="text-left text-sm text-gray-500 border-b border-gray-100">
                  <th class="pb-3 font-medium">Dag</th>
                  <th class="pb-3 font-medium">Eerste activiteit</th>
                  <th class="pb-3 font-medium">Laatste activiteit</th>
                  <th class="pb-3 font-medium">Totaal events</th>
                  <th class="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(day, idx) in weekData" :key="idx" class="border-b border-gray-50">
                  <td class="py-3 font-medium text-gray-900">
                    {{ day.date.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'short' }) }}
                  </td>
                  <td class="py-3 text-gray-600">
                    {{ day.firstActivity ? day.firstActivity.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : '-' }}
                  </td>
                  <td class="py-3 text-gray-600">
                    {{ day.lastActivity ? day.lastActivity.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : '-' }}
                  </td>
                  <td class="py-3 text-gray-600">
                    {{ day.totalEvents }}
                  </td>
                  <td class="py-3">
                    <span
                      v-if="day.date > new Date()"
                      class="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500"
                    >
                      Toekomst
                    </span>
                    <span
                      v-else-if="day.totalEvents === 0"
                      class="text-xs px-2 py-1 rounded-full bg-red-100 text-red-600"
                    >
                      Geen data
                    </span>
                    <span
                      v-else-if="day.totalEvents < 5"
                      class="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-600"
                    >
                      Weinig activiteit
                    </span>
                    <span
                      v-else
                      class="text-xs px-2 py-1 rounded-full bg-green-100 text-green-600"
                    >
                      Normaal
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </main>
  </div>
</template>

<style scoped>
</style>
