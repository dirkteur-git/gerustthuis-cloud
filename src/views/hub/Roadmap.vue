<script setup>
import { ArrowLeft, Map, CheckCircle, Circle, Clock } from 'lucide-vue-next'

const phases = [
  {
    title: 'Fase 1: Validatie',
    status: 'current',
    period: 'Q1 2026',
    items: [
      { text: 'Landing page live', done: true },
      { text: 'Wachtlijst verzamelen', done: true },
      { text: 'Meta ads campagne', done: false },
      { text: '100+ aanmeldingen', done: false }
    ]
  },
  {
    title: 'Fase 2: MVP Development',
    status: 'upcoming',
    period: 'Q2 2026',
    items: [
      { text: 'Hardware selectie & inkoop', done: false },
      { text: 'Backend infrastructuur', done: false },
      { text: 'Dashboard v1', done: false },
      { text: 'Beta test met 10 families', done: false }
    ]
  },
  {
    title: 'Fase 3: Launch',
    status: 'future',
    period: 'Q3 2026',
    items: [
      { text: 'Webshop live', done: false },
      { text: 'Eerste 50 klanten', done: false },
      { text: 'Feedback & iteratie', done: false },
      { text: 'Support systeem', done: false }
    ]
  },
  {
    title: 'Fase 4: Groei',
    status: 'future',
    period: 'Q4 2026',
    items: [
      { text: 'Marketing opschalen', done: false },
      { text: 'Partnerships thuiszorg', done: false },
      { text: '500+ actieve gebruikers', done: false },
      { text: 'Break-even', done: false }
    ]
  }
]
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white border-b border-gray-200">
      <div class="container max-w-5xl mx-auto px-4 py-4">
        <router-link
          to="/hub"
          class="inline-flex items-center gap-2 text-gray-600 hover:text-primary transition-colors"
        >
          <ArrowLeft class="w-4 h-4" />
          <span>Terug naar hub</span>
        </router-link>
      </div>
    </header>

    <!-- Content -->
    <main class="py-12">
      <div class="container max-w-4xl mx-auto px-4">
        <div class="flex items-center gap-4 mb-8">
          <div class="w-14 h-14 bg-purple-600 rounded-xl flex items-center justify-center">
            <Map class="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 class="text-3xl font-bold text-gray-900">Roadmap</h1>
            <p class="text-gray-600">Productontwikkeling en mijlpalen</p>
          </div>
        </div>

        <!-- Timeline -->
        <div class="space-y-6">
          <div
            v-for="phase in phases"
            :key="phase.title"
            class="bg-white rounded-2xl shadow-sm overflow-hidden"
            :class="{
              'ring-2 ring-purple-500': phase.status === 'current'
            }"
          >
            <div
              class="px-6 py-4 flex items-center justify-between"
              :class="{
                'bg-purple-600 text-white': phase.status === 'current',
                'bg-gray-100 text-gray-900': phase.status !== 'current'
              }"
            >
              <div class="flex items-center gap-3">
                <Clock
                  v-if="phase.status === 'current'"
                  class="w-5 h-5"
                />
                <Circle
                  v-else
                  class="w-5 h-5 opacity-50"
                />
                <h2 class="font-bold">{{ phase.title }}</h2>
              </div>
              <span
                class="text-sm px-3 py-1 rounded-full"
                :class="{
                  'bg-white/20': phase.status === 'current',
                  'bg-gray-200': phase.status !== 'current'
                }"
              >
                {{ phase.period }}
              </span>
            </div>
            <div class="p-6">
              <ul class="space-y-3">
                <li
                  v-for="item in phase.items"
                  :key="item.text"
                  class="flex items-center gap-3"
                >
                  <CheckCircle
                    v-if="item.done"
                    class="w-5 h-5 text-green-500 flex-shrink-0"
                  />
                  <Circle
                    v-else
                    class="w-5 h-5 text-gray-300 flex-shrink-0"
                  />
                  <span
                    :class="{
                      'text-gray-900': item.done,
                      'text-gray-600': !item.done
                    }"
                  >
                    {{ item.text }}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
