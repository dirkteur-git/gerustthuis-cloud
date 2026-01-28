/**
 * Measurement Service
 *
 * Slaat ALLE sensor en lamp data op in de measurements tabel.
 * Dit is de RAW data bron voor alle aggregaties en analyses.
 */

import { supabase } from './supabase'

/**
 * Sla alle sensor metingen op
 * @param {Object} sensor - Sensor data van Hue API
 * @param {UUID} itemId - Database item ID
 */
export async function saveSensorMeasurements(sensor, itemId) {
  const measurements = []
  const recordedAt = sensor.presenceUpdated || sensor.lastUpdated || new Date().toISOString()

  // Presence (beweging)
  if (sensor.presence !== undefined) {
    measurements.push({
      item_id: itemId,
      capability: 'presence',
      value: sensor.presence,
      recorded_at: sensor.presenceUpdated || recordedAt
    })
  }

  // Temperature
  if (sensor.temperature !== undefined) {
    measurements.push({
      item_id: itemId,
      capability: 'temperature',
      value: sensor.temperature,
      recorded_at: sensor.temperatureUpdated || recordedAt
    })
  }

  // Light level
  if (sensor.lightLevel !== undefined) {
    measurements.push({
      item_id: itemId,
      capability: 'lightlevel',
      value: sensor.lightLevel,
      recorded_at: sensor.lightUpdated || recordedAt
    })
  }

  // Dark/daylight
  if (sensor.dark !== undefined) {
    measurements.push({
      item_id: itemId,
      capability: 'dark',
      value: sensor.dark,
      recorded_at: sensor.lightUpdated || recordedAt
    })
  }

  if (sensor.daylight !== undefined) {
    measurements.push({
      item_id: itemId,
      capability: 'daylight',
      value: sensor.daylight,
      recorded_at: sensor.lightUpdated || recordedAt
    })
  }

  // Battery
  if (sensor.battery !== undefined) {
    measurements.push({
      item_id: itemId,
      capability: 'battery',
      value: sensor.battery,
      recorded_at: recordedAt
    })
  }

  // Reachable
  if (sensor.reachable !== undefined) {
    measurements.push({
      item_id: itemId,
      capability: 'reachable',
      value: sensor.reachable,
      recorded_at: recordedAt
    })
  }

  // Contact sensor (deur/raam)
  if (sensor.contact_report !== undefined) {
    measurements.push({
      item_id: itemId,
      capability: 'contact',
      value: sensor.contact_report === 'contact', // true = dicht, false = open
      recorded_at: sensor.lastUpdated || recordedAt
    })
  }

  // Insert alle metingen
  if (measurements.length > 0) {
    console.log('[MeasurementService] Saving sensor measurements:', { itemId, count: measurements.length, capabilities: measurements.map(m => m.capability) })

    const { error } = await supabase
      .from('measurements')
      .insert(measurements)

    if (error) {
      console.error('[MeasurementService] Error saving sensor measurements:', error)
      console.error('[MeasurementService] Measurements that failed:', measurements)
      return 0
    }
    console.log('[MeasurementService] Successfully saved', measurements.length, 'measurements')
    return measurements.length
  }

  console.log('[MeasurementService] No measurements to save for sensor', { sensor })
  return 0
}

/**
 * Sla alle lamp metingen op
 * @param {Object} light - Light data van Hue API
 * @param {UUID} itemId - Database item ID
 */
export async function saveLightMeasurements(light, itemId) {
  const measurements = []
  const recordedAt = new Date().toISOString()

  // On/off state
  if (light.state?.on !== undefined) {
    measurements.push({
      item_id: itemId,
      capability: 'on',
      value: light.state.on,
      recorded_at: recordedAt
    })
  }

  // Brightness (0-254)
  if (light.state?.bri !== undefined) {
    measurements.push({
      item_id: itemId,
      capability: 'brightness',
      value: light.state.bri,
      recorded_at: recordedAt
    })
  }

  // Color temperature
  if (light.state?.ct !== undefined) {
    measurements.push({
      item_id: itemId,
      capability: 'color_temp',
      value: light.state.ct,
      recorded_at: recordedAt
    })
  }

  // Hue (color)
  if (light.state?.hue !== undefined) {
    measurements.push({
      item_id: itemId,
      capability: 'hue',
      value: light.state.hue,
      recorded_at: recordedAt
    })
  }

  // Saturation
  if (light.state?.sat !== undefined) {
    measurements.push({
      item_id: itemId,
      capability: 'saturation',
      value: light.state.sat,
      recorded_at: recordedAt
    })
  }

  // Reachable
  if (light.state?.reachable !== undefined) {
    measurements.push({
      item_id: itemId,
      capability: 'reachable',
      value: light.state.reachable,
      recorded_at: recordedAt
    })
  }

  // Insert alle metingen
  if (measurements.length > 0) {
    const { error } = await supabase
      .from('measurements')
      .insert(measurements)

    if (error) {
      console.error('[MeasurementService] Error saving light measurements:', error)
      return 0
    }
    return measurements.length
  }

  return 0
}

/**
 * Sla een batch van metingen op (efficiënter voor grote hoeveelheden)
 * @param {Array} measurements - Array van measurement objects
 */
export async function saveMeasurementsBatch(measurements) {
  if (!measurements || measurements.length === 0) return 0

  const { error } = await supabase
    .from('measurements')
    .insert(measurements)

  if (error) {
    console.error('[MeasurementService] Error saving batch:', error)
    return 0
  }

  return measurements.length
}

/**
 * Haal laatste meting op voor een item en capability
 */
export async function getLatestMeasurement(itemId, capability) {
  const { data, error } = await supabase
    .from('measurements')
    .select('*')
    .eq('item_id', itemId)
    .eq('capability', capability)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .single()

  if (error) return null
  return data
}

/**
 * Haal metingen op voor een item in een tijdrange
 */
export async function getMeasurements(itemId, options = {}) {
  const { capability, startDate, endDate, limit = 1000 } = options

  let query = supabase
    .from('measurements')
    .select('*')
    .eq('item_id', itemId)
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
    console.error('[MeasurementService] Error getting measurements:', error)
    return []
  }

  return data
}

/**
 * Tel metingen per capability voor een item (voor stats)
 */
export async function countMeasurements(itemId, options = {}) {
  const { startDate, endDate } = options

  let query = supabase
    .from('measurements')
    .select('capability', { count: 'exact', head: true })
    .eq('item_id', itemId)

  if (startDate) {
    query = query.gte('recorded_at', startDate)
  }

  if (endDate) {
    query = query.lte('recorded_at', endDate)
  }

  const { count, error } = await query

  if (error) {
    console.error('[MeasurementService] Error counting:', error)
    return 0
  }

  return count
}

export default {
  saveSensorMeasurements,
  saveLightMeasurements,
  saveMeasurementsBatch,
  getLatestMeasurement,
  getMeasurements,
  countMeasurements
}
