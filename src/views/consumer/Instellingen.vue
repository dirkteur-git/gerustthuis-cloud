<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import Tabs from '@/components/ui/Tabs.vue'
import {
  User,
  Bell,
  CreditCard,
  Shield
} from 'lucide-vue-next'

const authStore = useAuthStore()

const tabs = [
  { id: 'profile', label: 'Profiel' },
  { id: 'notifications', label: 'Notificaties' },
  { id: 'subscription', label: 'Abonnement' },
  { id: 'security', label: 'Beveiliging' }
]

const activeTab = ref('profile')

// Profile form
const profile = ref({
  firstName: authStore.user?.firstName || '',
  lastName: authStore.user?.lastName || '',
  email: authStore.user?.email || '',
  phone: ''
})

// Senior profile
const senior = ref({
  name: 'Mevrouw de Vries',
  birthDate: '1942-05-15',
  notes: ''
})

// Notification settings
const notifications = ref({
  dailySummary: true,
  dailySummaryTime: '08:00',
  instantAlerts: true,
  alertEmail: true,
  alertSms: false,
  alertPush: true,
  nightMode: true,
  nightStart: '22:00',
  nightEnd: '07:00'
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-gray-900 mb-1">Instellingen</h1>
      <p class="text-gray-600">Beheer je account en voorkeuren</p>
    </div>

    <Tabs :tabs="tabs" v-model="activeTab">
      <!-- Profile -->
      <template #profile>
        <div class="grid lg:grid-cols-2 gap-6">
          <Card>
            <h3 class="text-lg font-bold text-gray-900 mb-6">Jouw gegevens</h3>
            <div class="space-y-4">
              <div class="grid sm:grid-cols-2 gap-4">
                <Input
                  v-model="profile.firstName"
                  label="Voornaam"
                />
                <Input
                  v-model="profile.lastName"
                  label="Achternaam"
                />
              </div>
              <Input
                v-model="profile.email"
                label="E-mailadres"
                type="email"
              />
              <Input
                v-model="profile.phone"
                label="Telefoonnummer"
                type="tel"
              />
              <Button variant="primary">Opslaan</Button>
            </div>
          </Card>

          <Card>
            <h3 class="text-lg font-bold text-gray-900 mb-6">Gegevens senior</h3>
            <div class="space-y-4">
              <Input
                v-model="senior.name"
                label="Naam"
              />
              <Input
                v-model="senior.birthDate"
                label="Geboortedatum"
                type="date"
              />
              <Input
                v-model="senior.notes"
                label="Bijzonderheden"
                placeholder="Medicijnen, gewoontes, etc."
              />
              <Button variant="primary">Opslaan</Button>
            </div>
          </Card>
        </div>
      </template>

      <!-- Notifications -->
      <template #notifications>
        <div class="grid lg:grid-cols-2 gap-6">
          <Card>
            <h3 class="text-lg font-bold text-gray-900 mb-6">Systeem Status</h3>
            <div class="space-y-4">
              <p class="text-sm text-gray-600 mb-4">
                Je kunt in de app altijd zien of het systeem actief is en of er afwijkingen zijn gedetecteerd.
                Er worden geen samenvattingen of details over sensordata getoond - alleen "Alles is in orde" of een melding.
              </p>
              <Checkbox v-model="notifications.dailySummary">
                Dagelijkse bevestiging dat systeem actief is
              </Checkbox>
              <Input
                v-if="notifications.dailySummary"
                v-model="notifications.dailySummaryTime"
                label="Tijdstip"
                type="time"
              />
            </div>
          </Card>

          <Card>
            <h3 class="text-lg font-bold text-gray-900 mb-6">Alerts</h3>
            <div class="space-y-4">
              <Checkbox v-model="notifications.instantAlerts">
                Ontvang directe alerts bij afwijkingen
              </Checkbox>
              <div v-if="notifications.instantAlerts" class="space-y-3 ml-7">
                <Checkbox v-model="notifications.alertEmail">Via e-mail</Checkbox>
                <Checkbox v-model="notifications.alertSms">Via SMS</Checkbox>
                <Checkbox v-model="notifications.alertPush">Via push notificatie</Checkbox>
              </div>
            </div>
          </Card>

          <Card class="lg:col-span-2">
            <h3 class="text-lg font-bold text-gray-900 mb-6">Nachtmodus</h3>
            <div class="space-y-4">
              <Checkbox v-model="notifications.nightMode">
                Alleen urgente alerts tijdens nachtmodus
              </Checkbox>
              <div v-if="notifications.nightMode" class="grid sm:grid-cols-2 gap-4">
                <Input
                  v-model="notifications.nightStart"
                  label="Start nachtmodus"
                  type="time"
                />
                <Input
                  v-model="notifications.nightEnd"
                  label="Einde nachtmodus"
                  type="time"
                />
              </div>
            </div>
            <div class="mt-6">
              <Button variant="primary">Opslaan</Button>
            </div>
          </Card>
        </div>
      </template>

      <!-- Subscription -->
      <template #subscription>
        <Card>
          <div class="flex items-start justify-between mb-6">
            <div>
              <h3 class="text-lg font-bold text-gray-900 mb-1">Huidig abonnement</h3>
              <p class="text-gray-600">Compleet pakket</p>
            </div>
            <span class="text-2xl font-bold text-gray-900">€19,95/maand</span>
          </div>

          <div class="p-4 bg-gray-50 rounded-lg mb-6">
            <div class="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span class="text-gray-500">Volgende factuurdatum</span>
                <p class="font-medium text-gray-900">15 februari 2026</p>
              </div>
              <div>
                <span class="text-gray-500">Betaalmethode</span>
                <p class="font-medium text-gray-900">iDEAL</p>
              </div>
            </div>
          </div>

          <div class="flex flex-wrap gap-3">
            <Button variant="outline">Facturen bekijken</Button>
            <Button variant="outline">Upgrade naar Premium</Button>
            <Button variant="ghost" class="text-error hover:text-error">
              Abonnement opzeggen
            </Button>
          </div>
        </Card>
      </template>

      <!-- Security -->
      <template #security>
        <div class="grid lg:grid-cols-2 gap-6">
          <Card>
            <h3 class="text-lg font-bold text-gray-900 mb-6">Wachtwoord wijzigen</h3>
            <div class="space-y-4">
              <Input
                label="Huidig wachtwoord"
                type="password"
              />
              <Input
                label="Nieuw wachtwoord"
                type="password"
              />
              <Input
                label="Bevestig nieuw wachtwoord"
                type="password"
              />
              <Button variant="primary">Wachtwoord wijzigen</Button>
            </div>
          </Card>

          <Card>
            <h3 class="text-lg font-bold text-gray-900 mb-6">Tweestapsverificatie</h3>
            <p class="text-gray-600 mb-4">
              Voeg een extra beveiligingslaag toe aan je account door tweestapsverificatie in te schakelen.
            </p>
            <Button variant="outline">
              <Shield class="w-4 h-4 mr-2" />
              Inschakelen
            </Button>
          </Card>

          <Card class="lg:col-span-2">
            <h3 class="text-lg font-bold text-gray-900 mb-6">Gevarenzone</h3>
            <p class="text-gray-600 mb-4">
              Let op: deze acties zijn permanent en kunnen niet ongedaan worden gemaakt.
            </p>
            <Button variant="ghost" class="text-error hover:text-error hover:bg-error/10">
              Account verwijderen
            </Button>
          </Card>
        </div>
      </template>
    </Tabs>
  </div>
</template>
