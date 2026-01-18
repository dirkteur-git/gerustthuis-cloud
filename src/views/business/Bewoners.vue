<script setup>
import { ref } from 'vue'
import Card from '@/components/ui/Card.vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import {
  User,
  Phone,
  MapPin,
  Plus,
  MoreVertical
} from 'lucide-vue-next'

const bewoners = ref([
  {
    id: 1,
    naam: 'Mevr. A. Jansen',
    kamer: 'Kamer 101',
    leeftijd: 82,
    contact: 'Dhr. M. Jansen (zoon)',
    telefoon: '06-12345678',
    status: 'actief'
  },
  {
    id: 2,
    naam: 'Dhr. P. de Vries',
    kamer: 'Kamer 102',
    leeftijd: 78,
    contact: 'Mevr. L. de Vries (dochter)',
    telefoon: '06-23456789',
    status: 'actief'
  },
  {
    id: 3,
    naam: 'Mevr. H. Bakker',
    kamer: 'Kamer 103',
    leeftijd: 85,
    contact: 'Dhr. J. Bakker (zoon)',
    telefoon: '06-34567890',
    status: 'monitoring'
  },
  {
    id: 4,
    naam: 'Dhr. K. Smit',
    kamer: 'Kamer 104',
    leeftijd: 79,
    contact: 'Mevr. A. Smit (dochter)',
    telefoon: '06-45678901',
    status: 'actief'
  },
  {
    id: 5,
    naam: 'Mevr. E. van Dijk',
    kamer: 'Kamer 105',
    leeftijd: 88,
    contact: 'Dhr. R. van Dijk (zoon)',
    telefoon: '06-56789012',
    status: 'actief'
  },
  {
    id: 6,
    naam: 'Dhr. W. Visser',
    kamer: 'Kamer 106',
    leeftijd: 76,
    contact: 'Mevr. S. Visser (dochter)',
    telefoon: '06-67890123',
    status: 'actief'
  }
])
</script>

<template>
  <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Bewoners</h1>
          <p class="text-gray-600">Overzicht van alle bewoners en hun contactpersonen</p>
        </div>
        <Button variant="primary">
          <Plus class="w-5 h-5 mr-2" />
          Bewoner toevoegen
        </Button>
      </div>

      <!-- Bewoners tabel -->
      <Card padding="none">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-gray-200 bg-gray-50">
                <th class="text-left py-4 px-6 text-sm font-medium text-gray-500">Bewoner</th>
                <th class="text-left py-4 px-6 text-sm font-medium text-gray-500">Kamer</th>
                <th class="text-left py-4 px-6 text-sm font-medium text-gray-500">Contactpersoon</th>
                <th class="text-left py-4 px-6 text-sm font-medium text-gray-500">Status</th>
                <th class="text-right py-4 px-6 text-sm font-medium text-gray-500">Acties</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="bewoner in bewoners"
                :key="bewoner.id"
                class="border-b border-gray-100 hover:bg-gray-50"
              >
                <td class="py-4 px-6">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <User class="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p class="font-medium text-gray-900">{{ bewoner.naam }}</p>
                      <p class="text-sm text-gray-500">{{ bewoner.leeftijd }} jaar</p>
                    </div>
                  </div>
                </td>
                <td class="py-4 px-6">
                  <div class="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin class="w-4 h-4 text-gray-400" />
                    {{ bewoner.kamer }}
                  </div>
                </td>
                <td class="py-4 px-6">
                  <div>
                    <p class="text-sm text-gray-900">{{ bewoner.contact }}</p>
                    <div class="flex items-center gap-1 text-sm text-gray-500">
                      <Phone class="w-3 h-3" />
                      {{ bewoner.telefoon }}
                    </div>
                  </div>
                </td>
                <td class="py-4 px-6">
                  <Badge
                    :variant="bewoner.status === 'actief' ? 'success' : 'warning'"
                    size="sm"
                  >
                    {{ bewoner.status === 'actief' ? 'Actief' : 'Monitoring' }}
                  </Badge>
                </td>
                <td class="py-4 px-6 text-right">
                  <Button variant="ghost" size="sm">
                    <MoreVertical class="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
  </div>
</template>
