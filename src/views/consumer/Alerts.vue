<script setup>
import { ref, computed } from 'vue'
import { useDashboardStore } from '@/stores/dashboard'
import Card from '@/components/ui/Card.vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Filter
} from 'lucide-vue-next'

const dashboardStore = useDashboardStore()

const filter = ref('all')

const filteredAlerts = computed(() => {
  if (filter.value === 'all') return dashboardStore.alerts
  if (filter.value === 'unread') return dashboardStore.alerts.filter(a => !a.read)
  return dashboardStore.alerts.filter(a => a.type === filter.value)
})

const formatDate = (isoString) => {
  return new Date(isoString).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getAlertIcon = (type) => {
  switch (type) {
    case 'warning': return AlertTriangle
    case 'error': return AlertCircle
    case 'success': return CheckCircle
    default: return Info
  }
}

const getAlertColor = (type) => {
  switch (type) {
    case 'warning': return 'text-warning bg-warning/10'
    case 'error': return 'text-error bg-error/10'
    case 'success': return 'text-success bg-success/10'
    default: return 'text-blue-500 bg-blue-50'
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 mb-1">Alerts & meldingen</h1>
        <p class="text-gray-600">Bekijk alle meldingen en alerts</p>
      </div>
      <Button
        v-if="dashboardStore.unreadCount > 0"
        variant="outline"
        size="sm"
        @click="dashboardStore.markAllAlertsAsRead"
      >
        Alles als gelezen markeren
      </Button>
    </div>

    <!-- Filters -->
    <Card padding="sm">
      <div class="flex items-center gap-2 flex-wrap">
        <Filter class="w-4 h-4 text-gray-500" />
        <button
          v-for="f in ['all', 'unread', 'warning', 'info']"
          :key="f"
          class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          :class="[
            filter === f
              ? 'bg-primary text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          ]"
          @click="filter = f"
        >
          {{ f === 'all' ? 'Alle' :
             f === 'unread' ? `Ongelezen (${dashboardStore.unreadCount})` :
             f === 'warning' ? 'Waarschuwingen' : 'Info' }}
        </button>
      </div>
    </Card>

    <!-- Alerts List -->
    <div class="space-y-4">
      <Card
        v-for="alert in filteredAlerts"
        :key="alert.id"
        class="transition-opacity"
        :class="{ 'opacity-60': alert.read }"
      >
        <div class="flex items-start gap-4">
          <div
            class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            :class="getAlertColor(alert.type)"
          >
            <component :is="getAlertIcon(alert.type)" class="w-5 h-5" />
          </div>
          <div class="flex-1">
            <div class="flex items-start justify-between gap-4">
              <div>
                <h3 class="font-semibold text-gray-900 mb-1">
                  {{ alert.title }}
                </h3>
                <p class="text-gray-600">{{ alert.message }}</p>
                <p class="text-sm text-gray-500 mt-2">
                  {{ formatDate(alert.timestamp) }}
                </p>
              </div>
              <Badge v-if="!alert.read" variant="primary" size="sm">
                Nieuw
              </Badge>
            </div>
          </div>
        </div>
        <div v-if="!alert.read" class="mt-4 pt-4 border-t border-gray-100">
          <Button
            variant="ghost"
            size="sm"
            @click="dashboardStore.markAlertAsRead(alert.id)"
          >
            Als gelezen markeren
          </Button>
        </div>
      </Card>

      <p
        v-if="filteredAlerts.length === 0"
        class="text-center py-12 text-gray-500"
      >
        Geen meldingen gevonden.
      </p>
    </div>
  </div>
</template>
