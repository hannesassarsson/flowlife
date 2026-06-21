/**
 * proxy.ts
 *
 * SLICE SCOPE NOTE: the approved architecture's proxy.ts also resolves a
 * tenant from the subdomain and rewrites into /portal/[subdomain]/...
 * (see ARCHITECTURE.md). That's intentionally OUT for this vertical
 * slice — per-session decision, not a redesign — because testing
 * subdomains locally needs either /etc/hosts edits or a real domain,
 * which would slow down getting something running today. Tenant pages
 * live at a plain /portal/* path instead of /portal/[subdomain]/*.
 *
 * What this file still does, unchanged from the approved design:
 *   1. Refresh the Supabase auth session on every request — required
 *      because Server Components can't write cookies themselves.
 *   2. Redirect unauthenticated visitors away from protected paths.
 *
 * CRITICAL: uses getUser(), never getSession() — see ARCHITECTURE.md
 * "Key conventions" #3 for why.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createProxyClient } from '@/lib/supabase/proxy-client'

const PROTECTED_PREFIXES = ['/dashboard', '/admin', '/portal']
const PUBLIC_AUTH_PATHS = ['/login']

export default async function proxy(request: NextRequest) {
  const url = request.nextUrl
  const { supabase, response } = createProxyClient(request)
  const { data: { user } } = await supabase.auth.getUser()

  const isProtected = PROTECTED_PREFIXES.some((p) => url.pathname.startsWith(p))
  const isPublicAuthPath = PUBLIC_AUTH_PATHS.some((p) => url.pathname.startsWith(p))

  if (isProtected && !user) {
    const loginUrl = url.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', url.pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (user && isPublicAuthPath) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
