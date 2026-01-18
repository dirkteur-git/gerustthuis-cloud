<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import Card from '@/components/ui/Card.vue'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'
import Checkbox from '@/components/ui/Checkbox.vue'

const authStore = useAuthStore()
const router = useRouter()

const form = ref({
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
  agreeTerms: false
})

const errors = ref({})

const handleSubmit = async () => {
  errors.value = {}

  if (form.value.password !== form.value.confirmPassword) {
    errors.value.confirmPassword = 'Wachtwoorden komen niet overeen'
    return
  }

  if (!form.value.agreeTerms) {
    errors.value.agreeTerms = 'Je moet akkoord gaan met de voorwaarden'
    return
  }

  const success = await authStore.register({
    firstName: form.value.firstName,
    lastName: form.value.lastName,
    email: form.value.email
  })

  if (success) {
    router.push('/dashboard')
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
        <h1 class="text-3xl font-bold text-gray-900 mb-2">Account aanmaken</h1>
        <p class="text-gray-600">Start met GerustThuis</p>
      </div>

      <Card>
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <Input
              v-model="form.firstName"
              label="Voornaam"
              required
            />
            <Input
              v-model="form.lastName"
              label="Achternaam"
              required
            />
          </div>
          <Input
            v-model="form.email"
            label="E-mailadres"
            type="email"
            required
            :error="authStore.error"
          />
          <Input
            v-model="form.password"
            label="Wachtwoord"
            type="password"
            required
          />
          <Input
            v-model="form.confirmPassword"
            label="Bevestig wachtwoord"
            type="password"
            required
            :error="errors.confirmPassword"
          />

          <Checkbox v-model="form.agreeTerms" :error="errors.agreeTerms">
            <span>
              Ik ga akkoord met de
              <RouterLink to="/voorwaarden" class="text-primary hover:underline">algemene voorwaarden</RouterLink>
              en het
              <RouterLink to="/privacy" class="text-primary hover:underline">privacybeleid</RouterLink>
            </span>
          </Checkbox>

          <Button
            type="submit"
            variant="primary"
            full-width
            :loading="authStore.loading"
          >
            Account aanmaken
          </Button>
        </form>
      </Card>

      <p class="text-center mt-6 text-gray-600">
        Al een account?
        <RouterLink to="/login" class="text-primary hover:underline font-medium">
          Inloggen
        </RouterLink>
      </p>
    </div>
  </div>
</template>
