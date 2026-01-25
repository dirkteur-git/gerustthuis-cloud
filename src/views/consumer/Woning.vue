<script setup>
import { Home, Plus, Settings, Map } from 'lucide-vue-next'
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-900">Woning</h1>
      <p class="text-gray-500">Configureer de indeling van uw woning</p>
    </div>

    <!-- Placeholder content -->
    <div class="bg-white rounded-xl border border-gray-200 p-12">
      <div class="text-center max-w-md mx-auto">
        <div class="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Home class="w-8 h-8 text-primary" />
        </div>
        <h2 class="text-xl font-semibold text-gray-900 mb-3">Woning configurator</h2>
        <p class="text-gray-500 mb-8">
          Binnenkort beschikbaar: teken uw plattegrond, plaats sensoren op de kaart
          en zie real-time activiteit per kamer.
        </p>

        <!-- Feature preview cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          <div class="bg-gray-50 rounded-lg p-4">
            <Map class="w-5 h-5 text-gray-400 mb-2" />
            <h3 class="font-medium text-gray-900 text-sm">Plattegrond</h3>
            <p class="text-xs text-gray-500 mt-1">Teken kamers en verdiepingen</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-4">
            <Plus class="w-5 h-5 text-gray-400 mb-2" />
            <h3 class="font-medium text-gray-900 text-sm">Sensoren plaatsen</h3>
            <p class="text-xs text-gray-500 mt-1">Sleep sensoren naar kamers</p>
          </div>
          <div class="bg-gray-50 rounded-lg p-4">
            <Settings class="w-5 h-5 text-gray-400 mb-2" />
            <h3 class="font-medium text-gray-900 text-sm">Kamer instellingen</h3>
            <p class="text-xs text-gray-500 mt-1">Namen en zones aanpassen</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
