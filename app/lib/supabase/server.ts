/**
 * lib/supabase/server.ts
 *
 * For Server Components, Server Actions, and Route Handlers. Creates a new
 * client per request (cookies() is request-scoped in Next.js, so this
 * must not be module-level singleton — a cached client would leak one
 * user's cookies into another's request under concurrent load).
 *
 * Server Components CANNOT write cookies (Next.js restriction) — the
 * try/catch around cookieStore.set is not error-hiding, it's the
 * documented way to let this same factory function be reused in both
 * Server Components (where setAll throws and is safely ignored, because
 * middleware already refreshed the session) and Server Actions / Route
 * Handlers (where setAll succeeds and is required).
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './database.types'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — cookies are read-only here.
            // Safe to ignore: proxy.ts already refreshed the session
            // for this request, so there's nothing this call would have
            // accomplished anyway.
          }
        },
      },
    }
  )
}

/**
 * Service-role client — bypasses RLS entirely. Per the architecture's
 * security model, this is ONLY for:
 *   - Processing invite emails (creating an auth user before signup)
 *   - Stripe webhook handlers
 *   - Scheduled jobs / cron
 *
 * NEVER use this for normal request-scoped CRUD. If a repository or
 * service function needs this client, that's a signal something is
 * structured wrong — RLS should be doing the access-control work.
 */
export function createServiceRoleClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!,
    {
      cookies: {
        getAll() {
          return []
        },
        setAll() {
          // No-op: the service-role client is never tied to a user
          // session, so there are no cookies to persist.
        },
      },
    }
  )
}
