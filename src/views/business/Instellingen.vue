<script setup>
import { ref } from 'vue'
import Card from '@/components/ui/Card.vue'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'
import { useAuthStore } from '@/stores/auth'
import {
  Building,
  Bell,
  Shield,
  Users
} from 'lucide-vue-next'

const authStore = useAuthStore()

const organisatie = ref({
  naam: 'Zorginstelling Demo',
  adres: 'Voorbeeldstraat 123',
  postcode: '1234 AB',
  plaats: 'Amsterdam',
  telefoon: '020-1234567',
  email: 'info@zorginstelling.nl'
})

const notificaties = ref({
  emailMeldingen: true,
  pushMeldingen: true,
  dagelijksRapport: false,
  inactiviteitDrempel: 120
})
</script>

<template>
  <div class="space-y-6">
    <div class="space-y-6 max-w-3xl">
      <!-- Header -->
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Instellingen</h1>
        <p class="text-gray-600">Beheer de instellingen van uw organisatie</p>
      </div>

      <!-- Organisatie -->
      <Card>
        <div class="flex items-center gap-3 mb-6">
          <div class="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <Building class="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 class="font-bold text-gray-900">Organisatie</h2>
            <p class="text-sm text-gray-500">Algemene informatie</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input v-model="organisatie.naam" label="Naam organisatie" />
          <Input v-model="organisatie.telefoon" label="Telefoon" />
          <Input v-model="organisatie.adres" label="Adres" />
          <Input v-model="organisatie.email" label="E-mail" />
          <Input v-model="organisatie.postcode" label="Postcode" />
          <Input v-model="organisatie.plaats" label="Plaats" />
        </div>

        <div class="mt-6">
          <Button variant="primary">Opslaan</Button>
        </div>
      </Card>

      <!-- Notificaties -->
      <Card>
        <div class="flex items-center gap-3 mb-6">
          <div class="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <Bell class="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 class="font-bold text-gray-900">Notificaties</h2>
            <p class="text-sm text-gray-500">Hoe en wanneer u meldingen ontvangt</p>
          </div>
        </div>

        <div class="space-y-4">
          <label class="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
            <div>
              <p class="font-medium text-gray-900">E-mail meldingen</p>
              <p class="text-sm text-gray-500">Ontvang meldingen via e-mail</p>
            </div>
            <input
              type="checkbox"
              v-model="notificaties.emailMeldingen"
              class="w-5 h-5 text-primary rounded"
            />
          </label>

          <label class="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
            <div>
              <p class="font-medium text-gray-900">Push notificaties</p>
              <p class="text-sm text-gray-500">Ontvang directe push meldingen</p>
            </div>
            <input
              type="checkbox"
              v-model="notificaties.pushMeldingen"
              class="w-5 h-5 text-primary rounded"
            />
          </label>

          <label class="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer">
            <div>
              <p class="font-medium text-gray-900">Dagelijks rapport</p>
              <p class="text-sm text-gray-500">Ontvang een dagelijkse samenvatting</p>
            </div>
            <input
              type="checkbox"
              v-model="notificaties.dagelijksRapport"
              class="w-5 h-5 text-primary rounded"
            />
          </label>

          <div class="p-4 bg-gray-50 rounded-lg">
            <label class="block">
              <p class="font-medium text-gray-900 mb-2">Inactiviteit drempel (minuten)</p>
              <p class="text-sm text-gray-500 mb-3">Melding na hoeveel minuten zonder activiteit</p>
              <Input v-model="notificaties.inactiviteitDrempel" type="number" />
            </label>
          </div>
        </div>

        <div class="mt-6">
          <Button variant="primary">Opslaan</Button>
        </div>
      </Card>

      <!-- Gebruikers -->
      <Card>
        <div class="flex items-center gap-3 mb-6">
          <div class="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <Users class="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 class="font-bold text-gray-900">Gebruikers</h2>
            <p class="text-sm text-gray-500">Beheer wie toegang heeft tot het dashboard</p>
          </div>
        </div>

        <p class="text-gray-600 mb-4">
          Momenteel ingelogd als: <strong>{{ authStore.user?.firstName }}</strong>
        </p>

        <Button variant="outline">Gebruikers beheren</Button>
      </Card>
    </div>
  </div>
</template>
