<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useDashboardStore } from '@/stores/dashboard'
import {
  ArrowLeft,
  RefreshCw,
  Radio,
  Vibrate,
  Circle,
  Activity,
  Clock,
  TrendingUp
} from 'lucide-vue-next'

const dashboardStore = useDashboardStore()

const formatTime = (timestamp) => {
  if (!timestamp) return '-'
  const diff = Date.now() - new Date(timestamp).getTime()
  if (diff < 60000) return 'Nu'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}u`
  return `${Math.floor(diff / 86400000)}d`
}

const getCapabilityIcon = (capability) => {
  if (capability === 'presence' || capability === 'motion' || capability === 'occupancy') return Radio
  if (capability === 'vibration') return Vibrate
  return Activity
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
              <h1 class="text-xl font-semibold text-gray-900">Dashboard</h1>
              <p class="text-sm text-gray-500">Overzicht sensor activiteit</p>
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
      <!-- Status Card -->
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
            class="w-14 h-14 rounded-xl flex items-center justify-center"
            :class="dashboardStore.status.level === 'normal' ? 'bg-emerald-100' : 'bg-amber-100'"
          >
            <Activity
              class="w-7 h-7"
              :class="dashboardStore.status.level === 'normal' ? 'text-emerald-600' : 'text-amber-600'"
            />
          </div>
          <div class="flex-1">
            <h2 class="text-xl font-semibold text-gray-900">{{ dashboardStore.status.message }}</h2>
            <p class="text-sm text-gray-600 mt-1">
              Laatste activiteit: {{ dashboardStore.status.lastActivityLocation }}
              <span v-if="dashboardStore.status.lastActivity" class="text-gray-500">
                ({{ formatTime(dashboardStore.status.lastActivity) }} geleden)
              </span>
            </p>
          </div>
          <div class="text-right">
            <p class="text-2xl font-bold text-gray-900">{{ dashboardStore.sensors.length }}</p>
            <p class="text-sm text-gray-500">sensoren</p>
          </div>
        </div>
      </div>

      <div class="grid lg:grid-cols-3 gap-6">
        <!-- Activity Timeline -->
        <div class="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Clock class="w-5 h-5 text-gray-400" />
              Vandaag
            </h2>
            <span class="text-sm text-gray-500">{{ dashboardStore.todayTimeline.length }} events</span>
          </div>

          <div v-if="dashboardStore.todayTimeline.length > 0" class="space-y-4">
            <div
              v-for="(event, index) in dashboardStore.todayTimeline"
              :key="index"
              class="flex items-start gap-4"
            >
              <div class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <component
                  :is="getCapabilityIcon(event.capability)"
                  class="w-5 h-5 text-gray-500"
                />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-gray-900">{{ event.event }}</p>
                <p class="text-sm text-gray-500">{{ event.location }}</p>
              </div>
              <span class="text-sm text-gray-400">{{ event.time }}</span>
            </div>
          </div>

          <div v-else class="text-center py-12">
            <Clock class="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p class="text-gray-500">Nog geen activiteit vandaag</p>
          </div>
        </div>

        <!-- Sensors Summary -->
        <div class="space-y-4">
          <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp class="w-5 h-5 text-gray-400" />
              Sensoren
            </h2>

            <div class="space-y-3">
              <div
                v-for="sensor in dashboardStore.sensors"
                :key="sensor.id"
                class="flex items-center gap-3 p-3 rounded-xl bg-gray-50"
              >
                <div
                  class="w-10 h-10 rounded-lg flex items-center justify-center"
                  :class="isRecent(sensor.lastActivity) ? 'bg-emerald-100' : 'bg-gray-200'"
                >
                  <Radio
                    v-if="sensor.type === 'presence'"
                    class="w-5 h-5"
                    :class="isRecent(sensor.lastActivity) ? 'text-emerald-600' : 'text-gray-400'"
                  />
                  <Vibrate
                    v-else-if="sensor.type === 'vibration'"
                    class="w-5 h-5"
                    :class="isRecent(sensor.lastActivity) ? 'text-emerald-600' : 'text-gray-400'"
                  />
                  <Circle
                    v-else
                    class="w-5 h-5"
                    :class="isRecent(sensor.lastActivity) ? 'text-emerald-600' : 'text-gray-400'"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-gray-900 text-sm font-medium truncate">{{ sensor.name }}</p>
                  <p class="text-xs text-gray-500">{{ formatTime(sensor.lastActivity) }}</p>
                </div>
                <span
                  class="w-2 h-2 rounded-full"
                  :class="isRecent(sensor.lastActivity) ? 'bg-emerald-500' : 'bg-gray-300'"
                />
              </div>
            </div>

            <div v-if="dashboardStore.sensors.length === 0" class="text-center py-8">
              <Circle class="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p class="text-sm text-gray-500">Geen sensoren</p>
            </div>
          </div>

          <!-- Quick Links -->
          <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">Snelle links</h2>
            <div class="space-y-2">
              <router-link
                to="/dashboard/status"
                class="block p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span class="text-gray-900 text-sm">Live Status</span>
              </router-link>
              <router-link
                to="/dashboard/sensoren"
                class="block p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span class="text-gray-900 text-sm">Sensor Details</span>
              </router-link>
              <router-link
                to="/plattegrond"
                class="block p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span class="text-gray-900 text-sm">Plattegrond</span>
              </router-link>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
