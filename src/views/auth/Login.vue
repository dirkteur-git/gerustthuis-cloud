<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import Card from '@/components/ui/Card.vue'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'
import Checkbox from '@/components/ui/Checkbox.vue'

const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const rememberMe = ref(false)

const handleSubmit = async () => {
  await authStore.login(username.value, password.value)
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
        <h1 class="text-3xl font-bold text-gray-900 mb-2">Welkom terug</h1>
        <p class="text-gray-600">Log in op je GerustThuis account</p>
      </div>

      <Card>
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <Input
            v-model="username"
            label="Gebruikersnaam"
            type="text"
            required
            :error="authStore.error"
          />
          <Input
            v-model="password"
            label="Wachtwoord"
            type="password"
            required
          />

          <div class="flex items-center">
            <Checkbox v-model="rememberMe">
              Onthoud mij
            </Checkbox>
          </div>

          <Button
            type="submit"
            variant="primary"
            full-width
            :loading="authStore.loading"
          >
            Inloggen
          </Button>
        </form>
      </Card>

      <p class="text-center mt-6 text-gray-600">
        Nog geen account?
        <RouterLink to="/producten" class="text-primary hover:underline font-medium">
          Bestel eerst een pakket
        </RouterLink>
      </p>
    </div>
  </div>
</template>
