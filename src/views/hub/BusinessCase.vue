<script setup>
import { ArrowLeft, TrendingUp, Users, Euro, Target } from 'lucide-vue-next'
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
          <div class="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center">
            <Briefcase class="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 class="text-3xl font-bold text-gray-900">Business Case</h1>
            <p class="text-gray-600">Financiële onderbouwing en marktanalyse</p>
          </div>
        </div>

        <!-- Placeholder Content -->
        <div class="bg-white rounded-2xl shadow-sm p-8 mb-8">
          <div class="text-center py-12">
            <div class="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <TrendingUp class="w-10 h-10 text-blue-600" />
            </div>
            <h2 class="text-xl font-bold text-gray-900 mb-4">Business Case in ontwikkeling</h2>
            <p class="text-gray-600 max-w-md mx-auto">
              Hier komt de volledige financiële onderbouwing, marktanalyse en
              groeiprojecties voor GerustThuis.
            </p>
          </div>
        </div>

        <!-- Quick Stats Placeholder -->
        <div class="grid sm:grid-cols-3 gap-6">
          <div class="bg-white rounded-xl p-6 shadow-sm">
            <Users class="w-8 h-8 text-blue-600 mb-3" />
            <div class="text-2xl font-bold text-gray-900">4.6M</div>
            <div class="text-sm text-gray-600">Mantelzorgers in NL</div>
          </div>
          <div class="bg-white rounded-xl p-6 shadow-sm">
            <Target class="w-8 h-8 text-blue-600 mb-3" />
            <div class="text-2xl font-bold text-gray-900">€2.5B</div>
            <div class="text-sm text-gray-600">Marktomvang thuiszorg tech</div>
          </div>
          <div class="bg-white rounded-xl p-6 shadow-sm">
            <Euro class="w-8 h-8 text-blue-600 mb-3" />
            <div class="text-2xl font-bold text-gray-900">€15-30</div>
            <div class="text-sm text-gray-600">Target MRR per klant</div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
