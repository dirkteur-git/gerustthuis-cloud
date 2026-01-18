import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/services/supabase'

export const useDashboardStore = defineStore('dashboard', () => {
  // Real sensor data from Supabase
  const sensors = ref([])
  const sensorReadings = ref([])
  const loading = ref(false)
  const error = ref(null)
  const lastUpdate = ref(null)

  // Computed: recent activity timeline from sensor readings
  const todayTimeline = computed(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return sensorReadings.value
      .filter(r => new Date(r.recorded_at) >= today)
      .slice(0, 20)
      .map(r => ({
        time: new Date(r.recorded_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
        event: formatCapability(r.capability, r.value),
        location: r.device_name || r.device_id,
        capability: r.capability
      }))
  })

  // Format capability for display
  function formatCapability(capability, value) {
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value

      switch (capability) {
        case 'presence':
          return parsed ? 'Aanwezigheid gedetecteerd' : 'Geen aanwezigheid'
        case 'vibration':
          return parsed ? 'Trilling gedetecteerd' : 'Geen trilling'
        case 'motion':
          return parsed ? 'Beweging gedetecteerd' : 'Geen beweging'
        case 'contact':
          return parsed ? 'Geopend' : 'Gesloten'
        case 'battery':
          return `Batterij: ${parsed}%`
        case 'temperature':
          return `Temperatuur: ${parsed}°C`
        case 'occupancy':
          return parsed ? 'Bezet' : 'Vrij'
        default:
          return `${capability}: ${parsed}`
      }
    } catch {
      return `${capability}: ${value}`
    }
  }

  // Current status based on most recent activity
  const status = computed(() => {
    if (sensors.value.length === 0) {
      return {
        level: 'attention',
        message: 'Geen sensoren verbonden',
        lastActivity: null,
        lastActivityLocation: '-'
      }
    }

    const mostRecent = sensorReadings.value[0]
    if (!mostRecent) {
      return {
        level: 'attention',
        message: 'Wachten op sensor data',
        lastActivity: null,
        lastActivityLocation: '-'
      }
    }

    const timeSince = Date.now() - new Date(mostRecent.recorded_at).getTime()
    const minutesSince = Math.floor(timeSince / 60000)

    if (minutesSince > 60) {
      return {
        level: 'attention',
        message: 'Geen recente activiteit',
        lastActivity: mostRecent.recorded_at,
        lastActivityLocation: mostRecent.device_name || mostRecent.device_id
      }
    }

    return {
      level: 'normal',
      message: 'Systeem actief',
      lastActivity: mostRecent.recorded_at,
      lastActivityLocation: mostRecent.device_name || mostRecent.device_id
    }
  })

  const statusColor = computed(() => {
    switch (status.value.level) {
      case 'alert': return 'error'
      case 'attention': return 'warning'
      default: return 'success'
    }
  })

  // Fetch sensors (grouped by device)
  async function fetchSensors() {
    const { data, error: err } = await supabase
      .from('sensor_readings')
      .select('device_id, device_name, capability, value, recorded_at')
      .order('recorded_at', { ascending: false })
      .limit(500)

    if (err) {
      console.error('Error fetching sensors:', err)
      return
    }

    // Group by device
    const deviceMap = new Map()
    for (const reading of data) {
      if (!deviceMap.has(reading.device_id)) {
        deviceMap.set(reading.device_id, {
          id: reading.device_id,
          name: reading.device_name || reading.device_id,
          type: guessDeviceType(reading.capability),
          location: '-',
          status: 'online',
          battery: null,
          lastActivity: reading.recorded_at,
          capabilities: {}
        })
      }
      const device = deviceMap.get(reading.device_id)

      // Store latest value for each capability
      if (!device.capabilities[reading.capability]) {
        try {
          device.capabilities[reading.capability] = JSON.parse(reading.value)
        } catch {
          device.capabilities[reading.capability] = reading.value
        }
      }

      // Extract battery if available
      if (reading.capability === 'battery' && device.battery === null) {
        try {
          device.battery = JSON.parse(reading.value)
        } catch {
          device.battery = reading.value
        }
      }
    }

    sensors.value = Array.from(deviceMap.values())
    sensorReadings.value = data
    lastUpdate.value = new Date()
  }

  function guessDeviceType(capability) {
    if (capability === 'presence' || capability === 'occupancy') return 'presence'
    if (capability === 'motion') return 'motion'
    if (capability === 'vibration') return 'vibration'
    if (capability === 'contact') return 'door'
    if (capability === 'temperature') return 'temperature'
    return 'sensor'
  }

  // Check if device is online (had activity in last 30 minutes)
  function isOnline(lastActivity) {
    if (!lastActivity) return false
    const diff = Date.now() - new Date(lastActivity).getTime()
    return diff < 30 * 60 * 1000
  }

  // Fetch all dashboard data
  async function fetchDashboardData() {
    loading.value = true
    error.value = null

    try {
      await fetchSensors()
      return true
    } catch (err) {
      error.value = 'Data laden mislukt'
      console.error('Dashboard fetch error:', err)
      return false
    } finally {
      loading.value = false
    }
  }

  return {
    sensors,
    sensorReadings,
    todayTimeline,
    status,
    statusColor,
    loading,
    error,
    lastUpdate,
    fetchDashboardData,
    fetchSensors,
    isOnline
  }
})
