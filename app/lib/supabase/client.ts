/**
 * lib/supabase/client.ts
 *
 * For Client Components only ('use client'). Never import this into a
 * Server Component, Route Handler, or Server Action — use server.ts there.
 */

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // Publishable key (sb_publishable_...) per current Supabase key
    // naming. If your project still issues legacy keys, this falls back
    // to NEXT_PUBLIC_SUPABASE_ANON_KEY — both names are accepted so
    // existing .env files keep working through the migration window.
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!
  )
}
