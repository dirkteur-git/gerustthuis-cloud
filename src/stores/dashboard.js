import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/services/supabase'

export const useDashboardStore = defineStore('dashboard', () => {
  // Real sensor data from Supabase
  const sensors = ref([])
  const sensorReadings = ref([])
  const motionEvents = ref([])
  const loading = ref(false)
  const error = ref(null)
  const lastUpdate = ref(null)

  // Computed: recent activity timeline from motion events and sensor readings
  const todayTimeline = computed(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Combine motion events and temperature readings
    const events = []

    // Add motion events
    for (const m of motionEvents.value) {
      if (new Date(m.recorded_at) >= today && m.motion) {
        events.push({
          time: new Date(m.recorded_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
          timestamp: new Date(m.recorded_at),
          event: 'Beweging gedetecteerd',
          location: m.room,
          capability: 'motion'
        })
      }
    }

    // Add temperature readings (only significant changes)
    const tempByRoom = new Map()
    for (const r of sensorReadings.value) {
      if (new Date(r.recorded_at) >= today && r.sensor_type === 'temperature') {
        const key = r.room
        if (!tempByRoom.has(key)) {
          tempByRoom.set(key, [])
        }
        tempByRoom.get(key).push(r)
      }
    }

    // Add latest temp reading per room
    for (const [room, readings] of tempByRoom) {
      if (readings.length > 0) {
        const latest = readings[0]
        events.push({
          time: new Date(latest.recorded_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
          timestamp: new Date(latest.recorded_at),
          event: `Temperatuur: ${latest.value.toFixed(1)}°C`,
          location: room,
          capability: 'temperature'
        })
      }
    }

    // Sort by time descending and limit
    return events
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20)
  })

  // Current status based on most recent activity
  const status = computed(() => {
    // Get unique rooms from motion events
    const roomsWithMotion = new Set(motionEvents.value.map(m => m.room))
    const roomsWithTemp = new Set(sensorReadings.value.map(r => r.room))
    const allRooms = new Set([...roomsWithMotion, ...roomsWithTemp])

    if (allRooms.size === 0) {
      return {
        level: 'attention',
        message: 'Geen sensoren verbonden',
        lastActivity: null,
        lastActivityLocation: '-'
      }
    }

    // Find most recent motion
    const recentMotion = motionEvents.value.find(m => m.motion)
    if (!recentMotion) {
      return {
        level: 'attention',
        message: 'Wachten op beweging',
        lastActivity: null,
        lastActivityLocation: '-'
      }
    }

    const timeSince = Date.now() - new Date(recentMotion.recorded_at).getTime()
    const minutesSince = Math.floor(timeSince / 60000)

    if (minutesSince > 60) {
      return {
        level: 'attention',
        message: 'Geen recente activiteit',
        lastActivity: recentMotion.recorded_at,
        lastActivityLocation: recentMotion.room
      }
    }

    return {
      level: 'normal',
      message: 'Systeem actief',
      lastActivity: recentMotion.recorded_at,
      lastActivityLocation: recentMotion.room
    }
  })

  const statusColor = computed(() => {
    switch (status.value.level) {
      case 'alert': return 'error'
      case 'attention': return 'warning'
      default: return 'success'
    }
  })

  // Fetch all data
  async function fetchDashboardData() {
    loading.value = true
    error.value = null

    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      const [readingsRes, motionRes] = await Promise.all([
        supabase
          .from('sensor_readings')
          .select('*')
          .gte('recorded_at', yesterday)
          .order('recorded_at', { ascending: false })
          .limit(500),
        supabase
          .from('motion_events')
          .select('*')
          .gte('recorded_at', yesterday)
          .order('recorded_at', { ascending: false })
          .limit(500)
      ])

      if (readingsRes.error) {
        console.error('Error fetching readings:', readingsRes.error)
      } else {
        sensorReadings.value = readingsRes.data || []
      }

      if (motionRes.error) {
        console.error('Error fetching motion:', motionRes.error)
      } else {
        motionEvents.value = motionRes.data || []
      }

      // Build sensors list from rooms
      const roomMap = new Map()

      for (const r of sensorReadings.value) {
        if (!roomMap.has(r.room)) {
          roomMap.set(r.room, {
            id: r.room,
            name: r.room,
            type: r.sensor_type,
            lastActivity: r.recorded_at,
            temperature: null
          })
        }
        const room = roomMap.get(r.room)
        if (r.sensor_type === 'temperature' && room.temperature === null) {
          room.temperature = r.value
        }
      }

      for (const m of motionEvents.value) {
        if (!roomMap.has(m.room)) {
          roomMap.set(m.room, {
            id: m.room,
            name: m.room,
            type: 'motion',
            lastActivity: m.recorded_at,
            temperature: null
          })
        }
        const room = roomMap.get(m.room)
        if (m.motion && (!room.lastActivity || new Date(m.recorded_at) > new Date(room.lastActivity))) {
          room.lastActivity = m.recorded_at
        }
      }

      sensors.value = Array.from(roomMap.values())
      lastUpdate.value = new Date()

      return true
    } catch (err) {
      error.value = 'Data laden mislukt'
      console.error('Dashboard fetch error:', err)
      return false
    } finally {
      loading.value = false
    }
  }

  // Check if sensor is online (had activity in last 30 minutes)
  function isOnline(lastActivity) {
    if (!lastActivity) return false
    const diff = Date.now() - new Date(lastActivity).getTime()
    return diff < 30 * 60 * 1000
  }

  return {
    sensors,
    sensorReadings,
    motionEvents,
    todayTimeline,
    status,
    statusColor,
    loading,
    error,
    lastUpdate,
    fetchDashboardData,
    isOnline
  }
})
