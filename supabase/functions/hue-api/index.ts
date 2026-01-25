// Supabase Edge Function: Hue API Proxy
// Handles CORS by proxying requests to Hue Remote API
// Supports both v1 (classic) and v2 (CLIP) API

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// v1 API (classic) - motion sensors, lights, groups
const HUE_API_V1_URL = 'https://api.meethue.com/route'

// v2 API (CLIP) - contact sensors, newer devices
const HUE_API_V2_URL = 'https://api.meethue.com/route/clip/v2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { endpoint, accessToken, username, apiVersion = 'v1' } = await req.json()

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: accessToken' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // v2 API endpoints (CLIP API)
    const v2Endpoints = ['device', 'light', 'scene', 'room', 'zone', 'bridge_home', 'grouped_light', 'motion', 'temperature', 'contact', 'tamper', 'light_level', 'button', 'behavior_script', 'behavior_instance', 'geofence_client', 'geolocation', 'entertainment_configuration', 'entertainment', 'homekit', 'matter', 'matter_fabric', 'resource']

    // v1 API endpoints (classic)
    const v1Endpoints = ['sensors', 'groups', 'lights', 'config', 'schedules', 'scenes', 'rules', 'resourcelinks', 'capabilities']

    let url: string
    let isV2 = apiVersion === 'v2' || v2Endpoints.includes(endpoint)

    if (isV2) {
      // v2 CLIP API - no username needed, uses /resource/{type}
      if (!v2Endpoints.includes(endpoint)) {
        return new Response(
          JSON.stringify({ error: `Invalid v2 endpoint. Allowed: ${v2Endpoints.join(', ')}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      url = `${HUE_API_V2_URL}/resource/${endpoint}`
      console.log(`[hue-api] Fetching v2 endpoint: ${endpoint}`)
    } else {
      // v1 classic API - requires username
      if (!username) {
        return new Response(
          JSON.stringify({ error: 'Missing required parameter: username (for v1 API)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      if (!v1Endpoints.includes(endpoint)) {
        return new Response(
          JSON.stringify({ error: `Invalid v1 endpoint. Allowed: ${v1Endpoints.join(', ')}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      url = `${HUE_API_V1_URL}/api/${username}/${endpoint}`
      console.log(`[hue-api] Fetching v1 endpoint: ${endpoint} for user ${username}`)
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'hue-application-key': username || '' // v2 API uses this header
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[hue-api] Hue API error: ${response.status} - ${errorText}`)
      return new Response(
        JSON.stringify({ error: `Hue API error: ${response.status}`, details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await response.json()
    console.log(`[hue-api] Successfully fetched ${endpoint}`)

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[hue-api] Error:', error)
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
