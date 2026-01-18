<script setup>
import { ref, onMounted } from 'vue'
import Card from '@/components/ui/Card.vue'
import Badge from '@/components/ui/Badge.vue'
import {
  DoorOpen,
  Users,
  AlertTriangle,
  CheckCircle,
  Activity
} from 'lucide-vue-next'

const stats = ref([
  { name: 'Actieve kamers', value: '12', icon: DoorOpen, color: 'primary' },
  { name: 'Bewoners', value: '12', icon: Users, color: 'primary' },
  { name: 'Meldingen vandaag', value: '0', icon: AlertTriangle, color: 'warning' },
  { name: 'Systemen OK', value: '12/12', icon: CheckCircle, color: 'success' }
])

const recentActivity = ref([])
const loading = ref(true)

onMounted(async () => {
  await loadRecentActivity()
})

async function loadRecentActivity() {
  loading.value = true
  try {
    // Demo data - replace with actual Supabase call when connected
    recentActivity.value = [
      { id: 1, sensor: 'Kamer 101', type: 'motion', value: 'Beweging gedetecteerd', time: '10:45', date: new Date().toLocaleDateString('nl-NL') },
      { id: 2, sensor: 'Kamer 102', type: 'door', value: 'Deur geopend', time: '10:32', date: new Date().toLocaleDateString('nl-NL') },
      { id: 3, sensor: 'Kamer 103', type: 'motion', value: 'Geen beweging', time: '10:15', date: new Date().toLocaleDateString('nl-NL') },
    ]
  } catch (error) {
    console.error('Error loading activity:', error)
  } finally {
    loading.value = false
  }
}

function formatSensorValue(reading) {
  if (reading.sensor_type === 'motion') {
    return reading.occupancy ? 'Beweging gedetecteerd' : 'Geen beweging'
  }
  if (reading.sensor_type === 'vibration') {
    return reading.vibration ? 'Trilling gedetecteerd' : 'Geen trilling'
  }
  if (reading.sensor_type === 'door') {
    return reading.contact ? 'Deur gesloten' : 'Deur geopend'
  }
  return JSON.stringify(reading.raw_data || {})
}

function getSensorBadgeVariant(type) {
  const variants = {
    motion: 'primary',
    vibration: 'warning',
    door: 'default'
  }
  return variants[type] || 'default'
}
</script>

<template>
  <div class="space-y-8">
      <!-- Header -->
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p class="text-gray-600">Overzicht van alle kamers en bewoners</p>
      </div>

      <!-- Stats grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card v-for="stat in stats" :key="stat.name">
          <div class="flex items-center gap-4">
            <div
              :class="[
                'w-12 h-12 rounded-lg flex items-center justify-center',
                stat.color === 'primary' ? 'bg-primary/10' : '',
                stat.color === 'warning' ? 'bg-yellow-100' : '',
                stat.color === 'success' ? 'bg-green-100' : ''
              ]"
            >
              <component
                :is="stat.icon"
                :class="[
                  'w-6 h-6',
                  stat.color === 'primary' ? 'text-primary' : '',
                  stat.color === 'warning' ? 'text-yellow-600' : '',
                  stat.color === 'success' ? 'text-green-600' : ''
                ]"
              />
            </div>
            <div>
              <p class="text-sm text-gray-600">{{ stat.name }}</p>
              <p class="text-2xl font-bold text-gray-900">{{ stat.value }}</p>
            </div>
          </div>
        </Card>
      </div>

      <!-- Recent Activity -->
      <Card>
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-lg font-bold text-gray-900">Recente activiteit</h2>
          <Badge variant="primary">Live</Badge>
        </div>

        <div v-if="loading" class="text-center py-8 text-gray-500">
          Laden...
        </div>

        <div v-else-if="recentActivity.length === 0" class="text-center py-8 text-gray-500">
          Geen recente activiteit gevonden
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="activity in recentActivity"
            :key="activity.id"
            class="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
          >
            <div class="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-gray-200">
              <Activity class="w-5 h-5 text-gray-600" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="font-medium text-gray-900 truncate">{{ activity.sensor }}</span>
                <Badge :variant="getSensorBadgeVariant(activity.type)" size="sm">
                  {{ activity.type }}
                </Badge>
              </div>
              <p class="text-sm text-gray-600">{{ activity.value }}</p>
            </div>
            <div class="text-right text-sm text-gray-500">
              <div>{{ activity.time }}</div>
              <div class="text-xs">{{ activity.date }}</div>
            </div>
          </div>
        </div>
      </Card>
  </div>
</template>
