import { createClient } from '@supabase/supabase-js'

// Get environment variables - Vite inlines these at build time
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Debug: log config status (not the actual values)
console.log('[Supabase] Initializing...')
console.log('[Supabase] URL configured:', !!supabaseUrl, supabaseUrl ? `(${supabaseUrl.substring(0, 30)}...)` : '')
console.log('[Supabase] Key configured:', !!supabaseAnonKey)

let supabase = null

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      },
      global: {
        headers: {
          'X-Client-Info': 'gerustthuis-web'
        }
      }
    })
    console.log('[Supabase] Client created successfully')
  } catch (error) {
    console.error('[Supabase] Failed to create client:', error)
  }
} else {
  console.error('[Supabase] MISSING CREDENTIALS - App will not work!')
  console.error('[Supabase] Check that VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in Vercel environment variables')
  console.error('[Supabase] These must be set BEFORE the build, not just at runtime')
}

export { supabase }
export default supabase
