<script setup>
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import {
  LayoutDashboard,
  DoorOpen,
  Users,
  Bell,
  Settings,
  LogOut
} from 'lucide-vue-next'

const route = useRoute()
const authStore = useAuthStore()

const navigation = [
  { name: 'Dashboard', href: '/pro/dashboard', icon: LayoutDashboard },
  { name: 'Kamers', href: '/pro/kamers', icon: DoorOpen },
  { name: 'Bewoners', href: '/pro/bewoners', icon: Users },
  { name: 'Meldingen', href: '/pro/meldingen', icon: Bell },
  { name: 'Instellingen', href: '/pro/instellingen', icon: Settings }
]

const isActive = (href) => {
  return route.path === href || route.path.startsWith(href + '/')
}
</script>

<template>
  <div class="flex flex-col w-64 bg-white border-r border-gray-200 min-h-screen">
    <!-- Logo -->
    <div class="flex items-center gap-3 px-6 py-5 border-b border-gray-200">
      <div class="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
        <span class="text-white font-bold text-xl">G</span>
      </div>
      <div>
        <span class="font-bold text-gray-900">GerustThuis</span>
        <span class="block text-xs text-primary font-medium">Pro</span>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 px-4 py-6 space-y-1">
      <RouterLink
        v-for="item in navigation"
        :key="item.name"
        :to="item.href"
        :class="[
          'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
          isActive(item.href)
            ? 'bg-primary/10 text-primary font-medium'
            : 'text-gray-600 hover:bg-gray-100'
        ]"
      >
        <component :is="item.icon" class="w-5 h-5" />
        {{ item.name }}
      </RouterLink>
    </nav>

    <!-- User section -->
    <div class="border-t border-gray-200 p-4">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
          <span class="text-primary font-semibold">{{ authStore.userInitials }}</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-900 truncate">
            {{ authStore.user?.firstName }}
          </p>
          <p class="text-xs text-gray-500 truncate">
            {{ authStore.user?.organization }}
          </p>
        </div>
      </div>
      <button
        @click="authStore.logout"
        class="flex items-center gap-2 w-full px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <LogOut class="w-4 h-4" />
        <span class="text-sm">Uitloggen</span>
      </button>
    </div>
  </div>
</template>
