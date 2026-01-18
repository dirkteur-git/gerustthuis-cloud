import { supabase } from './supabase'

/**
 * Sensor Storage Service
 * Handles storing and retrieving sensor readings from Supabase
 */
class SensorStorageService {
  /**
   * Save a single sensor reading
   */
  async saveReading(device, capability, value) {
    const { data, error } = await supabase
      .from('sensor_readings')
      .insert({
        device_id: device.id,
        device_name: device.name,
        capability: capability,
        value: JSON.stringify(value),
        zone_name: device.zoneName || null
      })
      .select()

    if (error) {
      console.error('Error saving reading:', error)
      throw error
    }

    return data
  }

  /**
   * Save all capabilities of a device as readings
   */
  async saveDeviceSnapshot(device) {
    const readings = []
    const capabilitiesObj = device.capabilitiesObj || {}

    for (const [capId, capData] of Object.entries(capabilitiesObj)) {
      readings.push({
        device_id: device.id,
        device_name: device.name,
        capability: capId,
        value: JSON.stringify(capData.value),
        zone_name: device.zoneName || null
      })
    }

    if (readings.length === 0) {
      return []
    }

    const { data, error } = await supabase
      .from('sensor_readings')
      .insert(readings)
      .select()

    if (error) {
      console.error('Error saving snapshot:', error)
      throw error
    }

    return data
  }

  /**
   * Get readings for a specific device
   */
  async getDeviceReadings(deviceId, options = {}) {
    const {
      limit = 100,
      capability = null,
      startDate = null,
      endDate = null
    } = options

    let query = supabase
      .from('sensor_readings')
      .select('*')
      .eq('device_id', deviceId)
      .order('recorded_at', { ascending: false })
      .limit(limit)

    if (capability) {
      query = query.eq('capability', capability)
    }

    if (startDate) {
      query = query.gte('recorded_at', startDate)
    }

    if (endDate) {
      query = query.lte('recorded_at', endDate)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching readings:', error)
      throw error
    }

    return data.map(row => ({
      ...row,
      value: JSON.parse(row.value)
    }))
  }

  /**
   * Get all readings within a time range
   */
  async getReadings(options = {}) {
    const {
      limit = null,
      startDate = null,
      endDate = null
    } = options

    let query = supabase
      .from('sensor_readings')
      .select('*')
      .order('recorded_at', { ascending: true })

    if (startDate) {
      query = query.gte('recorded_at', startDate)
    }

    if (endDate) {
      query = query.lte('recorded_at', endDate)
    }

    // Always apply a high limit to get all data (Supabase default is 1000)
    query = query.limit(limit || 50000)

    const { data, error } = await query

    if (error) {
      console.error('Error fetching readings:', error)
      throw error
    }

    return data.map(row => ({
      ...row,
      value: JSON.parse(row.value)
    }))
  }

  /**
   * Get reading statistics for a device capability
   */
  async getCapabilityStats(deviceId, capability, days = 7) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data, error } = await supabase
      .from('sensor_readings')
      .select('value, recorded_at')
      .eq('device_id', deviceId)
      .eq('capability', capability)
      .gte('recorded_at', startDate.toISOString())
      .order('recorded_at', { ascending: true })

    if (error) {
      console.error('Error fetching stats:', error)
      throw error
    }

    const values = data.map(row => ({
      value: JSON.parse(row.value),
      timestamp: new Date(row.recorded_at)
    }))

    // Calculate stats for numeric values
    const numericValues = values
      .map(v => v.value)
      .filter(v => typeof v === 'number')

    if (numericValues.length === 0) {
      return {
        count: values.length,
        data: values
      }
    }

    return {
      count: values.length,
      min: Math.min(...numericValues),
      max: Math.max(...numericValues),
      avg: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
      data: values
    }
  }

  /**
   * Get ALL readings for a date range using pagination
   * Returns raw readings, filtered for active only
   * For door sensors (alarm_contact): only count transitions (false->true), not continuous "open" state
   */
  async getAllActiveReadings(startDate, endDate) {
    const allReadings = []
    let lastTimestamp = null
    let hasMore = true
    const batchSize = 1000

    // Track previous state per device to detect transitions
    const devicePrevState = {}

    while (hasMore) {
      let query = supabase
        .from('sensor_readings')
        .select('recorded_at, value, device_id, device_name, capability')
        .gte('recorded_at', startDate)
        .lte('recorded_at', endDate)
        .order('recorded_at', { ascending: true })
        .limit(batchSize)

      if (lastTimestamp) {
        query = query.gt('recorded_at', lastTimestamp)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching readings:', error)
        throw error
      }

      if (!data || data.length === 0) {
        hasMore = false
      } else {
        for (const r of data) {
          let isActive
          try {
            isActive = JSON.parse(r.value) === true
          } catch {
            isActive = r.value === 'true' || r.value === true
          }

          const isDoorSensor = r.capability === 'alarm_contact'
          const deviceKey = `${r.device_id}_${r.capability}`
          const prevState = devicePrevState[deviceKey]

          if (isDoorSensor) {
            // For door sensors: only count when state CHANGES to true (door opens)
            if (isActive && prevState !== true) {
              allReadings.push(r)
            }
          } else {
            // For motion/vibration sensors: count all "true" events
            if (isActive) {
              allReadings.push(r)
            }
          }

          // Track state for next iteration
          devicePrevState[deviceKey] = isActive
        }

        lastTimestamp = data[data.length - 1].recorded_at
        hasMore = data.length === batchSize
      }
    }

    console.log('[SensorStorage] Total active readings:', allReadings.length)
    return allReadings
  }

  /**
   * Delete old readings (cleanup)
   */
  async deleteOldReadings(daysToKeep = 30) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    const { error } = await supabase
      .from('sensor_readings')
      .delete()
      .lt('recorded_at', cutoffDate.toISOString())

    if (error) {
      console.error('Error deleting old readings:', error)
      throw error
    }
  }
}

export const sensorStorage = new SensorStorageService()
export default sensorStorage
