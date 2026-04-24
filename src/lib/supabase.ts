import { createClient, type SupabaseClient } from '@supabase/supabase-js'

console.log('=== SUPABASE DEBUG ===')
console.log('URL:', import.meta.env.VITE_SUPABASE_URL)
console.log('KEY exists:', !!import.meta.env.VITE_SUPABASE_ANON_KEY)
console.log('KEY prefix:', import.meta.env.VITE_SUPABASE_ANON_KEY?.slice(0, 20))

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

export function isSupabaseConfigured(): boolean {
  return supabase !== null
}
