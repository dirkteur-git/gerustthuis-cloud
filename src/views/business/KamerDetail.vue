<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import Card from '@/components/ui/Card.vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import {
  ArrowLeft,
  Activity,
  Wifi,
  Battery,
  Clock,
  AlertTriangle,
  CheckCircle
} from 'lucide-vue-next'

const route = useRoute()
const kamerId = computed(() => route.params.id)

const kamer = ref({
  id: 1,
  naam: 'Kamer 101',
  bewoner: 'Mevr. Jansen',
  status: 'ok'
})

const sensorReadings = ref([])
const loading = ref(true)

const sensoren = ref([
  { id: 'bewegingssensor', naam: 'Bewegingssensor', type: 'motion', status: 'online', batterij: 85 },
  { id: 'deursensor', naam: 'Deursensor', type: 'door', status: 'online', batterij: 92 },
  { id: 'trillingssensor', naam: 'Trillingssensor', type: 'vibration', status: 'online', batterij: 78 }
])

onMounted(async () => {
  await loadSensorData()
})

async function loadSensorData() {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('sensor_readings')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(50)

    if (error) throw error
    sensorReadings.value = data
  } catch (error) {
    console.error('Error loading sensor data:', error)
  } finally {
    loading.value = false
  }
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function formatSensorValue(reading) {
  if (reading.sensor_type === 'motion') {
    return reading.occupancy ? 'Beweging' : 'Geen beweging'
  }
  if (reading.sensor_type === 'vibration') {
    return reading.vibration ? 'Trilling' : 'Stil'
  }
  if (reading.sensor_type === 'door') {
    return reading.contact ? 'Gesloten' : 'Open'
  }
  return '-'
}
</script>

<template>
  <div class="space-y-6">
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center gap-4">
        <RouterLink to="/kamers">
          <Button variant="ghost" size="sm">
            <ArrowLeft class="w-5 h-5" />
          </Button>
        </RouterLink>
        <div class="flex-1">
          <h1 class="text-2xl font-bold text-gray-900">{{ kamer.naam }}</h1>
          <p class="text-gray-600">{{ kamer.bewoner }}</p>
        </div>
        <Badge :variant="kamer.status === 'ok' ? 'success' : 'warning'" size="lg">
          <CheckCircle v-if="kamer.status === 'ok'" class="w-4 h-4 mr-1" />
          <AlertTriangle v-else class="w-4 h-4 mr-1" />
          {{ kamer.status === 'ok' ? 'Alles OK' : 'Let op' }}
        </Badge>
      </div>

      <!-- Sensoren overzicht -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card v-for="sensor in sensoren" :key="sensor.id">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-medium text-gray-900">{{ sensor.naam }}</h3>
            <Badge :variant="sensor.status === 'online' ? 'success' : 'error'" size="sm">
              <Wifi class="w-3 h-3 mr-1" />
              {{ sensor.status }}
            </Badge>
          </div>
          <div class="flex items-center gap-4 text-sm text-gray-500">
            <div class="flex items-center gap-1">
              <Battery class="w-4 h-4" />
              {{ sensor.batterij }}%
            </div>
            <div class="flex items-center gap-1">
              <Activity class="w-4 h-4" />
              {{ sensor.type }}
            </div>
          </div>
        </Card>
      </div>

      <!-- Sensor data tabel -->
      <Card>
        <h2 class="text-lg font-bold text-gray-900 mb-4">Sensor data</h2>

        <div v-if="loading" class="text-center py-8 text-gray-500">
          Laden...
        </div>

        <div v-else-if="sensorReadings.length === 0" class="text-center py-8 text-gray-500">
          Geen sensor data beschikbaar
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-gray-200">
                <th class="text-left py-3 px-4 text-sm font-medium text-gray-500">Tijd</th>
                <th class="text-left py-3 px-4 text-sm font-medium text-gray-500">Sensor</th>
                <th class="text-left py-3 px-4 text-sm font-medium text-gray-500">Type</th>
                <th class="text-left py-3 px-4 text-sm font-medium text-gray-500">Waarde</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="reading in sensorReadings"
                :key="reading.id"
                class="border-b border-gray-100 hover:bg-gray-50"
              >
                <td class="py-3 px-4">
                  <div class="flex items-center gap-2 text-sm">
                    <Clock class="w-4 h-4 text-gray-400" />
                    {{ formatTime(reading.timestamp) }}
                  </div>
                </td>
                <td class="py-3 px-4 text-sm text-gray-900">
                  {{ reading.sensor_id }}
                </td>
                <td class="py-3 px-4">
                  <Badge variant="default" size="sm">
                    {{ reading.sensor_type }}
                  </Badge>
                </td>
                <td class="py-3 px-4 text-sm text-gray-900">
                  {{ formatSensorValue(reading) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  </div>
</template>
