<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { supabase } from '@/services/supabase'
import { ArrowLeft, RefreshCw, Database, Filter, Download } from 'lucide-vue-next'

const readings = ref([])
const loading = ref(true)
const lastUpdate = ref(null)
const selectedDevice = ref('all')
const selectedCapability = ref('all')
const limit = ref(100)

// Get unique devices
const devices = computed(() => {
  const unique = [...new Set(readings.value.map(r => r.device_name || r.device_id))]
  return unique.sort()
})

// Get unique capabilities
const capabilities = computed(() => {
  const unique = [...new Set(readings.value.map(r => r.capability))]
  return unique.sort()
})

// Filtered readings
const filteredReadings = computed(() => {
  return readings.value.filter(r => {
    if (selectedDevice.value !== 'all' && (r.device_name || r.device_id) !== selectedDevice.value) {
      return false
    }
    if (selectedCapability.value !== 'all' && r.capability !== selectedCapability.value) {
      return false
    }
    return true
  })
})

// Fetch all raw data from Supabase
const fetchData = async () => {
  loading.value = true

  const { data, error } = await supabase
    .from('sensor_readings')
    .select('*')
    .order('recorded_at', { ascending: false })
    .limit(limit.value)

  if (error) {
    console.error('Error fetching data:', error)
    loading.value = false
    return
  }

  readings.value = data
  lastUpdate.value = new Date()
  loading.value = false
}

const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const formatValue = (value) => {
  try {
    const parsed = JSON.parse(value)
    if (typeof parsed === 'boolean') return parsed ? 'true' : 'false'
    if (typeof parsed === 'number') return parsed.toString()
    return JSON.stringify(parsed)
  } catch {
    return value
  }
}

const exportCSV = () => {
  const headers = ['ID', 'Device ID', 'Device Name', 'Capability', 'Value', 'Zone', 'Recorded At']
  const rows = filteredReadings.value.map(r => [
    r.id,
    r.device_id,
    r.device_name,
    r.capability,
    r.value,
    r.zone_name,
    r.recorded_at
  ])

  const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `sensor_data_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
}

// Auto refresh
let refreshInterval
onMounted(() => {
  fetchData()
  refreshInterval = setInterval(fetchData, 5000)
})

onUnmounted(() => {
  clearInterval(refreshInterval)
})

// Refetch when limit changes
watch(limit, fetchData)
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-6 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <router-link to="/hub" class="p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors">
              <ArrowLeft class="w-5 h-5" />
            </router-link>
            <div>
              <h1 class="text-xl font-semibold text-gray-900">Ruwe Sensor Data</h1>
              <p class="text-sm text-gray-500">{{ filteredReadings.length }} van {{ readings.length }} records</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="exportCSV"
              class="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Download class="w-4 h-4" />
              Export CSV
            </button>
            <button
              @click="fetchData"
              class="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': loading }" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="max-w-7xl mx-auto px-6 py-6">
      <!-- Filters -->
      <div class="bg-white rounded-xl border border-gray-200 p-4 mb-6 shadow-sm">
        <div class="flex items-center gap-2 mb-4">
          <Filter class="w-4 h-4 text-gray-400" />
          <span class="text-sm font-medium text-gray-700">Filters</span>
        </div>
        <div class="grid sm:grid-cols-3 gap-4">
          <div>
            <label class="block text-xs text-gray-500 mb-1">Device</label>
            <select
              v-model="selectedDevice"
              class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="all">Alle devices</option>
              <option v-for="device in devices" :key="device" :value="device">{{ device }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Capability</label>
            <select
              v-model="selectedCapability"
              class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="all">Alle capabilities</option>
              <option v-for="cap in capabilities" :key="cap" :value="cap">{{ cap }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Aantal records</label>
            <select
              v-model="limit"
              class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option :value="50">50</option>
              <option :value="100">100</option>
              <option :value="250">250</option>
              <option :value="500">500</option>
              <option :value="1000">1000</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Data Table -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50">
              <tr>
                <th class="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Tijd</th>
                <th class="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Device</th>
                <th class="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Capability</th>
                <th class="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Waarde</th>
                <th class="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">ID</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr
                v-for="reading in filteredReadings"
                :key="reading.id"
                class="hover:bg-gray-50"
              >
                <td class="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                  {{ formatTime(reading.recorded_at) }}
                </td>
                <td class="px-4 py-3">
                  <span class="text-sm font-medium text-gray-900">{{ reading.device_name || reading.device_id }}</span>
                </td>
                <td class="px-4 py-3">
                  <span class="inline-flex px-2 py-1 text-xs font-mono bg-gray-100 text-gray-700 rounded">
                    {{ reading.capability }}
                  </span>
                </td>
                <td class="px-4 py-3">
                  <span class="text-sm font-mono text-gray-900">{{ formatValue(reading.value) }}</span>
                </td>
                <td class="px-4 py-3 text-xs text-gray-400 font-mono">
                  {{ reading.id }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="filteredReadings.length === 0 && !loading" class="text-center py-12">
          <Database class="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p class="text-gray-500">Geen data gevonden</p>
        </div>
      </div>

      <!-- Stats -->
      <div class="mt-6 grid sm:grid-cols-4 gap-4">
        <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Totaal Records</p>
          <p class="text-2xl font-bold text-gray-900">{{ readings.length }}</p>
        </div>
        <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Devices</p>
          <p class="text-2xl font-bold text-gray-900">{{ devices.length }}</p>
        </div>
        <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Capabilities</p>
          <p class="text-2xl font-bold text-gray-900">{{ capabilities.length }}</p>
        </div>
        <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Laatste Update</p>
          <p class="text-lg font-bold text-gray-900">
            {{ lastUpdate ? new Date(lastUpdate).toLocaleTimeString('nl-NL') : '-' }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
