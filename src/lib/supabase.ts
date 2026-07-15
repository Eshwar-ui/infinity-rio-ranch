import { createClient } from '@supabase/supabase-js'

/**
 * Single shared Supabase client for the whole app.
 *
 * The public site uses the publishable (anon) key — safe to ship to the browser
 * because Row-Level Security decides what that key is allowed to do (public form
 * can INSERT a lead; only signed-in admins can read them).
 */
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Fail loud in dev; a missing key silently breaks every write otherwise.
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
}

export const supabase = createClient(url, anonKey)
