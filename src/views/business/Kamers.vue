<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import Card from '@/components/ui/Card.vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import {
  DoorOpen,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  Plus
} from 'lucide-vue-next'

// Demo data - in productie komt dit uit Supabase
const kamers = ref([
  {
    id: 1,
    naam: 'Kamer 101',
    bewoner: 'Mevr. Jansen',
    status: 'ok',
    laatsteActiviteit: '10 min geleden',
    sensoren: 3
  },
  {
    id: 2,
    naam: 'Kamer 102',
    bewoner: 'Dhr. de Vries',
    status: 'ok',
    laatsteActiviteit: '25 min geleden',
    sensoren: 4
  },
  {
    id: 3,
    naam: 'Kamer 103',
    bewoner: 'Mevr. Bakker',
    status: 'warning',
    laatsteActiviteit: '2 uur geleden',
    sensoren: 3
  },
  {
    id: 4,
    naam: 'Kamer 104',
    bewoner: 'Dhr. Smit',
    status: 'ok',
    laatsteActiviteit: '5 min geleden',
    sensoren: 5
  },
  {
    id: 5,
    naam: 'Kamer 105',
    bewoner: 'Mevr. van Dijk',
    status: 'ok',
    laatsteActiviteit: '15 min geleden',
    sensoren: 3
  },
  {
    id: 6,
    naam: 'Kamer 106',
    bewoner: 'Dhr. Visser',
    status: 'ok',
    laatsteActiviteit: '30 min geleden',
    sensoren: 4
  }
])
</script>

<template>
  <div class="space-y-6">
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Kamers</h1>
          <p class="text-gray-600">Beheer en monitor alle kamers</p>
        </div>
        <Button variant="primary">
          <Plus class="w-5 h-5 mr-2" />
          Kamer toevoegen
        </Button>
      </div>

      <!-- Kamers grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <RouterLink
          v-for="kamer in kamers"
          :key="kamer.id"
          :to="`/kamers/${kamer.id}`"
          class="block"
        >
          <Card :hover="true" class="h-full">
            <div class="flex items-start justify-between mb-4">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <DoorOpen class="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 class="font-bold text-gray-900">{{ kamer.naam }}</h3>
                  <p class="text-sm text-gray-600">{{ kamer.bewoner }}</p>
                </div>
              </div>
              <Badge
                :variant="kamer.status === 'ok' ? 'success' : 'warning'"
                size="sm"
              >
                <CheckCircle v-if="kamer.status === 'ok'" class="w-3 h-3 mr-1" />
                <AlertTriangle v-else class="w-3 h-3 mr-1" />
                {{ kamer.status === 'ok' ? 'OK' : 'Let op' }}
              </Badge>
            </div>

            <div class="flex items-center justify-between text-sm">
              <div class="text-gray-500">
                <span>{{ kamer.sensoren }} sensoren</span>
                <span class="mx-2">•</span>
                <span>{{ kamer.laatsteActiviteit }}</span>
              </div>
              <ChevronRight class="w-5 h-5 text-gray-400" />
            </div>
          </Card>
        </RouterLink>
      </div>
    </div>
  </div>
</template>
