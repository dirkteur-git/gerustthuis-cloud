<script setup>
import { ArrowLeft, Database, Wifi, Monitor, Cpu, Cloud, ArrowRight, ArrowDown, Smartphone, Bell, Brain, HardDrive, MessageSquare, Shield, Zap } from 'lucide-vue-next'

const components = [
  {
    id: 'sensors',
    title: 'Aqara Sensoren',
    icon: Wifi,
    color: 'bg-green-500',
    description: 'Zigbee sensoren in huis',
    items: [
      'Bewegingssensor P1 - detecteert activiteit',
      'Deur/raam sensor - openen/sluiten',
      'Trillingssensor - apparaatgebruik'
    ]
  },
  {
    id: 'zigbee2mqtt',
    title: 'Zigbee2MQTT',
    icon: MessageSquare,
    color: 'bg-yellow-500',
    description: 'Zigbee naar MQTT bridge',
    items: [
      'Zigbee USB coordinator (Sonoff)',
      'Automatische sensor pairing',
      'MQTT berichten per event',
      'Web UI voor beheer'
    ]
  },
  {
    id: 'mosquitto',
    title: 'Mosquitto MQTT',
    icon: Zap,
    color: 'bg-cyan-500',
    description: 'Lokale message broker',
    items: [
      'Snelle event distributie',
      'Meerdere consumers mogelijk',
      'Persistent bij herstart',
      'Lokaal netwerk only'
    ]
  },
  {
    id: 'processor',
    title: 'Python Processor',
    icon: Cpu,
    color: 'bg-orange-500',
    description: 'Lokale event verwerking',
    items: [
      'MQTT events ontvangen',
      'Realtime anomalie detectie',
      'Aggregatie per uur/dag',
      'Urgente alerts lokaal triggeren'
    ]
  },
  {
    id: 'sqlite',
    title: 'SQLite (Lokaal)',
    icon: HardDrive,
    color: 'bg-gray-600',
    description: 'Ruwe data opslag op Pi',
    items: [
      'Alle sensor events bewaren',
      'Rolling window 7-14 dagen',
      'Werkt zonder internet',
      'Privacy: data blijft lokaal'
    ]
  },
  {
    id: 'cloud',
    title: 'Cloud (Alleen alerts)',
    icon: Cloud,
    color: 'bg-blue-600',
    description: 'Alleen meldingen, geen data',
    items: [
      'Push notificaties bij afwijkingen',
      'Systeem status (online/offline)',
      'Geen sensordata in cloud',
      'Gebruikers & authenticatie'
    ]
  },
  {
    id: 'webapp',
    title: 'App voor Mantelzorger',
    icon: Monitor,
    color: 'bg-indigo-600',
    description: 'Minimale interface',
    items: [
      '"Alles is in orde" status',
      'Meldingen bij afwijkingen',
      'Systeem status bekijken',
      'Geen toegang tot sensordata'
    ]
  },
  {
    id: 'alerts',
    title: 'Alert Systeem',
    icon: Bell,
    color: 'bg-red-500',
    description: 'Notificaties bij afwijkingen',
    items: [
      'Lokaal: SMS gateway / alarm',
      'Cloud: Push notificaties',
      'Email alerts',
      'Fallback bij internet-uitval'
    ]
  },
  {
    id: 'ai',
    title: 'Lokale Patroon Analyse',
    icon: Brain,
    color: 'bg-purple-600',
    description: 'Alles draait lokaal',
    items: [
      'Baseline leren op de hub',
      'Afwijkingen lokaal detecteren',
      'Alleen melding naar cloud sturen',
      'Geen data verlaat de woning'
    ]
  }
]

const localDbTables = [
  {
    name: 'sensor_events',
    description: 'Ruwe sensor data',
    columns: ['timestamp', 'device_id', 'event_type', 'value', 'battery']
  },
  {
    name: 'hourly_summary',
    description: 'Aggregatie per uur',
    columns: ['hour', 'device_id', 'event_count', 'first_event', 'last_event']
  }
]

const cloudDbTables = [
  {
    name: 'alerts',
    status: 'active',
    columns: ['id', 'household_id', 'type', 'severity', 'message', 'created_at']
  },
  {
    name: 'households',
    status: 'active',
    columns: ['id', 'name', 'timezone', 'created_at']
  },
  {
    name: 'hub_status',
    status: 'active',
    columns: ['hub_id', 'household_id', 'last_seen', 'status']
  }
]

const designPrinciples = [
  {
    icon: Shield,
    title: 'Maximale Privacy',
    description: 'Alle sensordata blijft lokaal. Er gaat GEEN data naar de cloud - alleen meldingen.'
  },
  {
    icon: Zap,
    title: 'Betrouwbaarheid',
    description: 'Hub werkt door bij internet-uitval. Lokale detectie blijft actief.'
  },
  {
    icon: Database,
    title: 'Data Eigenaarschap',
    description: 'De oudere blijft eigenaar van alle data. Familie ziet alleen of alles OK is.'
  },
  {
    icon: Bell,
    title: 'Alleen Meldingen',
    description: 'Mantelzorgers krijgen alleen melding bij afwijkingen, geen inzicht in dagelijks leven.'
  }
]
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white border-b border-gray-200">
      <div class="container max-w-6xl mx-auto px-4 py-4">
        <router-link
          to="/hub"
          class="inline-flex items-center gap-2 text-gray-600 hover:text-primary transition-colors"
        >
          <ArrowLeft class="w-4 h-4" />
          <span>Terug naar hub</span>
        </router-link>
      </div>
    </header>

    <main class="py-8">
      <div class="container max-w-6xl mx-auto px-4">
        <!-- Title -->
        <div class="mb-8">
          <h1 class="text-3xl font-bold text-gray-900 mb-2">Systeem Architectuur</h1>
          <p class="text-gray-600">Edge-first architectuur met lokale verwerking en cloud synchronisatie</p>
        </div>

        <!-- Design Principles -->
        <div class="bg-gradient-to-r from-primary/5 to-secondary/5 rounded-2xl p-6 mb-8">
          <h2 class="text-lg font-bold text-gray-900 mb-4">Design Principes</h2>
          <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              v-for="principle in designPrinciples"
              :key="principle.title"
              class="flex items-start gap-3"
            >
              <div class="w-10 h-10 bg-white rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                <component :is="principle.icon" class="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 class="font-semibold text-gray-900 text-sm">{{ principle.title }}</h3>
                <p class="text-xs text-gray-600">{{ principle.description }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Visual Architecture - Detailed -->
        <div class="bg-white rounded-2xl shadow-sm p-6 mb-8">
          <h2 class="text-xl font-bold text-gray-900 mb-6">Data Flow Architectuur</h2>

          <!-- Main Flow Diagram -->
          <div class="bg-gray-50 rounded-xl p-6 mb-6">
            <div class="flex flex-col items-center gap-2">
              <!-- Row 1: Sensors -->
              <div class="flex items-center gap-4">
                <div class="px-4 py-2 bg-green-100 rounded-lg text-green-700 font-medium text-sm">
                  Aqara Sensoren
                </div>
              </div>
              <ArrowDown class="w-5 h-5 text-gray-400" />
              <span class="text-xs text-gray-500">Zigbee</span>

              <!-- Row 2: Zigbee2MQTT -->
              <div class="px-4 py-2 bg-yellow-100 rounded-lg text-yellow-700 font-medium text-sm">
                Zigbee2MQTT
              </div>
              <ArrowDown class="w-5 h-5 text-gray-400" />
              <span class="text-xs text-gray-500">MQTT</span>

              <!-- Row 3: Mosquitto -->
              <div class="px-4 py-2 bg-cyan-100 rounded-lg text-cyan-700 font-medium text-sm">
                Mosquitto Broker
              </div>
              <ArrowDown class="w-5 h-5 text-gray-400" />

              <!-- Row 4: Python Processor - Split -->
              <div class="px-6 py-3 bg-orange-100 rounded-lg text-orange-700 font-medium text-sm border-2 border-orange-300">
                Python Processor
              </div>

              <!-- Split into two paths -->
              <div class="flex items-start gap-8 mt-2">
                <!-- Left path: Local (Primary) -->
                <div class="flex flex-col items-center gap-2">
                  <ArrowDown class="w-5 h-5 text-gray-400" />
                  <span class="text-xs text-gray-500">Alle data</span>
                  <div class="px-4 py-2 bg-gray-200 rounded-lg text-gray-700 font-medium text-sm">
                    SQLite (Lokaal)
                  </div>
                  <ArrowDown class="w-5 h-5 text-gray-400" />
                  <div class="px-4 py-2 bg-purple-100 rounded-lg text-purple-700 font-medium text-sm">
                    Patroon Analyse
                  </div>
                  <span class="text-xs text-gray-500">Data blijft hier</span>
                </div>

                <!-- Right path: Only alerts to cloud -->
                <div class="flex flex-col items-center gap-2">
                  <ArrowDown class="w-5 h-5 text-gray-400" />
                  <span class="text-xs text-gray-500 font-bold text-red-600">Alleen melding</span>
                  <div class="px-4 py-2 bg-blue-100 rounded-lg text-blue-700 font-medium text-sm">
                    Cloud (Alerts)
                  </div>
                  <ArrowDown class="w-5 h-5 text-gray-400" />
                  <div class="px-4 py-2 bg-indigo-100 rounded-lg text-indigo-700 font-medium text-sm">
                    "Alles OK" / Melding
                  </div>
                  <ArrowDown class="w-5 h-5 text-gray-400" />
                  <div class="px-4 py-2 bg-primary/10 rounded-lg text-primary font-medium text-sm">
                    Mantelzorger
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Legend -->
          <div class="flex flex-wrap gap-4 text-xs">
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 bg-orange-200 rounded border border-orange-400"></div>
              <span class="text-gray-600">Hub in woning (alle data blijft hier)</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 bg-blue-200 rounded border border-blue-400"></div>
              <span class="text-gray-600">Cloud (alleen meldingen, geen data)</span>
            </div>
          </div>
        </div>

        <!-- Components Grid -->
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div
            v-for="comp in components"
            :key="comp.id"
            class="bg-white rounded-2xl shadow-sm p-6"
          >
            <div class="flex items-start gap-4 mb-4">
              <div
                class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                :class="comp.color"
              >
                <component :is="comp.icon" class="w-6 h-6 text-white" />
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="font-bold text-gray-900">{{ comp.title }}</h3>
                  <span
                    v-if="comp.status === 'planned'"
                    class="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full"
                  >
                    Gepland
                  </span>
                </div>
                <p class="text-sm text-gray-500">{{ comp.description }}</p>
              </div>
            </div>
            <ul class="space-y-2">
              <li
                v-for="item in comp.items"
                :key="item"
                class="flex items-start gap-2 text-sm text-gray-600"
              >
                <span class="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" :class="comp.color"></span>
                {{ item }}
              </li>
            </ul>
          </div>
        </div>

        <!-- Database Schema - Split Local/Cloud -->
        <div class="grid lg:grid-cols-2 gap-6 mb-8">
          <!-- Local Database -->
          <div class="bg-white rounded-2xl shadow-sm p-6">
            <div class="flex items-center gap-3 mb-4">
              <HardDrive class="w-5 h-5 text-gray-600" />
              <h2 class="text-xl font-bold text-gray-900">Lokale Database (SQLite)</h2>
            </div>
            <p class="text-sm text-gray-500 mb-4">Op Raspberry Pi - ruwe events, 7-14 dagen retention</p>

            <div class="space-y-3">
              <div
                v-for="table in localDbTables"
                :key="table.name"
                class="border border-gray-200 rounded-xl overflow-hidden"
              >
                <div class="px-4 py-2 bg-gray-100 border-b border-gray-200">
                  <span class="font-mono font-medium text-gray-900 text-sm">{{ table.name }}</span>
                  <span class="text-xs text-gray-500 ml-2">{{ table.description }}</span>
                </div>
                <div class="p-3">
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="col in table.columns"
                      :key="col"
                      class="text-xs font-mono px-2 py-0.5 bg-gray-100 rounded text-gray-600"
                    >
                      {{ col }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Cloud Database -->
          <div class="bg-white rounded-2xl shadow-sm p-6">
            <div class="flex items-center gap-3 mb-4">
              <Cloud class="w-5 h-5 text-blue-600" />
              <h2 class="text-xl font-bold text-gray-900">Cloud Database (Supabase)</h2>
            </div>
            <p class="text-sm text-gray-500 mb-4">Geaggregeerde data, alerts, configuratie</p>

            <div class="space-y-3">
              <div
                v-for="table in cloudDbTables"
                :key="table.name"
                class="border border-gray-200 rounded-xl overflow-hidden"
              >
                <div class="px-4 py-2 bg-blue-50 border-b border-gray-200 flex items-center justify-between">
                  <span class="font-mono font-medium text-gray-900 text-sm">{{ table.name }}</span>
                  <span class="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                    Gepland
                  </span>
                </div>
                <div class="p-3">
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="col in table.columns"
                      :key="col"
                      class="text-xs font-mono px-2 py-0.5 bg-gray-100 rounded text-gray-600"
                    >
                      {{ col }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tech Stack -->
        <div class="bg-white rounded-2xl shadow-sm p-6">
          <h2 class="text-xl font-bold text-gray-900 mb-6">Tech Stack</h2>

          <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="p-4 bg-orange-50 rounded-xl border border-orange-100">
              <h3 class="font-semibold text-gray-900 mb-2">Raspberry Pi</h3>
              <ul class="text-sm text-gray-600 space-y-1">
                <li>Zigbee2MQTT</li>
                <li>Mosquitto MQTT</li>
                <li>Python 3.11+</li>
                <li>SQLite</li>
                <li>Systemd services</li>
              </ul>
            </div>
            <div class="p-4 bg-blue-50 rounded-xl border border-blue-100">
              <h3 class="font-semibold text-gray-900 mb-2">Cloud</h3>
              <ul class="text-sm text-gray-600 space-y-1">
                <li>Supabase (PostgreSQL)</li>
                <li>Supabase Auth</li>
                <li>Supabase Edge Functions</li>
                <li>Row Level Security</li>
              </ul>
            </div>
            <div class="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
              <h3 class="font-semibold text-gray-900 mb-2">Frontend</h3>
              <ul class="text-sm text-gray-600 space-y-1">
                <li>Vue 3 + Composition API</li>
                <li>Vite</li>
                <li>Tailwind CSS</li>
                <li>Vercel hosting</li>
              </ul>
            </div>
            <div class="p-4 bg-green-50 rounded-xl border border-green-100">
              <h3 class="font-semibold text-gray-900 mb-2">Hardware</h3>
              <ul class="text-sm text-gray-600 space-y-1">
                <li>Raspberry Pi 4/5</li>
                <li>Sonoff Zigbee 3.0 USB</li>
                <li>Aqara Motion Sensor P1</li>
                <li>Aqara Door/Window Sensor</li>
                <li>Aqara Vibration Sensor</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
