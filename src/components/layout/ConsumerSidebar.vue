<script setup>
import { RouterLink, useRoute } from 'vue-router'
import {
  LayoutDashboard,
  Activity,
  TrendingUp,
  Home,
  Settings
} from 'lucide-vue-next'

const route = useRoute()

const navigation = [
  { name: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
  { name: 'Status', href: '/app/status', icon: Activity },
  { name: 'Patronen', href: '/app/patronen', icon: TrendingUp },
  { name: 'Woning', href: '/app/woning', icon: Home }
]

const bottomNavigation = [
  { name: 'Instellingen', href: '/app/instellingen', icon: Settings }
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
      </div>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 px-4 py-6 space-y-1 flex flex-col">
      <div class="space-y-1">
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
      </div>

      <!-- Spacer -->
      <div class="flex-1"></div>

      <!-- Bottom Navigation (Instellingen) -->
      <div class="space-y-1">
        <RouterLink
          v-for="item in bottomNavigation"
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
      </div>
    </nav>
  </div>
</template>
