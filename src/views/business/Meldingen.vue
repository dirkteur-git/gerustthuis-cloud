<script setup>
import { ref } from 'vue'
import Card from '@/components/ui/Card.vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Bell,
  Filter
} from 'lucide-vue-next'

const meldingen = ref([
  {
    id: 1,
    type: 'warning',
    titel: 'Langere inactiviteit',
    beschrijving: 'Kamer 103 - Geen beweging gedetecteerd sinds 2 uur',
    kamer: 'Kamer 103',
    bewoner: 'Mevr. Bakker',
    tijd: '14:32',
    datum: 'Vandaag',
    status: 'open'
  },
  {
    id: 2,
    type: 'info',
    titel: 'Batterij laag',
    beschrijving: 'Bewegingssensor in Kamer 106 heeft nog 15% batterij',
    kamer: 'Kamer 106',
    bewoner: 'Dhr. Visser',
    tijd: '11:15',
    datum: 'Vandaag',
    status: 'open'
  },
  {
    id: 3,
    type: 'success',
    titel: 'Afwijking opgelost',
    beschrijving: 'Kamer 102 - Normale activiteit hervat',
    kamer: 'Kamer 102',
    bewoner: 'Dhr. de Vries',
    tijd: '09:45',
    datum: 'Vandaag',
    status: 'resolved'
  },
  {
    id: 4,
    type: 'warning',
    titel: 'Nachtelijke activiteit',
    beschrijving: 'Kamer 101 - Ongebruikelijke activiteit om 03:15',
    kamer: 'Kamer 101',
    bewoner: 'Mevr. Jansen',
    tijd: '03:15',
    datum: 'Gisteren',
    status: 'resolved'
  }
])

const getTypeIcon = (type) => {
  const icons = {
    warning: AlertTriangle,
    info: Bell,
    success: CheckCircle
  }
  return icons[type] || Bell
}

const getTypeColor = (type) => {
  const colors = {
    warning: 'text-yellow-500 bg-yellow-100',
    info: 'text-blue-500 bg-blue-100',
    success: 'text-green-500 bg-green-100'
  }
  return colors[type] || 'text-gray-500 bg-gray-100'
}
</script>

<template>
  <div class="space-y-6">
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Meldingen</h1>
          <p class="text-gray-600">Overzicht van alle systeem meldingen</p>
        </div>
        <Button variant="outline">
          <Filter class="w-5 h-5 mr-2" />
          Filters
        </Button>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <AlertTriangle class="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <p class="text-2xl font-bold text-gray-900">2</p>
              <p class="text-sm text-gray-500">Openstaand</p>
            </div>
          </div>
        </Card>
        <Card>
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle class="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p class="text-2xl font-bold text-gray-900">2</p>
              <p class="text-sm text-gray-500">Opgelost vandaag</p>
            </div>
          </div>
        </Card>
        <Card>
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Clock class="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <p class="text-2xl font-bold text-gray-900">12 min</p>
              <p class="text-sm text-gray-500">Gem. reactietijd</p>
            </div>
          </div>
        </Card>
      </div>

      <!-- Meldingen lijst -->
      <Card padding="none">
        <div class="divide-y divide-gray-100">
          <div
            v-for="melding in meldingen"
            :key="melding.id"
            class="p-6 hover:bg-gray-50 transition-colors"
          >
            <div class="flex items-start gap-4">
              <div
                :class="[
                  'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                  getTypeColor(melding.type)
                ]"
              >
                <component :is="getTypeIcon(melding.type)" class="w-5 h-5" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <h3 class="font-medium text-gray-900">{{ melding.titel }}</h3>
                  <Badge
                    :variant="melding.status === 'open' ? 'warning' : 'success'"
                    size="sm"
                  >
                    {{ melding.status === 'open' ? 'Open' : 'Opgelost' }}
                  </Badge>
                </div>
                <p class="text-sm text-gray-600 mb-2">{{ melding.beschrijving }}</p>
                <div class="flex items-center gap-4 text-xs text-gray-500">
                  <span>{{ melding.kamer }}</span>
                  <span>{{ melding.bewoner }}</span>
                  <span>{{ melding.datum }} om {{ melding.tijd }}</span>
                </div>
              </div>
              <Button v-if="melding.status === 'open'" variant="outline" size="sm">
                Bekijken
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>
