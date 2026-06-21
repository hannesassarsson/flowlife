/**
 * lib/auth/require-role.ts
 *
 * Called from route-group layouts (app/(platform)/dashboard/layout.tsx,
 * app/(platform)/admin/layout.tsx) as the AUTHORITATIVE access check.
 * proxy.ts does a cheap first-pass check (is there a session at all,
 * does the JWT's app_metadata claim super_admin), but the real
 * role/membership check happens here, in the render phase, where we have
 * the full Supabase client and can query company_memberships.
 *
 * Why not push this entirely into middleware: middleware runs on every
 * matched request (including prefetches), so adding a membership-table
 * query there would add a DB round trip to navigation that doesn't even
 * need it yet (e.g. Next.js Link prefetching dashboard routes the user
 * never visits). Keeping the authoritative check in the layout means it
 * only runs when a route actually renders.
 */

import { redirect } from 'next/navigation'
import { getCurrentActor } from './get-current-actor'
import type { Actor, ActorKind } from '@/types/auth'

export async function requireActor(): Promise<Actor> {
  const actor = await getCurrentActor()
  if (!actor) redirect('/login')
  return actor
}

export async function requireActorKind(...allowed: ActorKind[]): Promise<Actor> {
  const actor = await requireActor()
  if (!allowed.includes(actor.kind)) {
    // BUGFIX (found wiring up the vertical slice): hardcoding
    // redirect('/dashboard') here causes an infinite redirect loop for
    // any actor kind whose home isn't /dashboard — e.g. a tenant hitting
    // requireStaff() bounces to /dashboard, which immediately calls
    // requireStaff() again and bounces them right back. Route each kind
    // to its own home instead. staff/super_admin -> /dashboard is still
    // correct for the reverse case (a tenant-only or no-actor mismatch
    // hitting a staff-only guard).
    redirect(actor.kind === 'tenant' ? '/portal/dashboard' : '/dashboard')
  }
  return actor
}

export async function requireSuperAdmin(): Promise<Actor> {
  return requireActorKind('super_admin')
}

export async function requireStaff(): Promise<Actor> {
  return requireActorKind('staff', 'super_admin')
}

export async function requireManager(): Promise<Actor> {
  const actor = await requireStaff()
  if (actor.kind === 'staff' && actor.role !== 'owner' && actor.role !== 'property_manager') {
    redirect('/dashboard')
  }
  return actor
}

/**
 * SLICE ADDITION: the approved architecture's tenant portal guard
 * (app/portal/[subdomain]/(authenticated)/layout.tsx) uses
 * getCurrentActorForCompany() because it must re-verify the actor against
 * a SPECIFIC company resolved from the subdomain — necessary there to
 * stop a stale cross-company session from rendering the wrong portal
 * shell. This slice has exactly one company and no subdomain routing, so
 * that specific cross-tenant check doesn't apply; plain getCurrentActor()
 * is sufficient and correct here. Don't copy this simplified version back
 * into the multi-tenant portal routes once those are built for real.
 */
export async function requireTenant(): Promise<Actor> {
  return requireActorKind('tenant', 'super_admin')
}
