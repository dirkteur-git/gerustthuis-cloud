<script setup>
import { ref } from 'vue'
import { useDashboardStore } from '@/stores/dashboard'
import Card from '@/components/ui/Card.vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import Modal from '@/components/ui/Modal.vue'
import Input from '@/components/ui/Input.vue'
import Select from '@/components/ui/Select.vue'
import Avatar from '@/components/ui/Avatar.vue'
import {
  Plus,
  MoreVertical,
  Mail,
  Shield,
  Eye,
  Trash2
} from 'lucide-vue-next'

const dashboardStore = useDashboardStore()

const showInviteModal = ref(false)
const inviteEmail = ref('')
const inviteRole = ref('viewer')
const inviteLoading = ref(false)

const roleLabels = {
  admin: 'Beheerder',
  viewer: 'Meekijker'
}

const roleOptions = [
  { value: 'admin', label: 'Beheerder - Volledige toegang' },
  { value: 'viewer', label: 'Meekijker - Alleen bekijken' }
]

const formatLastActive = (isoString) => {
  if (!isoString) return 'Nog niet ingelogd'
  const diff = Date.now() - new Date(isoString).getTime()
  const hours = Math.floor(diff / 3600000)

  if (hours < 1) return 'Online'
  if (hours < 24) return `${hours} uur geleden`
  return `${Math.floor(hours / 24)} dagen geleden`
}

const getInitials = (name) => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase()
}

const handleInvite = async () => {
  inviteLoading.value = true
  const success = await dashboardStore.inviteFamilyMember(inviteEmail.value, inviteRole.value)
  inviteLoading.value = false

  if (success) {
    showInviteModal.value = false
    inviteEmail.value = ''
    inviteRole.value = 'viewer'
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 mb-1">Familie</h1>
        <p class="text-gray-600">Beheer wie toegang heeft tot het dashboard</p>
      </div>
      <Button variant="primary" @click="showInviteModal = true">
        <Plus class="w-4 h-4 mr-2" />
        Uitnodigen
      </Button>
    </div>

    <!-- Family Members -->
    <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      <Card
        v-for="member in dashboardStore.familyMembers"
        :key="member.id"
      >
        <div class="flex items-start justify-between mb-4">
          <Avatar
            :src="member.avatar"
            :initials="getInitials(member.name)"
            size="lg"
          />
          <button class="p-1 text-gray-400 hover:text-gray-600 rounded">
            <MoreVertical class="w-5 h-5" />
          </button>
        </div>

        <h3 class="font-semibold text-gray-900 mb-1">{{ member.name }}</h3>
        <p class="text-sm text-gray-500 mb-3">{{ member.email }}</p>

        <div class="flex items-center gap-2 mb-4">
          <Badge
            :variant="member.role === 'admin' ? 'primary' : 'default'"
            size="sm"
          >
            <component
              :is="member.role === 'admin' ? Shield : Eye"
              class="w-3 h-3 mr-1"
            />
            {{ roleLabels[member.role] }}
          </Badge>
          <Badge v-if="member.pending" variant="warning" size="sm">
            Uitnodiging verstuurd
          </Badge>
        </div>

        <p class="text-sm text-gray-500">
          {{ formatLastActive(member.lastActive) }}
        </p>

        <div class="mt-4 pt-4 border-t border-gray-100 flex gap-2">
          <Button variant="ghost" size="sm" class="flex-1">
            <Mail class="w-4 h-4 mr-2" />
            Email
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="text-error hover:text-error hover:bg-error/10"
            @click="dashboardStore.removeFamilyMember(member.id)"
          >
            <Trash2 class="w-4 h-4" />
          </Button>
        </div>
      </Card>
    </div>

    <!-- Invite Modal -->
    <Modal v-model="showInviteModal" title="Familielid uitnodigen" size="md">
      <div class="space-y-4">
        <Input
          v-model="inviteEmail"
          label="E-mailadres"
          type="email"
          placeholder="email@example.com"
        />
        <Select
          v-model="inviteRole"
          label="Rol"
          :options="roleOptions"
        />
        <div class="p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
          <p class="font-medium text-gray-900 mb-2">Wat betekenen de rollen?</p>
          <ul class="space-y-1">
            <li><strong>Beheerder:</strong> Kan alles zien en instellingen wijzigen</li>
            <li><strong>Meekijker:</strong> Kan alleen de status en alerts bekijken</li>
          </ul>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-3">
          <Button variant="outline" @click="showInviteModal = false">
            Annuleren
          </Button>
          <Button
            variant="primary"
            :loading="inviteLoading"
            :disabled="!inviteEmail"
            @click="handleInvite"
          >
            Uitnodiging versturen
          </Button>
        </div>
      </template>
    </Modal>
  </div>
</template>
