import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

console.log('[Supabase] URL:', supabaseUrl ? 'configured' : 'MISSING')
console.log('[Supabase] Key:', supabaseAnonKey ? 'configured' : 'MISSING')

let supabase = null

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      }
    })
    console.log('[Supabase] Client created successfully')
  } catch (error) {
    console.error('[Supabase] Failed to create client:', error)
  }
} else {
  console.error('[Supabase] MISSING CREDENTIALS - App will not work!')
  console.error('[Supabase] VITE_SUPABASE_URL:', supabaseUrl)
  console.error('[Supabase] VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '[set]' : '[not set]')
}

export { supabase }
export default supabase
