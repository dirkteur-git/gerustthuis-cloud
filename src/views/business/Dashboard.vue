<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/services/supabase'
import Card from '@/components/ui/Card.vue'
import Badge from '@/components/ui/Badge.vue'
import {
  Users,
  AlertTriangle,
  CheckCircle,
  Activity,
  Eye,
  DoorOpen,
  Clock,
  ChevronRight,
  RefreshCw
} from 'lucide-vue-next'

const authStore = useAuthStore()

const linkedProfiles = ref([])
const profileActivity = ref({})
const loading = ref(true)
const lastUpdate = ref(null)

// Fetch linked consumer profiles
async function fetchLinkedProfiles() {
  loading.value = true

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('business_id', authStore.user?.id)
      .eq('role', 'consumer')

    if (error) {
      console.error('Error fetching profiles:', error)
      return
    }

    linkedProfiles.value = data || []

    // Fetch recent activity for each profile
    for (const profile of linkedProfiles.value) {
      await fetchProfileActivity(profile.id)
    }
  } catch (error) {
    console.error('Error:', error)
  } finally {
    loading.value = false
    lastUpdate.value = new Date()
  }
}

// Fetch activity for a specific profile/household
async function fetchProfileActivity(profileId) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Get motion events from today
  const { data: motionData } = await supabase
    .from('motion_events')
    .select('*')
    .eq('user_id', profileId)
    .gte('recorded_at', today.toISOString())
    .order('recorded_at', { ascending: false })
    .limit(50)

  // Get door events from today
  const { data: doorData } = await supabase
    .from('door_events')
    .select('*')
    .eq('user_id', profileId)
    .gte('recorded_at', today.toISOString())
    .order('recorded_at', { ascending: false })
    .limit(50)

  const motionCount = motionData?.filter(e => e.motion).length || 0
  const doorCount = doorData?.length || 0

  // Find last activity
  let lastActivityTime = null
  let lastActivityRoom = null

  const allEvents = [
    ...(motionData || []).filter(e => e.motion).map(e => ({ ...e, type: 'motion' })),
    ...(doorData || []).map(e => ({ ...e, type: 'door' }))
  ].sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))

  if (allEvents.length > 0) {
    lastActivityTime = allEvents[0].recorded_at
    lastActivityRoom = allEvents[0].room
  }

  profileActivity.value[profileId] = {
    motionCount,
    doorCount,
    totalCount: motionCount + doorCount,
    lastActivityTime,
    lastActivityRoom,
    recentEvents: allEvents.slice(0, 5)
  }
}

// Stats computed
const stats = computed(() => [
  {
    name: 'Gekoppelde accounts',
    value: linkedProfiles.value.length,
    icon: Users,
    color: 'primary'
  },
  {
    name: 'Actief vandaag',
    value: linkedProfiles.value.filter(p =>
      profileActivity.value[p.id]?.totalCount > 0
    ).length,
    icon: Activity,
    color: 'success'
  },
  {
    name: 'Totaal activiteiten',
    value: Object.values(profileActivity.value).reduce((sum, a) => sum + (a?.totalCount || 0), 0),
    icon: Eye,
    color: 'primary'
  },
  {
    name: 'Systemen OK',
    value: `${linkedProfiles.value.length}/${linkedProfiles.value.length}`,
    icon: CheckCircle,
    color: 'success'
  }
])

// Format functions
const formatTimeAgo = (timestamp) => {
  if (!timestamp) return 'Geen data'
  const diff = Date.now() - new Date(timestamp).getTime()
  if (diff < 60000) return 'Nu'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min geleden`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} uur geleden`
  return `${Math.floor(diff / 86400000)} dagen geleden`
}

const formatTime = (timestamp) => {
  if (!timestamp) return '-'
  return new Date(timestamp).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

// Auto refresh
let refreshInterval
onMounted(() => {
  fetchLinkedProfiles()
  refreshInterval = setInterval(fetchLinkedProfiles, 60000)
})

onUnmounted(() => {
  clearInterval(refreshInterval)
})
</script>

<template>
  <div class="space-y-8">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p class="text-gray-600">Overzicht van alle gekoppelde huishoudens</p>
      </div>
      <button
        @click="fetchLinkedProfiles"
        class="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': loading }" />
        <span v-if="lastUpdate">{{ formatTimeAgo(lastUpdate) }}</span>
      </button>
    </div>

    <!-- Stats grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card v-for="stat in stats" :key="stat.name">
        <div class="flex items-center gap-4">
          <div
            :class="[
              'w-12 h-12 rounded-lg flex items-center justify-center',
              stat.color === 'primary' ? 'bg-primary/10' : '',
              stat.color === 'warning' ? 'bg-yellow-100' : '',
              stat.color === 'success' ? 'bg-green-100' : ''
            ]"
          >
            <component
              :is="stat.icon"
              :class="[
                'w-6 h-6',
                stat.color === 'primary' ? 'text-primary' : '',
                stat.color === 'warning' ? 'text-yellow-600' : '',
                stat.color === 'success' ? 'text-green-600' : ''
              ]"
            />
          </div>
          <div>
            <p class="text-sm text-gray-600">{{ stat.name }}</p>
            <p class="text-2xl font-bold text-gray-900">{{ stat.value }}</p>
          </div>
        </div>
      </Card>
    </div>

    <!-- Linked Households -->
    <Card>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-lg font-bold text-gray-900">Gekoppelde huishoudens</h2>
        <Badge variant="primary">{{ linkedProfiles.length }} accounts</Badge>
      </div>

      <div v-if="loading" class="text-center py-8 text-gray-500">
        Laden...
      </div>

      <div v-else-if="linkedProfiles.length === 0" class="text-center py-12">
        <Users class="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p class="text-gray-500">Geen gekoppelde accounts gevonden</p>
        <p class="text-sm text-gray-400 mt-1">Consumer accounts worden hier getoond wanneer ze aan dit zakelijke account gekoppeld zijn</p>
      </div>

      <div v-else class="space-y-4">
        <div
          v-for="profile in linkedProfiles"
          :key="profile.id"
          class="border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors"
        >
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <span class="text-emerald-700 font-semibold text-lg">
                  {{ (profile.first_name?.[0] || '') + (profile.last_name?.[0] || '') }}
                </span>
              </div>
              <div>
                <h3 class="font-semibold text-gray-900">
                  {{ profile.first_name }} {{ profile.last_name }}
                </h3>
                <p class="text-sm text-gray-500">{{ profile.email }}</p>
                <p class="text-xs text-gray-400 mt-1">{{ profile.household || 'Geen huishouden' }}</p>
              </div>
            </div>

            <div class="text-right">
              <div class="flex items-center gap-1 text-sm text-gray-600">
                <Activity class="w-4 h-4" />
                <span>{{ profileActivity[profile.id]?.totalCount || 0 }} vandaag</span>
              </div>
              <div class="flex items-center gap-1 text-xs text-gray-400 mt-1">
                <Clock class="w-3 h-3" />
                <span>
                  {{ profileActivity[profile.id]?.lastActivityRoom || '-' }}
                  · {{ formatTimeAgo(profileActivity[profile.id]?.lastActivityTime) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Activity summary -->
          <div class="mt-4 pt-4 border-t border-gray-100 flex items-center gap-6">
            <div class="flex items-center gap-2 text-sm">
              <Eye class="w-4 h-4 text-blue-500" />
              <span class="text-gray-600">{{ profileActivity[profile.id]?.motionCount || 0 }} bewegingen</span>
            </div>
            <div class="flex items-center gap-2 text-sm">
              <DoorOpen class="w-4 h-4 text-purple-500" />
              <span class="text-gray-600">{{ profileActivity[profile.id]?.doorCount || 0 }} deur events</span>
            </div>
          </div>

          <!-- Recent events -->
          <div v-if="profileActivity[profile.id]?.recentEvents?.length > 0" class="mt-3">
            <div class="text-xs text-gray-400 mb-2">Recente activiteit:</div>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="(event, idx) in profileActivity[profile.id]?.recentEvents?.slice(0, 3)"
                :key="idx"
                class="inline-flex items-center px-2 py-1 rounded-full text-xs"
                :class="event.type === 'motion' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'"
              >
                {{ event.room }} · {{ formatTime(event.recorded_at) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  </div>
</template>
