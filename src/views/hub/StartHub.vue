<script setup>
import { Radio, LayoutGrid, CalendarDays, Boxes, Map, Briefcase, ArrowRight, Database } from 'lucide-vue-next'

const tiles = [
  {
    title: 'Sensoren',
    description: 'Live sensor data en status',
    icon: Radio,
    route: '/dashboard/sensoren',
    color: 'bg-emerald-100',
    iconColor: 'text-emerald-600'
  },
  {
    title: 'Plattegrond',
    description: 'Sensor locaties visualisatie',
    icon: LayoutGrid,
    route: '/hub/plattegrond',
    color: 'bg-blue-100',
    iconColor: 'text-blue-600'
  },
  {
    title: 'Weekoverzicht',
    description: 'Activiteitspatronen analyse',
    icon: CalendarDays,
    route: '/hub/weekoverzicht',
    color: 'bg-violet-100',
    iconColor: 'text-violet-600'
  },
  {
    title: 'Architectuur',
    description: 'Systeem componenten',
    icon: Boxes,
    route: '/hub/architectuur',
    color: 'bg-rose-100',
    iconColor: 'text-rose-600'
  },
  {
    title: 'Roadmap',
    description: 'Ontwikkeling & planning',
    icon: Map,
    route: '/hub/roadmap',
    color: 'bg-amber-100',
    iconColor: 'text-amber-600'
  },
  {
    title: 'Business Case',
    description: 'Financiele analyse',
    icon: Briefcase,
    route: '/hub/business-case',
    color: 'bg-cyan-100',
    iconColor: 'text-cyan-600'
  },
  {
    title: 'Ruwe Data',
    description: 'Alle sensor data bekijken',
    icon: Database,
    route: '/hub/sensor-data',
    color: 'bg-gray-100',
    iconColor: 'text-gray-600'
  }
]
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="pt-16 pb-12">
      <div class="max-w-4xl mx-auto px-6 text-center">
        <div class="inline-flex items-center gap-3 mb-6">
          <div class="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
            <span class="text-white text-lg font-bold">G</span>
          </div>
          <span class="text-xl font-semibold text-gray-900">GerustThuis</span>
        </div>
        <h1 class="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
          Hub
        </h1>
        <p class="text-gray-500 text-lg max-w-md mx-auto">
          Smart home monitoring voor ouderenzorg
        </p>
      </div>
    </header>

    <!-- Tiles Grid -->
    <main class="pb-20">
      <div class="max-w-4xl mx-auto px-6">
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <router-link
            v-for="tile in tiles"
            :key="tile.title"
            :to="tile.route"
            class="group relative"
          >
            <div
              class="relative overflow-hidden rounded-xl bg-white border border-gray-200 p-6 transition-all duration-300 hover:border-gray-300 hover:shadow-md"
            >
              <div class="flex flex-col h-full">
                <div
                  class="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                  :class="tile.color"
                >
                  <component :is="tile.icon" class="w-5 h-5" :class="tile.iconColor" />
                </div>

                <h2 class="text-lg font-semibold text-gray-900 mb-1">
                  {{ tile.title }}
                </h2>
                <p class="text-sm text-gray-500 flex-grow">
                  {{ tile.description }}
                </p>

                <div class="flex items-center gap-1 mt-4 text-sm text-gray-400 group-hover:text-gray-600 transition-colors">
                  <span>Open</span>
                  <ArrowRight class="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </router-link>
        </div>

        <!-- Status -->
        <div class="mt-12 flex justify-center">
          <div class="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white border border-gray-200 shadow-sm">
            <span class="relative flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span class="text-sm text-gray-600">Hub actief</span>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
