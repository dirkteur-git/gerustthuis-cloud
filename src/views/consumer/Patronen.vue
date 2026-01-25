<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/services/supabase'
import {
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Sun,
  Moon,
  Sunrise,
  Sunset,
  Eye,
  Lightbulb,
  DoorOpen,
  Home,
  Activity,
  ChevronDown,
  ChevronUp,
  Check,
  AlertCircle as Warning,
  List,
  Info,
  X,
  BarChart3,
  CalendarDays
} from 'lucide-vue-next'

// Data
const loading = ref(true)
const checkNuResult = ref(null)
const dagVectors = ref([])
const uurVerwachtingen = ref(null)
const recentEvents = ref([])
const lastUpdate = ref(null)
const showEventsLog = ref(false)
const selectedMetric = ref(null)
const showExplanation = ref(true)
const selectedRangeDay = ref(0) // 0 = vandaag, 1 = gisteren, etc.

// Vector labels - consistente labels voor modal en tabel
const vectorLabels = [
  { key: 'eerste_activiteit', label: 'Eerste activiteit', unit: 'uur', icon: Sunrise },
  { key: 'laatste_activiteit', label: 'Laatste activiteit', unit: 'uur', icon: Sunset },
  { key: 'events_ochtend', label: 'Events ochtend', unit: 'events', icon: Sunrise },
  { key: 'events_middag', label: 'Events middag', unit: 'events', icon: Sun },
  { key: 'events_avond', label: 'Events avond', unit: 'events', icon: Sunset },
  { key: 'events_nacht', label: 'Events nacht', unit: 'events', icon: Moon },
  { key: 'motion_events', label: 'Motion events', unit: 'events', icon: Eye },
  { key: 'light_events', label: 'Light events', unit: 'events', icon: Lightbulb },
  { key: 'door_events', label: 'Door events', unit: 'events', icon: DoorOpen },
  { key: 'woonkamer', label: 'Woonkamer', unit: 'events', icon: Home },
  { key: 'badkamer', label: 'Badkamer', unit: 'events', icon: Home },
  { key: 'berging', label: 'Berging', unit: 'events', icon: Home },
  { key: 'toilet', label: 'Toilet', unit: 'events', icon: Home },
  { key: 'actieve_kamers', label: 'Actieve kamers', unit: '', icon: Activity },
  { key: 'minuten_actief', label: 'Minuten actief', unit: 'min', icon: Clock }
]

// Fetch check_nu via RPC
const fetchCheckNu = async () => {
  try {
    const { data, error } = await supabase.rpc('check_nu')
    if (error) throw error
    checkNuResult.value = data
    console.log('[Patronen] check_nu:', data)
  } catch (error) {
    console.error('Error fetching check_nu:', error)
  }
}

// Fetch dag vectors
const fetchDagVectors = async () => {
  try {
    const { data, error } = await supabase
      .from('dag_vectors')
      .select('datum, vector, created_at')
      .order('datum', { ascending: false })
      .limit(14)

    if (error) throw error
    dagVectors.value = data || []
    console.log('[Patronen] dag_vectors:', data?.length)
  } catch (error) {
    console.error('Error fetching dag_vectors:', error)
  }
}

// Fetch uur verwachtingen for current hour
const fetchUurVerwachtingen = async () => {
  const currentHour = new Date().getUTCHours()
  try {
    const { data, error } = await supabase
      .from('uur_verwachtingen')
      .select('*')
      .eq('uur', currentHour)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    uurVerwachtingen.value = data
    console.log('[Patronen] uur_verwachtingen:', data)
  } catch (error) {
    console.error('Error fetching uur_verwachtingen:', error)
  }
}

// Fetch recent events
const fetchRecentEvents = async () => {
  try {
    const { data, error } = await supabase
      .from('room_events')
      .select(`
        id,
        source,
        recorded_at,
        rooms (name)
      `)
      .order('recorded_at', { ascending: false })
      .limit(50)

    if (error) throw error
    recentEvents.value = data || []
    console.log('[Patronen] recent_events:', data?.length)
  } catch (error) {
    console.error('Error fetching recent_events:', error)
  }
}

// Fetch all data
const fetchData = async () => {
  loading.value = true
  await Promise.all([
    fetchCheckNu(),
    fetchDagVectors(),
    fetchUurVerwachtingen(),
    fetchRecentEvents()
  ])
  lastUpdate.value = new Date()
  loading.value = false
}

// Computed: zorgniveau styling
const zorgniveauConfig = computed(() => {
  const niveau = checkNuResult.value?.zorgniveau || 'ok'
  const configs = {
    ok: { color: 'emerald', icon: CheckCircle, label: 'Alles normaal', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    let_op: { color: 'yellow', icon: AlertCircle, label: 'Let op', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
    zorg: { color: 'orange', icon: AlertTriangle, label: 'Aandacht nodig', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    alert: { color: 'red', icon: AlertTriangle, label: 'Alert', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }
  }
  return configs[niveau] || configs.ok
})

// Computed: current vector parsed
const currentVector = computed(() => {
  if (!checkNuResult.value?.vector) return null
  const v = checkNuResult.value.vector
  return {
    eerste_activiteit: v[0] === -1 ? null : v[0],
    laatste_activiteit: v[1] === -1 ? null : v[1],
    events_ochtend: v[2],
    events_middag: v[3],
    events_avond: v[4],
    events_nacht: v[5],
    motion_events: v[6],
    light_events: v[7],
    door_events: v[8],
    woonkamer: v[9],
    badkamer: v[10],
    berging: v[11],
    toilet: v[12],
    actieve_kamers: v[13],
    minuten_actief: v[14]
  }
})

// Format time
const formatHour = (decimal) => {
  if (decimal === null || decimal === -1) return '-'
  const hours = Math.floor(decimal)
  const minutes = Math.round((decimal - hours) * 60)
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

const formatDate = (dateStr) => {
  const date = new Date(dateStr)
  const days = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za']
  return {
    day: days[date.getDay()],
    date: date.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit' })
  }
}

// Get bar width for visualization (relative to max in dataset)
const getBarWidth = (value, maxValue) => {
  if (!value || !maxValue) return 0
  return Math.min(100, (value / maxValue) * 100)
}

// Computed: max values for each metric across all vectors
const maxValues = computed(() => {
  const maxes = {}
  for (let i = 0; i < 15; i++) {
    const key = vectorLabels[i].key
    let max = 1
    for (const dv of dagVectors.value) {
      const val = dv.vector[i]
      if (val > max && val !== -1) max = val
    }
    maxes[key] = max
  }
  return maxes
})

// Parse vector to object
const parseVector = (v) => ({
  eerste_activiteit: v[0],
  laatste_activiteit: v[1],
  events_ochtend: v[2],
  events_middag: v[3],
  events_avond: v[4],
  events_nacht: v[5],
  motion_events: v[6],
  light_events: v[7],
  door_events: v[8],
  woonkamer: v[9],
  badkamer: v[10],
  berging: v[11],
  toilet: v[12],
  actieve_kamers: v[13],
  minuten_actief: v[14]
})

// Format raw vector for display
const rawVectorString = computed(() => {
  if (!checkNuResult.value?.vector) return ''
  const v = checkNuResult.value.vector
  return '[' + v.map(n => typeof n === 'number' ? n.toFixed(2).replace(/\.?0+$/, '') : n).join(', ') + ']'
})

// Get current date formatted
const currentDateLabel = computed(() => {
  const now = new Date()
  const days = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za']
  return `${days[now.getDay()]} ${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}`
})

// Lokale tijd weergave
const lokaleUur = computed(() => {
  const now = new Date()
  return now.getHours()
})

// Dag opties voor de selector
const rangeDayOptions = computed(() => {
  const options = [{ value: 0, label: 'Vandaag' }]
  const days = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za']

  for (let i = 1; i <= 7; i++) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dayName = days[date.getDay()]
    const dateStr = date.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit' })
    options.push({
      value: i,
      label: i === 1 ? 'Gisteren' : `${dayName} ${dateStr}`
    })
  }
  return options
})

// Bepaal welke metrics zichtbaar zijn op basis van geselecteerde dag en huidig uur
const getVisibleMetrics = (metricList) => {
  // Als we niet vandaag bekijken, toon alle metrics
  if (selectedRangeDay.value !== 0) {
    return metricList
  }

  const hour = lokaleUur.value

  return metricList.filter(m => {
    // Laatste activiteit is altijd onbekend tot einde dag
    if (m.key === 'laatste_activiteit') return false

    // Events middag (10-16u) - pas tonen vanaf 17:00
    if (m.key === 'events_middag' && hour < 17) return false

    // Events avond (17-21u) - pas tonen vanaf 22:00
    if (m.key === 'events_avond' && hour < 22) return false

    // Events nacht (22-5u) - pas tonen vanaf 6:00 volgende dag (dus nooit vandaag)
    if (m.key === 'events_nacht') return false

    // Minuten actief is pas zinvol aan einde dag
    if (m.key === 'minuten_actief') return false

    return true
  })
}

// Selected day vector data (voor historische dagen)
const selectedDayVector = computed(() => {
  if (selectedRangeDay.value === 0) {
    return checkNuResult.value?.vector || null
  }

  // Zoek de juiste dag in dagVectors
  const targetDate = new Date()
  targetDate.setDate(targetDate.getDate() - selectedRangeDay.value)
  const targetDateStr = targetDate.toISOString().split('T')[0]

  const dayData = dagVectors.value.find(dv => dv.datum === targetDateStr)
  return dayData?.vector || null
})

// Computed: vector metrics with expected ranges
const vectorMetricsWithRanges = computed(() => {
  const v = selectedDayVector.value
  if (!v) return []

  // Haal historische stats op uit dag_vectors voor p5/p95
  const getHistoricalStats = (idx) => {
    const values = dagVectors.value
      .map(dv => dv.vector[idx])
      .filter(val => val !== -1 && val !== null)

    if (values.length < 3) return { p5: null, p95: null }

    values.sort((a, b) => a - b)
    const p5Idx = Math.floor(values.length * 0.05)
    const p95Idx = Math.min(values.length - 1, Math.floor(values.length * 0.95))

    return {
      p5: values[p5Idx],
      p95: values[p95Idx]
    }
  }

  // Map index to field names
  const metricMap = [
    { idx: 0, key: 'eerste_activiteit', label: 'Eerste activiteit', unit: 'uur', format: 'time' },
    { idx: 1, key: 'laatste_activiteit', label: 'Laatste activiteit', unit: 'uur', format: 'time' },
    { idx: 2, key: 'events_ochtend', label: 'Events ochtend', unit: '' },
    { idx: 3, key: 'events_middag', label: 'Events middag', unit: '' },
    { idx: 4, key: 'events_avond', label: 'Events avond', unit: '' },
    { idx: 5, key: 'events_nacht', label: 'Events nacht', unit: '' },
    { idx: 6, key: 'motion_events', label: 'Motion events', unit: '' },
    { idx: 7, key: 'light_events', label: 'Light events', unit: '' },
    { idx: 8, key: 'door_events', label: 'Door events', unit: '' },
    { idx: 9, key: 'woonkamer', label: 'Woonkamer', unit: '' },
    { idx: 10, key: 'badkamer', label: 'Badkamer', unit: '' },
    { idx: 11, key: 'berging', label: 'Berging', unit: '' },
    { idx: 12, key: 'toilet', label: 'Toilet', unit: '' },
    { idx: 13, key: 'actieve_kamers', label: 'Actieve kamers', unit: '' },
    { idx: 14, key: 'minuten_actief', label: 'Minuten actief', unit: 'min' }
  ]

  const allMetrics = metricMap.map(m => {
    const werkelijk = v[m.idx]
    const stats = getHistoricalStats(m.idx)
    const p5 = stats.p5
    const p95 = stats.p95
    const inRange = werkelijk === -1 || werkelijk === null || p5 === null || p95 === null || (werkelijk >= p5 && werkelijk <= p95)

    return {
      ...m,
      werkelijk,
      p5,
      p95,
      inRange
    }
  })

  // Filter op basis van huidige uur als we vandaag bekijken
  return getVisibleMetrics(allMetrics)
})

// Anomaly score (simulated Isolation Forest style)
const anomalyScore = computed(() => {
  if (!checkNuResult.value) return null
  const maxZ = checkNuResult.value.max_z_score || 0
  // Convert z-score to 0-1 anomaly score (higher = more anomalous)
  // Using a simple transformation: score = min(1, z/3)
  const score = Math.min(1, maxZ / 3)
  return {
    value: score,
    percentage: Math.round(score * 100),
    level: score < 0.3 ? 'normal' : score < 0.6 ? 'let_op' : 'alert'
  }
})

// Afwijkende features from check_nu
const afwijkendeFeatures = computed(() => {
  if (!checkNuResult.value?.afwijkingen) return []
  return checkNuResult.value.afwijkingen.map(a => a.meting)
})

// Format event time
const formatEventTime = (timestamp) => {
  const date = new Date(timestamp)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()

  const time = date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  if (isToday) {
    return time
  }
  return date.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit' }) + ' ' + time
}

// Dagscore computed (100 = perfect, lower is more anomalous)
const dagScore = computed(() => {
  if (!checkNuResult.value) return { score: 100, level: 'ok', label: 'Normaal' }

  const maxZ = checkNuResult.value.max_z_score || 0
  const score = Math.max(0, Math.round(100 - (maxZ * 33)))

  let level = 'ok'
  let label = 'Alles normaal'
  if (score < 70) { level = 'let_op'; label = 'Let op' }
  if (score < 40) { level = 'zorg'; label = 'Aandacht nodig' }

  return { score, level, label }
})

// Get historical data for a specific metric index (filter out -1, null, and 0)
const getMetricHistory = (metricIndex) => {
  return dagVectors.value.map(dv => ({
    datum: dv.datum,
    value: dv.vector[metricIndex]
  })).filter(d => d.value !== -1 && d.value !== null && d.value > 0)
}

// Calculate stats for metric distribution (only non-zero values)
const getMetricStats = (metricIndex) => {
  const values = getMetricHistory(metricIndex).map(d => d.value)
  if (values.length === 0) return null

  const sum = values.reduce((a, b) => a + b, 0)
  const mean = sum / values.length
  const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length
  const std = Math.sqrt(variance)
  const min = Math.min(...values)
  const max = Math.max(...values)

  return { mean, std, min, max, count: values.length, values }
}

// Generate SVG path for normal distribution curve
const getNormalDistributionPath = (mean, std, min, max, width = 300, height = 100) => {
  if (!std || std === 0) return ''

  const padding = 20
  const effectiveWidth = width - padding * 2
  const effectiveHeight = height - padding * 2

  // Generate points along the distribution
  const points = []
  const rangeMin = Math.max(min - std, mean - 4 * std)
  const rangeMax = Math.min(max + std, mean + 4 * std)
  const range = rangeMax - rangeMin

  for (let i = 0; i <= 50; i++) {
    const x = rangeMin + (i / 50) * range
    const z = (x - mean) / std
    const y = Math.exp(-0.5 * z * z) / (std * Math.sqrt(2 * Math.PI))
    points.push({ x, y })
  }

  const maxY = Math.max(...points.map(p => p.y))

  // Convert to SVG coordinates
  const svgPoints = points.map(p => {
    const svgX = padding + ((p.x - rangeMin) / range) * effectiveWidth
    const svgY = height - padding - (p.y / maxY) * effectiveHeight
    return `${svgX},${svgY}`
  })

  return `M ${svgPoints.join(' L ')}`
}

// Get x position for a value on the distribution
const getValuePosition = (value, mean, std, min, max, width = 300) => {
  const padding = 20
  const effectiveWidth = width - padding * 2
  const rangeMin = Math.max(min - std, mean - 4 * std)
  const rangeMax = Math.min(max + std, mean + 4 * std)
  const range = rangeMax - rangeMin

  return padding + ((value - rangeMin) / range) * effectiveWidth
}

// Selected metric details - uses the selected day's vector
const selectedMetricDetails = computed(() => {
  if (selectedMetric.value === null) return null

  const idx = selectedMetric.value
  const label = vectorLabels[idx]
  const stats = getMetricStats(idx)
  // Use selectedDayVector instead of always checkNuResult
  const currentDayVector = selectedDayVector.value
  const current = currentDayVector?.[idx]
  const history = getMetricHistory(idx)

  // Get the label from vectorMetricsWithRanges if available for better consistency
  const metricFromRanges = vectorMetricsWithRanges.value.find(m => m.idx === idx)

  return {
    index: idx,
    ...label,
    // Override label if we have one from metricMap
    label: metricFromRanges?.label || label?.label || `Metric ${idx}`,
    stats,
    current,
    history
  }
})

onMounted(fetchData)
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Patronen</h1>
        <p class="text-gray-500">Analyse van dagelijkse routines en activiteitspatronen</p>
      </div>
      <button
        @click="fetchData"
        class="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
      >
        <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': loading }" />
      </button>
    </div>

    <!-- Explanation Section -->
    <div v-if="showExplanation" class="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-8 relative">
      <button
        @click="showExplanation = false"
        class="absolute top-4 right-4 p-1 text-blue-400 hover:text-blue-600 rounded"
      >
        <X class="w-4 h-4" />
      </button>
      <div class="flex gap-4">
        <div class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
          <Info class="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 class="font-semibold text-blue-900 mb-2">Hoe werkt patroonherkenning?</h3>
          <p class="text-sm text-blue-800 mb-3">
            We meten dagelijks 15 activiteitswaarden en vergelijken deze met het normale patroon van de bewoner.
            Het systeem leert wat "normaal" is en detecteert afwijkingen automatisch.
          </p>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-blue-700">
            <div class="bg-blue-100 rounded p-2">
              <span class="font-medium">Timing</span>
              <p class="text-blue-600">Eerste & laatste activiteit</p>
            </div>
            <div class="bg-blue-100 rounded p-2">
              <span class="font-medium">Dagdelen</span>
              <p class="text-blue-600">Ochtend, middag, avond, nacht</p>
            </div>
            <div class="bg-blue-100 rounded p-2">
              <span class="font-medium">Activiteit</span>
              <p class="text-blue-600">Beweging, lampen, deuren</p>
            </div>
            <div class="bg-blue-100 rounded p-2">
              <span class="font-medium">Locatie</span>
              <p class="text-blue-600">Welke kamers actief</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Dagscore Card -->
    <div class="bg-white rounded-xl border border-gray-200 p-6 mb-8">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <div
            class="w-20 h-20 rounded-2xl flex items-center justify-center"
            :class="{
              'bg-emerald-100': dagScore.level === 'ok',
              'bg-yellow-100': dagScore.level === 'let_op',
              'bg-orange-100': dagScore.level === 'zorg'
            }"
          >
            <span
              class="text-3xl font-bold"
              :class="{
                'text-emerald-600': dagScore.level === 'ok',
                'text-yellow-600': dagScore.level === 'let_op',
                'text-orange-600': dagScore.level === 'zorg'
              }"
            >
              {{ dagScore.score }}
            </span>
          </div>
          <div>
            <h2 class="text-xl font-semibold text-gray-900">Dagscore</h2>
            <p class="text-gray-500">{{ dagScore.label }}</p>
            <p class="text-sm text-gray-400 mt-1">Gebaseerd op {{ lokaleUur }}:00 data</p>
          </div>
        </div>

        <!-- Score interpretation -->
        <div class="hidden md:flex items-center gap-6 text-sm">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full bg-emerald-500"></div>
            <span class="text-gray-600">70-100: Normaal</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span class="text-gray-600">40-69: Let op</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full bg-orange-500"></div>
            <span class="text-gray-600">0-39: Aandacht</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Status Card -->
    <div
      v-if="checkNuResult"
      class="rounded-xl border p-6 mb-8"
      :class="[zorgniveauConfig.bg, zorgniveauConfig.border]"
    >
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 rounded-xl flex items-center justify-center" :class="zorgniveauConfig.bg">
            <component :is="zorgniveauConfig.icon" class="w-8 h-8" :class="zorgniveauConfig.text" />
          </div>
          <div>
            <h2 class="text-xl font-semibold" :class="zorgniveauConfig.text">
              {{ zorgniveauConfig.label }}
            </h2>
            <p class="text-sm opacity-75" :class="zorgniveauConfig.text">
              {{ lokaleUur }}:00 · z-score: {{ checkNuResult.max_z_score }}
            </p>
          </div>
        </div>

        <!-- Quick Stats -->
        <div class="flex items-center gap-6 text-sm">
          <div class="text-center">
            <p class="text-2xl font-bold" :class="zorgniveauConfig.text">
              {{ currentVector?.motion_events || 0 }}
            </p>
            <p class="text-xs opacity-75" :class="zorgniveauConfig.text">bewegingen</p>
          </div>
          <div class="text-center">
            <p class="text-2xl font-bold" :class="zorgniveauConfig.text">
              {{ currentVector?.actieve_kamers || 0 }}
            </p>
            <p class="text-xs opacity-75" :class="zorgniveauConfig.text">kamers</p>
          </div>
          <div class="text-center">
            <p class="text-2xl font-bold" :class="zorgniveauConfig.text">
              {{ formatHour(currentVector?.eerste_activiteit) }}
            </p>
            <p class="text-xs opacity-75" :class="zorgniveauConfig.text">eerste activiteit</p>
          </div>
        </div>
      </div>

      <!-- Afwijkingen -->
      <div v-if="checkNuResult.afwijkingen?.length > 0" class="mt-6 pt-6 border-t" :class="zorgniveauConfig.border">
        <h3 class="text-sm font-medium mb-3" :class="zorgniveauConfig.text">Afwijkingen</h3>
        <div class="space-y-2">
          <div
            v-for="(afwijking, idx) in checkNuResult.afwijkingen"
            :key="idx"
            class="flex items-center justify-between p-3 rounded-lg bg-white/50"
          >
            <span class="font-medium text-gray-900">{{ afwijking.meting }}</span>
            <div class="text-sm text-gray-600">
              <span>{{ afwijking.waarde ?? '-' }}</span>
              <span class="mx-2 text-gray-400">→</span>
              <span>verwacht {{ afwijking.verwacht }}</span>
              <span class="ml-2 px-2 py-0.5 rounded text-xs font-medium" :class="zorgniveauConfig.bg + ' ' + zorgniveauConfig.text">
                z={{ afwijking.z_score }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TEST FASE: Raw Vector Display -->
    <div class="bg-slate-800 rounded-xl p-6 mb-8 font-mono">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-sm font-medium text-slate-400">Dag-vector {{ currentDateLabel }}</h2>
        <span class="text-xs text-slate-500">15 metingen</span>
      </div>
      <div class="text-emerald-400 text-sm break-all leading-relaxed">
        {{ rawVectorString }}
      </div>
      <div class="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
        <span>[0-1] timing</span>
        <span>[2-5] dagdelen</span>
        <span>[6-8] types</span>
        <span>[9-12] kamers</span>
        <span>[13-14] totalen</span>
      </div>
    </div>

    <!-- TEST FASE: Anomaly Score -->
    <div v-if="anomalyScore" class="bg-white rounded-xl border border-gray-200 p-6 mb-8">
      <div class="flex items-start justify-between mb-4">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">Anomaly Score</h2>
          <p class="text-sm text-gray-500">Afwijking van normaal patroon</p>
        </div>
        <div class="text-right">
          <p class="text-3xl font-bold" :class="{
            'text-emerald-600': anomalyScore.level === 'normal',
            'text-yellow-600': anomalyScore.level === 'let_op',
            'text-red-600': anomalyScore.level === 'alert'
          }">
            {{ anomalyScore.percentage }}%
          </p>
          <p class="text-xs text-gray-500">z-score: {{ checkNuResult?.max_z_score?.toFixed(2) || '0.00' }}</p>
        </div>
      </div>

      <!-- Progress bar -->
      <div class="h-3 bg-gray-100 rounded-full overflow-hidden mb-4">
        <div
          class="h-full rounded-full transition-all duration-500"
          :class="{
            'bg-emerald-500': anomalyScore.level === 'normal',
            'bg-yellow-500': anomalyScore.level === 'let_op',
            'bg-red-500': anomalyScore.level === 'alert'
          }"
          :style="{ width: anomalyScore.percentage + '%' }"
        ></div>
      </div>

      <!-- Afwijkende features -->
      <div v-if="afwijkendeFeatures.length > 0" class="pt-4 border-t border-gray-100">
        <p class="text-sm font-medium text-gray-700 mb-2">Afwijkende features:</p>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="feature in afwijkendeFeatures"
            :key="feature"
            class="px-2 py-1 bg-red-50 text-red-700 text-xs rounded-full"
          >
            {{ feature }}
          </span>
        </div>
      </div>
      <div v-else class="pt-4 border-t border-gray-100">
        <p class="text-sm text-emerald-600 flex items-center gap-2">
          <Check class="w-4 h-4" />
          Alle metingen binnen verwachte range
        </p>
      </div>
    </div>

    <!-- TEST FASE: Expected Range Comparison -->
    <div class="bg-white rounded-xl border border-gray-200 p-6 mb-8">
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-lg font-semibold text-gray-900">Verwachte Ranges</h2>
        <div class="flex items-center gap-4">
          <!-- Dag selector -->
          <div class="relative">
            <select
              v-model="selectedRangeDay"
              class="appearance-none bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-8 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option
                v-for="opt in rangeDayOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </option>
            </select>
            <CalendarDays class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <ChevronDown class="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          <div class="flex items-center gap-2 text-xs text-gray-500">
            <BarChart3 class="w-4 h-4" />
            <span>Klik voor distributie</span>
          </div>
        </div>
      </div>
      <p class="text-sm text-gray-500 mb-6">
        <template v-if="selectedRangeDay === 0">
          Werkelijke waarden vs p5-p95 range · {{ lokaleUur }}:00
          <span class="text-gray-400">(metingen die nog niet gemeten kunnen worden zijn verborgen)</span>
        </template>
        <template v-else>
          Werkelijke waarden vs p5-p95 range · {{ rangeDayOptions[selectedRangeDay]?.label }}
        </template>
      </p>

      <div v-if="vectorMetricsWithRanges.length === 0" class="text-center py-8 text-gray-500">
        <p>Geen data beschikbaar voor deze dag</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-100">
              <th class="text-left py-2 px-3 font-medium text-gray-500">Meting</th>
              <th class="text-center py-2 px-3 font-medium text-gray-500">p5</th>
              <th class="text-center py-2 px-3 font-medium text-gray-500">Werkelijk</th>
              <th class="text-center py-2 px-3 font-medium text-gray-500">p95</th>
              <th class="text-center py-2 px-3 font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="metric in vectorMetricsWithRanges"
              :key="metric.key"
              class="border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors"
              :class="{ 'bg-red-50 hover:bg-red-100': !metric.inRange }"
              @click="selectedMetric = metric.idx"
            >
              <td class="py-2 px-3 text-gray-700">{{ metric.label }}</td>
              <td class="py-2 px-3 text-center text-gray-500">
                {{ metric.format === 'time' ? formatHour(metric.p5) : (metric.p5?.toFixed(1) ?? '-') }}
              </td>
              <td class="py-2 px-3 text-center font-medium" :class="metric.inRange ? 'text-gray-900' : 'text-red-700'">
                {{ metric.format === 'time' ? formatHour(metric.werkelijk) : (metric.werkelijk?.toFixed(1) ?? '-') }}
              </td>
              <td class="py-2 px-3 text-center text-gray-500">
                {{ metric.format === 'time' ? formatHour(metric.p95) : (metric.p95?.toFixed(1) ?? '-') }}
              </td>
              <td class="py-2 px-3 text-center">
                <Check v-if="metric.inRange" class="w-5 h-5 text-emerald-500 mx-auto" />
                <Warning v-else class="w-5 h-5 text-red-500 mx-auto" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Today's Vector Detail -->
    <div class="bg-white rounded-xl border border-gray-200 p-6 mb-8">
      <h2 class="text-lg font-semibold text-gray-900 mb-6">Vandaag tot nu</h2>

      <div v-if="currentVector" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <!-- Timing -->
        <div class="p-4 bg-gray-50 rounded-lg">
          <div class="flex items-center gap-2 mb-3">
            <Clock class="w-5 h-5 text-gray-400" />
            <span class="font-medium text-gray-700">Timing</span>
          </div>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-500">Eerste activiteit</span>
              <span class="font-medium">{{ formatHour(currentVector.eerste_activiteit) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Laatste activiteit</span>
              <span class="font-medium">{{ formatHour(currentVector.laatste_activiteit) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Actieve tijd</span>
              <span class="font-medium">{{ Math.round(currentVector.minuten_actief) }} min</span>
            </div>
          </div>
        </div>

        <!-- Dagdelen -->
        <div class="p-4 bg-gray-50 rounded-lg">
          <div class="flex items-center gap-2 mb-3">
            <Sun class="w-5 h-5 text-gray-400" />
            <span class="font-medium text-gray-700">Dagdelen</span>
          </div>
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <Sunrise class="w-4 h-4 text-orange-400" />
              <span class="text-sm text-gray-500 flex-1">Ochtend</span>
              <span class="font-medium">{{ currentVector.events_ochtend }}</span>
            </div>
            <div class="flex items-center gap-2">
              <Sun class="w-4 h-4 text-yellow-400" />
              <span class="text-sm text-gray-500 flex-1">Middag</span>
              <span class="font-medium">{{ currentVector.events_middag }}</span>
            </div>
            <div class="flex items-center gap-2">
              <Sunset class="w-4 h-4 text-orange-500" />
              <span class="text-sm text-gray-500 flex-1">Avond</span>
              <span class="font-medium">{{ currentVector.events_avond }}</span>
            </div>
            <div class="flex items-center gap-2">
              <Moon class="w-4 h-4 text-indigo-400" />
              <span class="text-sm text-gray-500 flex-1">Nacht</span>
              <span class="font-medium">{{ currentVector.events_nacht }}</span>
            </div>
          </div>
        </div>

        <!-- Event Types -->
        <div class="p-4 bg-gray-50 rounded-lg">
          <div class="flex items-center gap-2 mb-3">
            <Activity class="w-5 h-5 text-gray-400" />
            <span class="font-medium text-gray-700">Event types</span>
          </div>
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <Eye class="w-4 h-4 text-blue-500" />
              <span class="text-sm text-gray-500 flex-1">Beweging</span>
              <span class="font-medium">{{ currentVector.motion_events }}</span>
            </div>
            <div class="flex items-center gap-2">
              <Lightbulb class="w-4 h-4 text-yellow-500" />
              <span class="text-sm text-gray-500 flex-1">Lampen</span>
              <span class="font-medium">{{ currentVector.light_events }}</span>
            </div>
            <div class="flex items-center gap-2">
              <DoorOpen class="w-4 h-4 text-purple-500" />
              <span class="text-sm text-gray-500 flex-1">Deuren</span>
              <span class="font-medium">{{ currentVector.door_events }}</span>
            </div>
          </div>
        </div>

        <!-- Kamers -->
        <div class="p-4 bg-gray-50 rounded-lg md:col-span-2 lg:col-span-3">
          <div class="flex items-center gap-2 mb-3">
            <Home class="w-5 h-5 text-gray-400" />
            <span class="font-medium text-gray-700">Kamers</span>
            <span class="text-sm text-gray-400 ml-auto">{{ currentVector.actieve_kamers }} actief</span>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="text-center p-3 bg-white rounded-lg">
              <p class="text-2xl font-bold text-gray-900">{{ currentVector.woonkamer }}</p>
              <p class="text-xs text-gray-500">Woonkamer</p>
            </div>
            <div class="text-center p-3 bg-white rounded-lg">
              <p class="text-2xl font-bold text-gray-900">{{ currentVector.badkamer }}</p>
              <p class="text-xs text-gray-500">Badkamer</p>
            </div>
            <div class="text-center p-3 bg-white rounded-lg">
              <p class="text-2xl font-bold text-gray-900">{{ currentVector.berging }}</p>
              <p class="text-xs text-gray-500">Berging</p>
            </div>
            <div class="text-center p-3 bg-white rounded-lg">
              <p class="text-2xl font-bold text-gray-900">{{ currentVector.toilet }}</p>
              <p class="text-xs text-gray-500">Toilet</p>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="text-center py-12 text-gray-500">
        Geen data beschikbaar
      </div>
    </div>

    <!-- TEST FASE: Ruwe Events Log -->
    <div class="bg-white rounded-xl border border-gray-200 mb-8">
      <button
        @click="showEventsLog = !showEventsLog"
        class="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
      >
        <div class="flex items-center gap-3">
          <List class="w-5 h-5 text-gray-400" />
          <div class="text-left">
            <h2 class="text-lg font-semibold text-gray-900">Ruwe Events Log</h2>
            <p class="text-sm text-gray-500">Laatste {{ recentEvents.length }} events</p>
          </div>
        </div>
        <ChevronDown v-if="!showEventsLog" class="w-5 h-5 text-gray-400" />
        <ChevronUp v-else class="w-5 h-5 text-gray-400" />
      </button>

      <div v-if="showEventsLog" class="border-t border-gray-100">
        <div class="max-h-96 overflow-y-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 sticky top-0">
              <tr>
                <th class="text-left py-2 px-4 font-medium text-gray-500">Tijd</th>
                <th class="text-left py-2 px-4 font-medium text-gray-500">Kamer</th>
                <th class="text-left py-2 px-4 font-medium text-gray-500">Type</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="event in recentEvents"
                :key="event.id"
                class="border-b border-gray-50 hover:bg-gray-50"
              >
                <td class="py-2 px-4 text-gray-600 font-mono text-xs">
                  {{ formatEventTime(event.recorded_at) }}
                </td>
                <td class="py-2 px-4 text-gray-900">
                  {{ event.rooms?.name || '-' }}
                </td>
                <td class="py-2 px-4">
                  <span
                    class="px-2 py-0.5 rounded text-xs font-medium"
                    :class="{
                      'bg-blue-100 text-blue-700': event.source === 'motion',
                      'bg-yellow-100 text-yellow-700': event.source === 'light',
                      'bg-purple-100 text-purple-700': event.source === 'door'
                    }"
                  >
                    {{ event.source }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Week Overview -->
    <div class="bg-white rounded-xl border border-gray-200 p-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-2">Week overzicht</h2>
      <p class="text-sm text-gray-500 mb-6">Activiteitsvectoren per dag</p>

      <div v-if="dagVectors.length > 0" class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-100">
              <th class="text-left py-3 px-2 font-medium text-gray-500">Dag</th>
              <th class="text-center py-3 px-2 font-medium text-gray-500">
                <Sunrise class="w-4 h-4 mx-auto text-orange-400" title="Eerste activiteit" />
              </th>
              <th class="text-center py-3 px-2 font-medium text-gray-500">
                <Sunset class="w-4 h-4 mx-auto text-orange-500" title="Laatste activiteit" />
              </th>
              <th class="text-center py-3 px-2 font-medium text-gray-500">
                <Eye class="w-4 h-4 mx-auto text-blue-500" title="Bewegingen" />
              </th>
              <th class="text-center py-3 px-2 font-medium text-gray-500">
                <Lightbulb class="w-4 h-4 mx-auto text-yellow-500" title="Lampen" />
              </th>
              <th class="text-center py-3 px-2 font-medium text-gray-500">
                <DoorOpen class="w-4 h-4 mx-auto text-purple-500" title="Deuren" />
              </th>
              <th class="text-center py-3 px-2 font-medium text-gray-500">
                <Home class="w-4 h-4 mx-auto text-gray-400" title="Kamers" />
              </th>
              <th class="text-left py-3 px-2 font-medium text-gray-500">Activiteit</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="dv in dagVectors.slice(0, 7)"
              :key="dv.datum"
              class="border-b border-gray-50 hover:bg-gray-50"
            >
              <td class="py-3 px-2">
                <div>
                  <span class="font-medium text-gray-900">{{ formatDate(dv.datum).day }}</span>
                  <span class="text-gray-400 ml-1">{{ formatDate(dv.datum).date }}</span>
                </div>
              </td>
              <td class="py-3 px-2 text-center text-gray-600">
                {{ formatHour(dv.vector[0]) }}
              </td>
              <td class="py-3 px-2 text-center text-gray-600">
                {{ formatHour(dv.vector[1]) }}
              </td>
              <td class="py-3 px-2 text-center font-medium text-blue-600">
                {{ dv.vector[6] }}
              </td>
              <td class="py-3 px-2 text-center font-medium text-yellow-600">
                {{ dv.vector[7] }}
              </td>
              <td class="py-3 px-2 text-center font-medium text-purple-600">
                {{ dv.vector[8] }}
              </td>
              <td class="py-3 px-2 text-center text-gray-600">
                {{ dv.vector[13] }}
              </td>
              <td class="py-3 px-2">
                <div class="flex items-center gap-1">
                  <div
                    class="h-2 rounded-full bg-emerald-500"
                    :style="{ width: getBarWidth(dv.vector[6] + dv.vector[7] + dv.vector[8], maxValues.motion_events + maxValues.light_events + maxValues.door_events) + '%', minWidth: '4px' }"
                  ></div>
                  <span class="text-xs text-gray-400 ml-1">
                    {{ dv.vector[6] + dv.vector[7] + dv.vector[8] }}
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="text-center py-12 text-gray-500">
        <TrendingUp class="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p>Geen historische data beschikbaar</p>
      </div>
    </div>

    <!-- Metric Detail Modal -->
    <Teleport to="body">
      <div
        v-if="selectedMetricDetails"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        @click.self="selectedMetric = null"
      >
        <div class="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden">
          <div class="p-6 border-b border-gray-100">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <component :is="selectedMetricDetails.icon" class="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 class="text-lg font-semibold text-gray-900">{{ selectedMetricDetails.label }}</h3>
                  <p class="text-sm text-gray-500">Distributie over {{ selectedMetricDetails.stats?.count || 0 }} dagen</p>
                </div>
              </div>
              <button
                @click="selectedMetric = null"
                class="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X class="w-5 h-5" />
              </button>
            </div>
          </div>

          <div class="p-6">
            <!-- Current value highlight -->
            <div class="bg-gray-50 rounded-lg p-4 mb-6">
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-500">
                  {{ selectedRangeDay === 0 ? 'Waarde vandaag' : rangeDayOptions[selectedRangeDay]?.label }}
                </span>
                <span class="text-2xl font-bold text-emerald-600">
                  {{ selectedMetricDetails.unit === 'uur'
                    ? formatHour(selectedMetricDetails.current)
                    : (selectedMetricDetails.current?.toFixed(1) ?? '-') }}
                  <span v-if="selectedMetricDetails.unit && selectedMetricDetails.unit !== 'uur'" class="text-sm text-gray-400">
                    {{ selectedMetricDetails.unit }}
                  </span>
                </span>
              </div>
            </div>

            <!-- Normal Distribution Chart -->
            <div v-if="selectedMetricDetails.stats" class="mb-6">
              <p class="text-sm font-medium text-gray-700 mb-3">Normaalverdeling</p>
              <div class="bg-gray-50 rounded-lg p-4">
                <svg width="100%" height="120" viewBox="0 0 300 120" preserveAspectRatio="xMidYMid meet">
                  <!-- Normal distribution curve -->
                  <path
                    :d="getNormalDistributionPath(
                      selectedMetricDetails.stats.mean,
                      selectedMetricDetails.stats.std,
                      selectedMetricDetails.stats.min,
                      selectedMetricDetails.stats.max
                    )"
                    fill="none"
                    stroke="#10b981"
                    stroke-width="2"
                  />

                  <!-- Fill under curve -->
                  <path
                    :d="getNormalDistributionPath(
                      selectedMetricDetails.stats.mean,
                      selectedMetricDetails.stats.std,
                      selectedMetricDetails.stats.min,
                      selectedMetricDetails.stats.max
                    ) + ' L 280,100 L 20,100 Z'"
                    fill="#10b98120"
                  />

                  <!-- Mean line -->
                  <line
                    :x1="getValuePosition(
                      selectedMetricDetails.stats.mean,
                      selectedMetricDetails.stats.mean,
                      selectedMetricDetails.stats.std,
                      selectedMetricDetails.stats.min,
                      selectedMetricDetails.stats.max
                    )"
                    y1="10"
                    :x2="getValuePosition(
                      selectedMetricDetails.stats.mean,
                      selectedMetricDetails.stats.mean,
                      selectedMetricDetails.stats.std,
                      selectedMetricDetails.stats.min,
                      selectedMetricDetails.stats.max
                    )"
                    y2="100"
                    stroke="#6b7280"
                    stroke-width="1"
                    stroke-dasharray="4"
                  />

                  <!-- Current value marker -->
                  <circle
                    v-if="selectedMetricDetails.current !== null && selectedMetricDetails.current !== -1"
                    :cx="getValuePosition(
                      selectedMetricDetails.current,
                      selectedMetricDetails.stats.mean,
                      selectedMetricDetails.stats.std,
                      selectedMetricDetails.stats.min,
                      selectedMetricDetails.stats.max
                    )"
                    cy="100"
                    r="6"
                    fill="#ef4444"
                    stroke="white"
                    stroke-width="2"
                  />

                  <!-- X-axis labels -->
                  <text x="20" y="115" class="text-xs fill-gray-400">{{ selectedMetricDetails.stats.min?.toFixed(1) }}</text>
                  <text x="150" y="115" text-anchor="middle" class="text-xs fill-gray-500">
                    {{ selectedMetricDetails.stats.mean?.toFixed(1) }} (gem)
                  </text>
                  <text x="280" y="115" text-anchor="end" class="text-xs fill-gray-400">{{ selectedMetricDetails.stats.max?.toFixed(1) }}</text>
                </svg>

                <div class="flex justify-center gap-6 mt-2 text-xs">
                  <div class="flex items-center gap-1">
                    <div class="w-3 h-0.5 bg-gray-400" style="border-style: dashed"></div>
                    <span class="text-gray-500">Gemiddelde</span>
                  </div>
                  <div class="flex items-center gap-1">
                    <div class="w-3 h-3 rounded-full bg-red-500"></div>
                    <span class="text-gray-500">Vandaag</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Stats summary -->
            <div v-if="selectedMetricDetails.stats" class="grid grid-cols-4 gap-3 text-center">
              <div class="bg-gray-50 rounded-lg p-3">
                <p class="text-xs text-gray-500">Min</p>
                <p class="font-semibold text-gray-900">{{ selectedMetricDetails.stats.min?.toFixed(1) }}</p>
              </div>
              <div class="bg-gray-50 rounded-lg p-3">
                <p class="text-xs text-gray-500">Gemiddeld</p>
                <p class="font-semibold text-gray-900">{{ selectedMetricDetails.stats.mean?.toFixed(1) }}</p>
              </div>
              <div class="bg-gray-50 rounded-lg p-3">
                <p class="text-xs text-gray-500">Std</p>
                <p class="font-semibold text-gray-900">{{ selectedMetricDetails.stats.std?.toFixed(1) }}</p>
              </div>
              <div class="bg-gray-50 rounded-lg p-3">
                <p class="text-xs text-gray-500">Max</p>
                <p class="font-semibold text-gray-900">{{ selectedMetricDetails.stats.max?.toFixed(1) }}</p>
              </div>
            </div>

            <div v-else class="text-center py-8 text-gray-500">
              <p>Onvoldoende data voor distributie</p>
            </div>
          </div>

          <div class="p-4 bg-gray-50 border-t border-gray-100">
            <button
              @click="selectedMetric = null"
              class="w-full py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Sluiten
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
