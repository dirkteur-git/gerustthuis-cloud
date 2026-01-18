<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { ArrowLeft, Radio, Vibrate, RefreshCw, Circle } from 'lucide-vue-next'
import { supabase } from '@/services/supabase'

// Sensor data from Supabase
const sensors = ref([])
const loading = ref(true)
const lastUpdate = ref(null)

// Sensor positions (stored locally for now)
const sensorPositions = ref({
  'Bewegingsensor': { x: 300, y: 200 },
  'Trillingssensor': { x: 500, y: 350 }
})

// Fetch sensors from Supabase
const fetchSensors = async () => {
  loading.value = true

  const { data, error } = await supabase
    .from('sensor_readings')
    .select('device_id, device_name, capability, value, recorded_at')
    .order('recorded_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('Error fetching sensors:', error)
    loading.value = false
    return
  }

  // Group by device
  const deviceMap = new Map()
  for (const reading of data) {
    if (!deviceMap.has(reading.device_id)) {
      deviceMap.set(reading.device_id, {
        id: reading.device_id,
        name: reading.device_name || reading.device_id,
        capabilities: {},
        lastSeen: reading.recorded_at
      })
    }
    const device = deviceMap.get(reading.device_id)
    if (!device.capabilities[reading.capability]) {
      try {
        device.capabilities[reading.capability] = JSON.parse(reading.value)
      } catch {
        device.capabilities[reading.capability] = reading.value
      }
    }
  }

  sensors.value = Array.from(deviceMap.values())
  lastUpdate.value = new Date()
  loading.value = false
}

const isRecent = (timestamp, minutes = 5) => {
  return Date.now() - new Date(timestamp).getTime() < minutes * 60 * 1000
}

const getSensorIcon = (sensor) => {
  if (sensor.capabilities.presence !== undefined) return Radio
  if (sensor.capabilities.vibration !== undefined) return Vibrate
  return Circle
}

const getSensorStatus = (sensor) => {
  if (sensor.capabilities.presence) return { active: true, label: 'Aanwezig' }
  if (sensor.capabilities.vibration) return { active: true, label: 'Trilling' }
  return { active: false, label: 'Rustig' }
}

const getStatusColor = (sensor) => {
  const status = getSensorStatus(sensor)
  if (status.active) return 'bg-emerald-500'
  return 'bg-gray-300'
}

const formatTime = (timestamp) => {
  const diff = Date.now() - new Date(timestamp).getTime()
  if (diff < 60000) return 'Nu'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  return `${Math.floor(diff / 3600000)}u`
}

// Auto refresh
let refreshInterval
onMounted(() => {
  fetchSensors()
  refreshInterval = setInterval(fetchSensors, 10000)
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
            <router-link to="/hub" class="p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors">
              <ArrowLeft class="w-5 h-5" />
            </router-link>
            <div>
              <h1 class="text-xl font-semibold text-gray-900">Plattegrond</h1>
              <p class="text-sm text-gray-500">{{ sensors.length }} sensoren actief</p>
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
      <div class="grid lg:grid-cols-4 gap-6">
        <!-- Floor Plan Canvas -->
        <div class="lg:col-span-3">
          <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <!-- Canvas Area -->
            <div
              class="relative w-full h-[500px] bg-[radial-gradient(circle_at_center,_#e5e7eb_1px,_transparent_1px)] bg-[size:20px_20px]"
            >
              <!-- Room outline (simplified) -->
              <svg class="absolute inset-0 w-full h-full">
                <rect
                  x="50" y="50"
                  width="600" height="400"
                  fill="none"
                  stroke="#d1d5db"
                  stroke-width="2"
                  rx="8"
                />
                <!-- Room label -->
                <text x="70" y="80" fill="#9ca3af" font-size="14">Woonkamer</text>
              </svg>

              <!-- Sensors on floor plan -->
              <div
                v-for="sensor in sensors"
                :key="sensor.id"
                class="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                :style="{
                  left: (sensorPositions[sensor.name]?.x || 200) + 'px',
                  top: (sensorPositions[sensor.name]?.y || 200) + 'px'
                }"
              >
                <!-- Pulse ring when active -->
                <div
                  v-if="getSensorStatus(sensor).active"
                  class="absolute inset-0 w-12 h-12 -m-3 rounded-full animate-ping opacity-20"
                  :class="getStatusColor(sensor)"
                />

                <!-- Sensor icon -->
                <div
                  class="relative w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 border-2"
                  :class="[
                    getSensorStatus(sensor).active ? 'bg-emerald-100 border-emerald-400' : 'bg-gray-100 border-gray-300'
                  ]"
                >
                  <component
                    :is="getSensorIcon(sensor)"
                    class="w-5 h-5"
                    :class="getSensorStatus(sensor).active ? 'text-emerald-600' : 'text-gray-400'"
                  />
                </div>

                <!-- Label -->
                <div class="absolute top-14 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                  <div class="bg-white px-2 py-1 rounded text-xs text-gray-700 border border-gray-200 shadow-sm">
                    {{ sensor.name }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Sensor List -->
        <div class="space-y-3">
          <h2 class="text-sm font-medium text-gray-500 uppercase tracking-wider px-1">Sensoren</h2>

          <div
            v-for="sensor in sensors"
            :key="sensor.id"
            class="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"
          >
            <div class="flex items-center gap-3 mb-3">
              <div
                class="w-10 h-10 rounded-lg flex items-center justify-center"
                :class="getSensorStatus(sensor).active ? 'bg-emerald-100' : 'bg-gray-100'"
              >
                <component
                  :is="getSensorIcon(sensor)"
                  class="w-5 h-5"
                  :class="getSensorStatus(sensor).active ? 'text-emerald-600' : 'text-gray-400'"
                />
              </div>
              <div>
                <h3 class="font-medium text-gray-900">{{ sensor.name }}</h3>
                <p class="text-xs text-gray-500">{{ formatTime(sensor.lastSeen) }}</p>
              </div>
            </div>

            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span
                  class="w-2 h-2 rounded-full"
                  :class="getStatusColor(sensor)"
                />
                <span class="text-sm text-gray-600">{{ getSensorStatus(sensor).label }}</span>
              </div>
              <span
                class="text-xs px-2 py-1 rounded font-medium"
                :class="isRecent(sensor.lastSeen) ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'"
              >
                {{ isRecent(sensor.lastSeen) ? 'Online' : 'Offline' }}
              </span>
            </div>
          </div>

          <div v-if="sensors.length === 0 && !loading" class="text-center py-8">
            <Circle class="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p class="text-sm text-gray-500">Geen sensoren</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
