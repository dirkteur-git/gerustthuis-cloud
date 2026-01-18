<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { supabase } from '@/services/supabase'
import {
  Radio,
  Vibrate,
  Wifi,
  WifiOff,
  ChevronRight,
  RefreshCw,
  Activity,
  ArrowLeft,
  BarChart3
} from 'lucide-vue-next'

const sensors = ref([])
const readings = ref([])
const loading = ref(true)
const lastUpdate = ref(null)
const selectedSensor = ref(null)

// Chart data
const chartData = computed(() => {
  if (!selectedSensor.value) return []

  const sensorData = readings.value.filter(r => r.device_id === selectedSensor.value.id)

  // Group by hour for the last 24 hours
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
  for (const reading of sensorData) {
    const hour = new Date(reading.recorded_at).toISOString().slice(0, 13)
    if (hourlyData.has(hour)) {
      hourlyData.get(hour).count++
    }
  }

  return Array.from(hourlyData.values())
})

const maxCount = computed(() => {
  return Math.max(...chartData.value.map(d => d.count), 1)
})

// Fetch unique sensors from readings
const fetchSensors = async () => {
  loading.value = true

  const { data, error } = await supabase
    .from('sensor_readings')
    .select('device_id, device_name, capability, value, recorded_at')
    .order('recorded_at', { ascending: false })
    .limit(1000)

  if (error) {
    console.error('Error fetching sensors:', error)
    loading.value = false
    return
  }

  readings.value = data

  // Group by device_id and get latest reading per capability
  const deviceMap = new Map()

  for (const reading of data) {
    if (!deviceMap.has(reading.device_id)) {
      deviceMap.set(reading.device_id, {
        id: reading.device_id,
        name: reading.device_name || reading.device_id,
        capabilities: new Map(),
        lastSeen: reading.recorded_at
      })
    }

    const device = deviceMap.get(reading.device_id)
    if (!device.capabilities.has(reading.capability)) {
      try {
        device.capabilities.set(reading.capability, {
          value: JSON.parse(reading.value),
          timestamp: reading.recorded_at
        })
      } catch {
        device.capabilities.set(reading.capability, {
          value: reading.value,
          timestamp: reading.recorded_at
        })
      }
    }
  }

  sensors.value = Array.from(deviceMap.values()).map(device => ({
    ...device,
    capabilities: Object.fromEntries(device.capabilities),
    isOnline: isRecent(device.lastSeen, 5)
  }))

  // Auto-select first sensor
  if (!selectedSensor.value && sensors.value.length > 0) {
    selectedSensor.value = sensors.value[0]
  }

  lastUpdate.value = new Date()
  loading.value = false
}

const isRecent = (timestamp, minutes) => {
  const diff = Date.now() - new Date(timestamp).getTime()
  return diff < minutes * 60 * 1000
}

const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date

  if (diff < 60000) return 'Nu'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}u`
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

const getSensorIcon = (sensor) => {
  if (sensor.capabilities.presence) return Radio
  if (sensor.capabilities.vibration) return Vibrate
  return Activity
}

const getSensorType = (sensor) => {
  if (sensor.capabilities.presence) return 'Presence Sensor'
  if (sensor.capabilities.vibration) return 'Vibration Sensor'
  return 'Sensor'
}

const getSensorStatus = (sensor) => {
  if (sensor.capabilities.presence?.value) return 'Aanwezig'
  if (sensor.capabilities.vibration?.value) return 'Trilling'
  if (sensor.capabilities.movement?.value === 'movement') return 'Beweging'
  return 'Rustig'
}

const getStatusColor = (sensor) => {
  if (sensor.capabilities.presence?.value) return 'bg-emerald-500'
  if (sensor.capabilities.vibration?.value) return 'bg-amber-500'
  if (sensor.capabilities.movement?.value === 'movement') return 'bg-blue-500'
  return 'bg-gray-300'
}

const sensorReadings = computed(() => {
  if (!selectedSensor.value) return []
  return readings.value
    .filter(r => r.device_id === selectedSensor.value.id)
    .slice(0, 50)
})

// Auto refresh
let refreshInterval
onMounted(() => {
  fetchSensors()
  refreshInterval = setInterval(fetchSensors, 30000)
})

onUnmounted(() => {
  clearInterval(refreshInterval)
})
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white border-b border-gray-200">
      <div class="max-w-6xl mx-auto px-6 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <router-link to="/" class="p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors">
              <ArrowLeft class="w-5 h-5" />
            </router-link>
            <div>
              <h1 class="text-xl font-semibold text-gray-900">Sensoren</h1>
              <p class="text-sm text-gray-500">{{ sensors.length }} apparaten verbonden</p>
            </div>
          </div>
          <button
            @click="fetchSensors"
            class="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': loading }" />
            <span v-if="lastUpdate">{{ formatTime(lastUpdate) }}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="max-w-6xl mx-auto px-6 py-8">
      <div class="grid lg:grid-cols-3 gap-6">
        <!-- Sensor List -->
        <div class="lg:col-span-1 space-y-3">
          <div
            v-for="sensor in sensors"
            :key="sensor.id"
            @click="selectedSensor = sensor"
            class="bg-white rounded-xl p-4 border cursor-pointer transition-all shadow-sm"
            :class="[
              selectedSensor?.id === sensor.id
                ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                : 'border-gray-200 hover:border-gray-300 hover:shadow'
            ]"
          >
            <div class="flex items-start justify-between">
              <div class="flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-lg flex items-center justify-center"
                  :class="sensor.isOnline ? 'bg-emerald-100' : 'bg-gray-100'"
                >
                  <component
                    :is="getSensorIcon(sensor)"
                    class="w-5 h-5"
                    :class="sensor.isOnline ? 'text-emerald-600' : 'text-gray-400'"
                  />
                </div>
                <div>
                  <h3 class="font-medium text-gray-900">{{ sensor.name }}</h3>
                  <p class="text-sm text-gray-500">{{ getSensorType(sensor) }}</p>
                </div>
              </div>
              <ChevronRight class="w-5 h-5 text-gray-400" />
            </div>

            <div class="mt-4 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full" :class="getStatusColor(sensor)" />
                <span class="text-sm text-gray-600">{{ getSensorStatus(sensor) }}</span>
              </div>
              <div class="flex items-center gap-1 text-gray-400">
                <component :is="sensor.isOnline ? Wifi : WifiOff" class="w-4 h-4" />
                <span class="text-xs">{{ formatTime(sensor.lastSeen) }}</span>
              </div>
            </div>
          </div>

          <div v-if="sensors.length === 0 && !loading" class="text-center py-12">
            <Activity class="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p class="text-gray-500">Geen sensoren gevonden</p>
            <p class="text-sm text-gray-400 mt-1">Wachtend op data van de hub...</p>
          </div>
        </div>

        <!-- Sensor Detail -->
        <div class="lg:col-span-2 space-y-6">
          <template v-if="selectedSensor">
            <!-- Sensor Info -->
            <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div class="p-6 border-b border-gray-100">
                <div class="flex items-center gap-4">
                  <div
                    class="w-14 h-14 rounded-xl flex items-center justify-center"
                    :class="selectedSensor.isOnline ? 'bg-emerald-100' : 'bg-gray-100'"
                  >
                    <component
                      :is="getSensorIcon(selectedSensor)"
                      class="w-7 h-7"
                      :class="selectedSensor.isOnline ? 'text-emerald-600' : 'text-gray-400'"
                    />
                  </div>
                  <div>
                    <h2 class="text-xl font-semibold text-gray-900">{{ selectedSensor.name }}</h2>
                    <p class="text-gray-500">{{ getSensorType(selectedSensor) }}</p>
                  </div>
                  <span
                    class="ml-auto px-3 py-1 rounded-full text-sm font-medium"
                    :class="selectedSensor.isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'"
                  >
                    {{ selectedSensor.isOnline ? 'Online' : 'Offline' }}
                  </span>
                </div>
              </div>

              <!-- Capabilities Grid -->
              <div class="p-6">
                <h3 class="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
                  Huidige Status
                </h3>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div
                    v-for="(cap, key) in selectedSensor.capabilities"
                    :key="key"
                    class="bg-gray-50 rounded-lg p-4"
                  >
                    <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">{{ key }}</p>
                    <p class="text-lg font-semibold text-gray-900">
                      {{ typeof cap.value === 'boolean' ? (cap.value ? 'Ja' : 'Nee') : cap.value }}
                    </p>
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

            <!-- Recent Activity Table -->
            <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div class="p-6 border-b border-gray-100">
                <h3 class="text-lg font-semibold text-gray-900">Recente Activiteit</h3>
              </div>
              <div class="max-h-80 overflow-y-auto">
                <table class="w-full">
                  <thead class="bg-gray-50 sticky top-0">
                    <tr>
                      <th class="text-left text-xs text-gray-500 uppercase tracking-wider px-6 py-3">Tijd</th>
                      <th class="text-left text-xs text-gray-500 uppercase tracking-wider px-6 py-3">Capability</th>
                      <th class="text-left text-xs text-gray-500 uppercase tracking-wider px-6 py-3">Waarde</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    <tr
                      v-for="(reading, index) in sensorReadings"
                      :key="index"
                      class="hover:bg-gray-50"
                    >
                      <td class="px-6 py-3 text-sm text-gray-500">
                        {{ new Date(reading.recorded_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }}
                      </td>
                      <td class="px-6 py-3">
                        <span class="text-sm font-mono text-gray-700">{{ reading.capability }}</span>
                      </td>
                      <td class="px-6 py-3 text-sm text-gray-900">{{ reading.value }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </template>

          <!-- Empty State -->
          <div v-else class="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
            <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Activity class="w-8 h-8 text-gray-400" />
            </div>
            <h3 class="text-lg font-medium text-gray-900 mb-1">Selecteer een sensor</h3>
            <p class="text-gray-500">Klik op een sensor om details en grafieken te bekijken</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
