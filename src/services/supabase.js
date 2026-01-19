import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Debug: log env vars (remove after fixing)
console.log('Supabase URL:', supabaseUrl)
console.log('Supabase Key exists:', !!supabaseAnonKey)
console.log('Supabase Key length:', supabaseAnonKey?.length)

let supabase = null

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey)
  console.log('Supabase client created successfully')
} else {
  console.warn('Supabase credentials not found in environment variables')
  console.warn('URL:', supabaseUrl)
  console.warn('Key:', supabaseAnonKey)
}

export { supabase }
export default supabase
