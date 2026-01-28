/**
 * Philips Hue Remote API Service
 *
 * Uses OAuth2 for remote access to Hue Bridge via meethue.com cloud
 *
 * Setup required:
 * 1. Register at https://developers.meethue.com/
 * 2. Create a "Remote Hue API" app
 * 3. Get Client ID and Client Secret
 * 4. Set callback URL to your app's /hue/callback
 */

const HUE_AUTH_URL = 'https://api.meethue.com/v2/oauth2/authorize'
const HUE_API_URL = 'https://api.meethue.com/route'

// These should come from environment variables
const CLIENT_ID = import.meta.env.VITE_HUE_CLIENT_ID
const CLIENT_SECRET = import.meta.env.VITE_HUE_CLIENT_SECRET
const REDIRECT_URI = import.meta.env.VITE_HUE_REDIRECT_URI || `${window.location.origin}/hue/callback`

// Supabase Edge Functions for OAuth token exchange (replaces local proxy)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Generate OAuth2 authorization URL
 * User will be redirected to Philips Hue login
 */
export function getAuthorizationUrl(state) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    state: state || crypto.randomUUID(),
    redirect_uri: REDIRECT_URI
  })

  return `${HUE_AUTH_URL}?${params.toString()}`
}

/**
 * Exchange authorization code for access token
 * Uses Supabase Edge Function (hue-token-exchange)
 */
export async function exchangeCodeForToken(code) {
  console.log('[Hue] Exchanging code via Supabase Edge Function')

  const response = await fetch(`${SUPABASE_URL}/functions/v1/hue-token-exchange`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({
      code: code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code'
    })
  })

  const data = await response.json()

  if (!response.ok) {
    console.error('[Hue] Token exchange error:', data)
    throw new Error(data.error || 'Token exchange failed')
  }

  console.log('[Hue] Token exchange successful')
  return data
}

/**
 * Refresh access token using refresh token
 * Uses Supabase Edge Function (hue-token-exchange)
 */
export async function refreshAccessToken(refreshToken) {
  console.log('[Hue] Refreshing token via Supabase Edge Function')

  const response = await fetch(`${SUPABASE_URL}/functions/v1/hue-token-exchange`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token'
    })
  })

  const data = await response.json()

  if (!response.ok) {
    console.error('[Hue] Token refresh error:', data)
    throw new Error(data.error || 'Token refresh failed')
  }

  console.log('[Hue] Token refresh successful')
  return data
}

/**
 * Get whitelist username for the bridge
 * Uses Supabase Edge Function (hue-link-bridge)
 */
export async function linkBridge(accessToken) {
  console.log('[Hue] Linking bridge via Supabase Edge Function')

  const response = await fetch(`${SUPABASE_URL}/functions/v1/hue-link-bridge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({ access_token: accessToken })
  })

  const data = await response.json()

  if (!response.ok) {
    console.error('[Hue] Bridge linking error:', data)
    throw new Error(data.error || 'Failed to link bridge')
  }

  console.log('[Hue] Bridge linked successfully, username:', data.username)
  return data.username
}

/**
 * Get all sensors from the bridge via Edge Function (CORS proxy)
 */
export async function getSensors(accessToken, username) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/hue-api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({
      endpoint: 'sensors',
      accessToken,
      username
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || 'Failed to get sensors')
  }

  return response.json()
}

/**
 * Get motion sensor data
 * Returns motion sensors with their current state
 */
export async function getMotionSensors(accessToken, username) {
  const sensors = await getSensors(accessToken, username)

  const motionSensors = []

  for (const [id, sensor] of Object.entries(sensors)) {
    // ZLLPresence = Hue motion sensor presence
    // ZLLLightLevel = Hue motion sensor light level
    // ZLLTemperature = Hue motion sensor temperature
    if (sensor.type === 'ZLLPresence') {
      motionSensors.push({
        id,
        name: sensor.name,
        type: 'motion',
        presence: sensor.state?.presence || false,
        lastUpdated: sensor.state?.lastupdated,
        battery: sensor.config?.battery,
        reachable: sensor.config?.reachable
      })
    }
  }

  return motionSensors
}

/**
 * Get all sensor states (motion, temperature, light)
 */
export async function getAllSensorStates(accessToken, username) {
  const sensors = await getSensors(accessToken, username)

  const sensorData = {
    motion: [],
    temperature: [],
    light: []
  }

  // Group sensors by their unique ID (motion sensors have 3 sub-sensors)
  const sensorGroups = {}

  for (const [id, sensor] of Object.entries(sensors)) {
    const uniqueId = sensor.uniqueid?.split('-')[0]

    if (!uniqueId) continue

    if (!sensorGroups[uniqueId]) {
      sensorGroups[uniqueId] = { id: uniqueId }
    }

    if (sensor.type === 'ZLLPresence') {
      sensorGroups[uniqueId].name = sensor.name.replace(' motion sensor', '').replace(' presence', '')
      sensorGroups[uniqueId].presence = sensor.state?.presence || false
      sensorGroups[uniqueId].presenceUpdated = sensor.state?.lastupdated
      sensorGroups[uniqueId].battery = sensor.config?.battery
      sensorGroups[uniqueId].reachable = sensor.config?.reachable
    }

    if (sensor.type === 'ZLLTemperature') {
      sensorGroups[uniqueId].temperature = sensor.state?.temperature / 100 // Hue reports in 0.01°C
      sensorGroups[uniqueId].temperatureUpdated = sensor.state?.lastupdated
    }

    if (sensor.type === 'ZLLLightLevel') {
      sensorGroups[uniqueId].lightLevel = sensor.state?.lightlevel
      sensorGroups[uniqueId].dark = sensor.state?.dark
      sensorGroups[uniqueId].daylight = sensor.state?.daylight
      sensorGroups[uniqueId].lightUpdated = sensor.state?.lastupdated
    }
  }

  return Object.values(sensorGroups).filter(s => s.name)
}

/**
 * Get contact sensors (door/window sensors) via v2 CLIP API
 * These sensors are only available in v2 API
 */
export async function getContactSensors(accessToken, username) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/hue-api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({
      endpoint: 'contact',
      accessToken,
      username,
      apiVersion: 'v2'
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    console.warn('[Hue] Contact sensors not available:', error.error || 'Unknown error')
    return [] // Return empty array if no contact sensors
  }

  const data = await response.json()

  // v2 API returns { data: [...] }
  const contacts = data.data || []

  return contacts.map(contact => ({
    id: contact.id,
    name: contact.metadata?.name || 'Contact Sensor',
    type: 'contact',
    contact_report: contact.contact_report?.state || 'unknown', // 'contact' or 'no_contact'
    lastUpdated: contact.contact_report?.changed,
    enabled: contact.enabled
  }))
}

/**
 * Get all devices via v2 CLIP API (includes all device types)
 */
export async function getAllDevicesV2(accessToken, username) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/hue-api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({
      endpoint: 'device',
      accessToken,
      username,
      apiVersion: 'v2'
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || 'Failed to get devices from v2 API')
  }

  const data = await response.json()
  return data.data || []
}

/**
 * Get all rooms/groups from the bridge via Edge Function
 */
export async function getRooms(accessToken, username) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/hue-api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({
      endpoint: 'groups',
      accessToken,
      username
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || 'Failed to get rooms')
  }

  const groups = await response.json()
  const rooms = []

  for (const [id, group] of Object.entries(groups)) {
    // Only include "Room" type groups (not entertainment zones, zones, etc.)
    if (group.type === 'Room') {
      rooms.push({
        id,
        name: group.name,
        class: group.class, // e.g., 'Living room', 'Bedroom', 'Kitchen'
        lights: group.lights || [],
        sensors: group.sensors || [],
        state: {
          allOn: group.state?.all_on || false,
          anyOn: group.state?.any_on || false
        }
      })
    }
  }

  return rooms
}

/**
 * Get all lights from the bridge via Edge Function
 */
export async function getLights(accessToken, username) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/hue-api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({
      endpoint: 'lights',
      accessToken,
      username
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || 'Failed to get lights')
  }

  const lights = await response.json()
  const result = []

  for (const [id, light] of Object.entries(lights)) {
    result.push({
      id,
      uniqueid: light.uniqueid,
      name: light.name,
      type: light.type,
      modelid: light.modelid,
      productname: light.productname,
      state: {
        on: light.state?.on || false,
        bri: light.state?.bri, // 0-254
        reachable: light.state?.reachable
      }
    })
  }

  return result
}

/**
 * Get switches (buttons/dimmers) from bridge
 */
export async function getSwitches(accessToken, username) {
  const sensors = await getSensors(accessToken, username)
  const switches = []

  for (const [id, sensor] of Object.entries(sensors)) {
    // ZLLSwitch = Hue Dimmer Switch, ZGPSwitch = Hue Tap
    if (sensor.type === 'ZLLSwitch' || sensor.type === 'ZGPSwitch') {
      switches.push({
        id: sensor.uniqueid?.split('-')[0] || id,
        name: sensor.name,
        type: 'switch',
        switchType: sensor.type === 'ZLLSwitch' ? 'dimmer' : 'tap',
        lastButtonEvent: sensor.state?.buttonevent,
        lastUpdated: sensor.state?.lastupdated,
        battery: sensor.config?.battery,
        reachable: sensor.config?.reachable
      })
    }
  }

  return switches
}

/**
 * Get full bridge configuration with rooms, sensors, lights, switches and contact sensors
 */
export async function getFullConfig(accessToken, username) {
  // Fetch v1 and v2 API data in parallel
  const [rooms, sensors, lights, switches, contactSensors] = await Promise.all([
    getRooms(accessToken, username),
    getAllSensorStates(accessToken, username),
    getLights(accessToken, username),
    getSwitches(accessToken, username),
    getContactSensors(accessToken, username).catch(err => {
      console.warn('[Hue] Could not fetch contact sensors:', err)
      return []
    })
  ])

  // Map sensors and lights to their rooms
  for (const room of rooms) {
    room.sensorDetails = sensors.filter(s => {
      // Match sensor to room by checking if sensor ID is in room's sensors array
      // Note: Hue sensors are split into multiple IDs (presence, temp, light)
      return room.sensors.some(roomSensorId => s.id?.includes(roomSensorId))
    })

    room.lightDetails = lights.filter(l => room.lights.includes(l.id))
  }

  // Combine motion sensors and contact sensors
  const allSensors = [
    ...sensors,
    ...contactSensors
  ]

  return {
    rooms,
    sensors: allSensors,
    lights,
    switches,
    contactSensors // Also expose separately for easy access
  }
}

/**
 * Check if Hue credentials are configured
 */
export function isConfigured() {
  return !!CLIENT_ID && !!CLIENT_SECRET
}

export default {
  getAuthorizationUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  linkBridge,
  getSensors,
  getMotionSensors,
  getAllSensorStates,
  getContactSensors,
  getSwitches,
  getAllDevicesV2,
  getRooms,
  getLights,
  getFullConfig,
  isConfigured
}
