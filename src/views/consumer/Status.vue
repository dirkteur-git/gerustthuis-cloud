<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useDashboardStore } from '@/stores/dashboard'
import { Radio, Vibrate, Circle, RefreshCw, ArrowLeft } from 'lucide-vue-next'

const dashboardStore = useDashboardStore()

const getSensorIcon = (sensor) => {
  if (sensor.type === 'presence' || sensor.type === 'motion') return Radio
  if (sensor.type === 'vibration') return Vibrate
  return Circle
}

const formatTime = (timestamp) => {
  if (!timestamp) return '-'
  const diff = Date.now() - new Date(timestamp).getTime()
  if (diff < 60000) return 'Nu'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m geleden`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}u geleden`
  return `${Math.floor(diff / 86400000)}d geleden`
}

const isRecent = (timestamp, minutes = 30) => {
  if (!timestamp) return false
  return Date.now() - new Date(timestamp).getTime() < minutes * 60 * 1000
}

let refreshInterval
onMounted(() => {
  dashboardStore.fetchDashboardData()
  refreshInterval = setInterval(() => dashboardStore.fetchDashboardData(), 10000)
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
              <h1 class="text-xl font-semibold text-gray-900">Live Status</h1>
              <p class="text-sm text-gray-500">{{ dashboardStore.sensors.length }} sensoren actief</p>
            </div>
          </div>
          <button
            @click="dashboardStore.fetchDashboardData"
            class="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': dashboardStore.loading }" />
            <span v-if="dashboardStore.lastUpdate">{{ formatTime(dashboardStore.lastUpdate) }}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="max-w-6xl mx-auto px-6 py-8">
      <!-- Status Banner -->
      <div
        class="rounded-xl p-6 mb-8 border shadow-sm"
        :class="[
          dashboardStore.status.level === 'normal'
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-amber-50 border-amber-200'
        ]"
      >
        <div class="flex items-center gap-4">
          <div
            class="w-12 h-12 rounded-xl flex items-center justify-center"
            :class="dashboardStore.status.level === 'normal' ? 'bg-emerald-100' : 'bg-amber-100'"
          >
            <div
              class="w-3 h-3 rounded-full"
              :class="dashboardStore.status.level === 'normal' ? 'bg-emerald-500' : 'bg-amber-500'"
            />
          </div>
          <div>
            <h2 class="text-lg font-semibold text-gray-900">{{ dashboardStore.status.message }}</h2>
            <p class="text-sm text-gray-600">
              Laatste activiteit: {{ dashboardStore.status.lastActivityLocation }}
              <span v-if="dashboardStore.status.lastActivity">
                ({{ formatTime(dashboardStore.status.lastActivity) }})
              </span>
            </p>
          </div>
        </div>
      </div>

      <!-- Sensors Grid -->
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="sensor in dashboardStore.sensors"
          :key="sensor.id"
          class="bg-white rounded-xl p-6 border border-gray-200 shadow-sm"
        >
          <div class="flex items-start justify-between mb-4">
            <div class="flex items-center gap-3">
              <div
                class="w-12 h-12 rounded-xl flex items-center justify-center"
                :class="isRecent(sensor.lastActivity) ? 'bg-emerald-100' : 'bg-gray-100'"
              >
                <component
                  :is="getSensorIcon(sensor)"
                  class="w-6 h-6"
                  :class="isRecent(sensor.lastActivity) ? 'text-emerald-600' : 'text-gray-400'"
                />
              </div>
              <div>
                <h3 class="font-semibold text-gray-900">{{ sensor.name }}</h3>
                <p class="text-sm text-gray-500">{{ sensor.type }}</p>
              </div>
            </div>
            <span
              class="text-xs px-2 py-1 rounded-full font-medium"
              :class="isRecent(sensor.lastActivity) ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'"
            >
              {{ isRecent(sensor.lastActivity) ? 'Online' : 'Offline' }}
            </span>
          </div>

          <!-- Capabilities -->
          <div class="space-y-2">
            <div
              v-for="(value, cap) in sensor.capabilities"
              :key="cap"
              class="flex items-center justify-between py-2 border-t border-gray-100"
            >
              <span class="text-sm text-gray-500 capitalize">{{ cap }}</span>
              <span class="text-sm text-gray-900 font-medium">
                {{ typeof value === 'boolean' ? (value ? 'Ja' : 'Nee') : value }}
              </span>
            </div>
          </div>

          <!-- Battery & Last Activity -->
          <div class="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <span v-if="sensor.battery !== null" class="text-sm text-gray-500">
              Batterij: {{ sensor.battery }}%
            </span>
            <span class="text-sm text-gray-400">{{ formatTime(sensor.lastActivity) }}</span>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="dashboardStore.sensors.length === 0 && !dashboardStore.loading" class="text-center py-16">
        <Circle class="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 class="text-lg font-medium text-gray-900 mb-2">Geen sensoren gevonden</h3>
        <p class="text-gray-500">Wachtend op sensor data van de hub...</p>
      </div>
    </div>
  </div>
</template>
