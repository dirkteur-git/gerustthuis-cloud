<script setup>
import { ref } from 'vue'
import Card from '@/components/ui/Card.vue'
import Badge from '@/components/ui/Badge.vue'
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Shield
} from 'lucide-vue-next'

const currentDate = ref(new Date())

const formatDate = (date) => {
  return date.toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

const prevDay = () => {
  currentDate.value = new Date(currentDate.value.getTime() - 86400000)
}

const nextDay = () => {
  const tomorrow = new Date(currentDate.value.getTime() + 86400000)
  if (tomorrow <= new Date()) {
    currentDate.value = tomorrow
  }
}

const isToday = () => {
  const today = new Date()
  return currentDate.value.toDateString() === today.toDateString()
}

// Status history - only shows "OK" or alerts, no details
const statusHistory = ref([
  { date: new Date(), status: 'ok', hasAlert: false },
  { date: new Date(Date.now() - 86400000), status: 'ok', hasAlert: false },
  { date: new Date(Date.now() - 86400000 * 2), status: 'ok', hasAlert: false },
  { date: new Date(Date.now() - 86400000 * 3), status: 'ok', hasAlert: false },
  { date: new Date(Date.now() - 86400000 * 4), status: 'ok', hasAlert: false },
  { date: new Date(Date.now() - 86400000 * 5), status: 'ok', hasAlert: false },
  { date: new Date(Date.now() - 86400000 * 6), status: 'ok', hasAlert: false }
])
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 mb-1">Status Geschiedenis</h1>
        <p class="text-gray-600">Overzicht van systeem status per dag</p>
      </div>
    </div>

    <!-- Date Navigation -->
    <Card padding="sm">
      <div class="flex items-center justify-between">
        <button
          class="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          @click="prevDay"
        >
          <ChevronLeft class="w-5 h-5 text-gray-600" />
        </button>
        <div class="flex items-center gap-2">
          <Calendar class="w-5 h-5 text-gray-400" />
          <span class="font-medium text-gray-900">{{ formatDate(currentDate) }}</span>
          <Badge v-if="isToday()" variant="primary" size="sm">Vandaag</Badge>
        </div>
        <button
          class="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          :class="{ 'opacity-50 cursor-not-allowed': isToday() }"
          :disabled="isToday()"
          @click="nextDay"
        >
          <ChevronRight class="w-5 h-5 text-gray-600" />
        </button>
      </div>
    </Card>

    <!-- Current Day Status -->
    <Card>
      <div class="flex items-center gap-4">
        <div class="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center">
          <CheckCircle class="w-8 h-8 text-success" />
        </div>
        <div>
          <h2 class="text-xl font-bold text-gray-900">Alles is in orde</h2>
          <p class="text-gray-600">Het systeem was actief en er zijn geen afwijkingen gedetecteerd.</p>
        </div>
      </div>
    </Card>

    <!-- Privacy Notice -->
    <Card class="bg-primary/5 border-primary/20">
      <div class="flex items-start gap-4">
        <div class="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
          <Shield class="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 class="font-semibold text-gray-900 mb-1">Privacy beschermd</h3>
          <p class="text-sm text-gray-600">
            Je ziet hier alleen of het systeem actief was en of er afwijkingen waren.
            Sensordata, bewegingspatronen en tijden zijn niet beschikbaar -
            die blijven lokaal op de hub in de woning.
          </p>
        </div>
      </div>
    </Card>

    <!-- Week Overview -->
    <Card>
      <h3 class="font-semibold text-gray-900 mb-4">Afgelopen 7 dagen</h3>
      <div class="grid grid-cols-7 gap-2">
        <div
          v-for="(day, index) in statusHistory"
          :key="index"
          class="text-center"
        >
          <div class="text-xs text-gray-500 mb-2">
            {{ day.date.toLocaleDateString('nl-NL', { weekday: 'short' }) }}
          </div>
          <div
            class="w-10 h-10 mx-auto rounded-full flex items-center justify-center"
            :class="day.hasAlert ? 'bg-warning/10' : 'bg-success/10'"
          >
            <CheckCircle v-if="!day.hasAlert" class="w-5 h-5 text-success" />
            <AlertTriangle v-else class="w-5 h-5 text-warning" />
          </div>
          <div class="text-xs mt-1" :class="day.hasAlert ? 'text-warning' : 'text-success'">
            {{ day.hasAlert ? 'Melding' : 'OK' }}
          </div>
        </div>
      </div>
    </Card>
  </div>
</template>
