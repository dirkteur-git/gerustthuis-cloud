<script setup>
import { RouterView } from 'vue-router'
import { ref } from 'vue'
import { Menu, Bell } from 'lucide-vue-next'
import ConsumerSidebar from './ConsumerSidebar.vue'
import { useAuthStore } from '@/stores/auth'
import Avatar from '@/components/ui/Avatar.vue'

const authStore = useAuthStore()
const isSidebarOpen = ref(false)

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}
</script>

<template>
  <div class="min-h-screen flex bg-gray-50">
    <!-- Desktop Sidebar -->
    <div class="hidden lg:block">
      <ConsumerSidebar />
    </div>

    <!-- Mobile Sidebar Overlay -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isSidebarOpen"
        class="lg:hidden fixed inset-0 bg-black/50 z-40"
        @click="isSidebarOpen = false"
      />
    </Transition>

    <!-- Mobile Sidebar -->
    <Transition
      enter-active-class="transition-transform duration-200"
      enter-from-class="-translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition-transform duration-200"
      leave-from-class="translate-x-0"
      leave-to-class="-translate-x-full"
    >
      <div v-if="isSidebarOpen" class="lg:hidden fixed inset-y-0 left-0 z-50">
        <ConsumerSidebar />
      </div>
    </Transition>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Top Bar -->
      <header class="bg-white border-b border-gray-200 px-4 lg:px-8 h-16 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <button
            class="lg:hidden p-2 text-gray-600 hover:text-gray-900"
            @click="toggleSidebar"
            aria-label="Menu openen"
          >
            <Menu class="w-6 h-6" />
          </button>
          <h1 class="text-lg font-semibold text-gray-900">
            Dashboard
          </h1>
        </div>

        <div class="flex items-center gap-4">
          <!-- Notifications -->
          <button class="relative p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100">
            <Bell class="w-5 h-5" />
          </button>

          <!-- User Menu -->
          <div class="flex items-center gap-3">
            <Avatar :initials="authStore.userInitials" size="sm" />
            <div class="hidden sm:block">
              <p class="text-sm font-medium text-gray-900">
                {{ authStore.user?.firstName }} {{ authStore.user?.lastName }}
              </p>
              <p class="text-xs text-gray-500">
                {{ authStore.user?.email }}
              </p>
            </div>
          </div>
        </div>
      </header>

      <!-- Page Content -->
      <main id="main-content" class="flex-1 p-4 lg:p-8 overflow-auto">
        <RouterView />
      </main>
    </div>
  </div>
</template>
