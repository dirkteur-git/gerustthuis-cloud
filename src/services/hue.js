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
const HUE_TOKEN_URL = 'https://api.meethue.com/v2/oauth2/token'
const HUE_API_URL = 'https://api.meethue.com/route'

// These should come from environment variables
const CLIENT_ID = import.meta.env.VITE_HUE_CLIENT_ID
const CLIENT_SECRET = import.meta.env.VITE_HUE_CLIENT_SECRET
const REDIRECT_URI = import.meta.env.VITE_HUE_REDIRECT_URI || `${window.location.origin}/app/hue/callback`

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
 */
export async function exchangeCodeForToken(code) {
  const credentials = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)

  const response = await fetch(HUE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: REDIRECT_URI
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${error}`)
  }

  return response.json()
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken) {
  const credentials = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)

  const response = await fetch(HUE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  })

  if (!response.ok) {
    throw new Error('Token refresh failed')
  }

  return response.json()
}

/**
 * Get whitelist username for the bridge
 * This links the OAuth token to the bridge
 */
export async function linkBridge(accessToken) {
  const response = await fetch(`${HUE_API_URL}/api/0/config`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      linkbutton: true
    })
  })

  // Now create the whitelist entry
  const createResponse = await fetch(`${HUE_API_URL}/api`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      devicetype: 'sensor_care_app'
    })
  })

  if (!createResponse.ok) {
    throw new Error('Failed to link bridge')
  }

  const result = await createResponse.json()

  // Result contains the username
  if (result[0]?.success?.username) {
    return result[0].success.username
  }

  throw new Error('Failed to get bridge username')
}

/**
 * Get all sensors from the bridge
 */
export async function getSensors(accessToken, username) {
  const response = await fetch(`${HUE_API_URL}/api/${username}/sensors`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  })

  if (!response.ok) {
    throw new Error('Failed to get sensors')
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
  isConfigured
}
