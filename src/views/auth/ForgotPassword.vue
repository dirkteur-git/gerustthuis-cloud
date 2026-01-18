<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import Card from '@/components/ui/Card.vue'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'
import { ArrowLeft, Mail } from 'lucide-vue-next'

const authStore = useAuthStore()

const email = ref('')
const submitted = ref(false)

const handleSubmit = async () => {
  const success = await authStore.forgotPassword(email.value)
  if (success) {
    submitted.value = true
  }
}
</script>

<template>
  <div class="min-h-[80vh] flex items-center justify-center py-12">
    <div class="w-full max-w-md px-4">
      <div class="text-center mb-8">
        <RouterLink to="/" class="inline-flex items-center gap-2 mb-6">
          <div class="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
            <span class="text-white font-bold text-2xl">G</span>
          </div>
        </RouterLink>
        <h1 class="text-3xl font-bold text-gray-900 mb-2">Wachtwoord vergeten?</h1>
        <p class="text-gray-600">Geen probleem. We sturen je een reset-link.</p>
      </div>

      <Card>
        <div v-if="submitted" class="text-center py-4">
          <div class="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail class="w-8 h-8 text-success" />
          </div>
          <h2 class="text-xl font-bold text-gray-900 mb-2">Check je inbox</h2>
          <p class="text-gray-600 mb-6">
            We hebben een e-mail gestuurd naar <strong>{{ email }}</strong> met instructies om je wachtwoord te resetten.
          </p>
          <RouterLink to="/login">
            <Button variant="outline">
              <ArrowLeft class="w-4 h-4 mr-2" />
              Terug naar inloggen
            </Button>
          </RouterLink>
        </div>

        <form v-else @submit.prevent="handleSubmit" class="space-y-4">
          <Input
            v-model="email"
            label="E-mailadres"
            type="email"
            placeholder="je@email.nl"
            required
            :error="authStore.error"
          />

          <Button
            type="submit"
            variant="primary"
            full-width
            :loading="authStore.loading"
          >
            Verstuur reset-link
          </Button>

          <div class="text-center">
            <RouterLink to="/login" class="text-sm text-primary hover:underline">
              <ArrowLeft class="w-4 h-4 inline mr-1" />
              Terug naar inloggen
            </RouterLink>
          </div>
        </form>
      </Card>
    </div>
  </div>
</template>
