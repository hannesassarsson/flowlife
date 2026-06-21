/**
 * lib/supabase/proxy-client.ts
 *
 * Factory used exclusively by proxy.ts (Next.js 16's replacement for
 * middleware.ts — see proxy.ts header comment). Split out from server.ts
 * because the cookie-handling contract is different and easy to get
 * wrong: proxy.ts must mutate BOTH the incoming `request` (so this same
 * request's Server Components see the refreshed token) AND a fresh
 * `response` (so the browser receives the updated cookie). Mixing this up
 * with the Server Component pattern in server.ts is the most common
 * source of "logged out randomly" bugs in @supabase/ssr setups.
 */

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from './database.types'

export function createProxyClient(request: NextRequest) {
  // IMPORTANT: this response object — not a new one created later — must
  // be the one proxy.ts eventually returns (or rewrites/redirects from).
  // Creating a second NextResponse after this point and returning that
  // instead silently drops the refreshed session cookies.
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Write to the request first, so any code later in this same
          // middleware invocation (or a Server Component rendering this
          // request) sees the refreshed cookie immediately.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Recreate the response bound to the now-updated request, then
          // write the same cookies onto it so the browser receives them.
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  return { supabase, response }
}
