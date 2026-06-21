/**
 * lib/auth/get-current-actor.ts
 *
 * Resolves the authenticated Supabase user into a typed `Actor` (see
 * types/auth.ts). This is the ONE place that decides "is this person
 * staff, a tenant, or a super admin" — every Server Component, Route
 * Handler, and Server Action that needs to know who's calling goes
 * through this function rather than querying company_memberships or
 * tenant_profiles directly.
 *
 * Wrapped in cache() for the same reason as get-current-tenant: avoid
 * re-querying membership/profile data once per Server Component when ten
 * components on one page all need to know the current actor.
 *
 * Why this can't be fully resolved in middleware: middleware runs on
 * every request including static assets and would need a DB round-trip
 * per request just to determine role, adding latency platform-wide. By
 * keeping role resolution in the request/render phase (cached per
 * request) instead, we only pay that cost on routes that actually need
 * it, and we can use the full Supabase client (joins, etc.) rather than
 * the constrained Edge-runtime client middleware is limited to.
 */

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Actor } from '@/types/auth'

export const getCurrentActor = cache(async (): Promise<Actor | null> => {
  const supabase = await createClient()

  // getUser(), never getSession() — see proxy.ts header comment for
  // why getSession() is unsafe to trust for authorization decisions.
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  // Super admin check first: a super admin has no company_memberships
  // row and no tenant_profiles row, so checking this last would
  // incorrectly fall through to "no actor found."
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, full_name, email, is_super_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.is_super_admin) {
    return {
      kind: 'super_admin',
      userId: profile.id,
      email: profile.email,
      fullName: profile.full_name,
    }
  }

  if (profile) {
    // Staff actor — find their active membership. A user CAN have
    // multiple memberships (e.g. a contractor working two companies);
    // in that case the active tenant context (from the subdomain or
    // dashboard company-switcher) disambiguates which one applies. That
    // selection is threaded in via `forCompanyId` — see overload below.
    const { data: memberships } = await supabase
      .from('company_memberships')
      .select('company_id, role')
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (memberships && memberships.length > 0) {
      // Default to the first membership when no specific company context
      // is given. Routes that need a specific company (dashboard pages)
      // should call getCurrentActorForCompany() instead — see below.
      const membership = memberships[0]
      return {
        kind: 'staff',
        userId: profile.id,
        companyId: membership.company_id,
        role: membership.role,
        email: profile.email,
        fullName: profile.full_name,
      }
    }
  }

  // Not staff, not super admin — check tenant_profiles.
  const { data: tenantProfile } = await supabase
    .from('tenant_profiles')
    .select('id, company_id, full_name, email')
    .eq('id', user.id)
    .maybeSingle()

  if (tenantProfile) {
    return {
      kind: 'tenant',
      userId: tenantProfile.id,
      companyId: tenantProfile.company_id,
      email: tenantProfile.email,
      fullName: tenantProfile.full_name,
    }
  }

  return null
})

/**
 * Use when the route already knows which company context applies (e.g.
 * the dashboard for a specific company, resolved from the URL or a
 * company-switcher selection) — needed because a single user_id can have
 * multiple company_memberships rows, and getCurrentActor() alone can't
 * disambiguate which one the current page is operating in.
 */
export const getCurrentActorForCompany = cache(
  async (companyId: string): Promise<Actor | null> => {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return null

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, is_super_admin')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.is_super_admin) {
      return { kind: 'super_admin', userId: profile.id, email: profile.email, fullName: profile.full_name }
    }

    if (profile) {
      const { data: membership } = await supabase
        .from('company_memberships')
        .select('role')
        .eq('user_id', user.id)
        .eq('company_id', companyId)
        .eq('status', 'active')
        .maybeSingle()

      if (membership) {
        return {
          kind: 'staff',
          userId: profile.id,
          companyId,
          role: membership.role,
          email: profile.email,
          fullName: profile.full_name,
        }
      }
    }

    const { data: tenantProfile } = await supabase
      .from('tenant_profiles')
      .select('id, company_id, full_name, email')
      .eq('id', user.id)
      .eq('company_id', companyId)
      .maybeSingle()

    if (tenantProfile) {
      return {
        kind: 'tenant',
        userId: tenantProfile.id,
        companyId: tenantProfile.company_id,
        email: tenantProfile.email,
        fullName: tenantProfile.full_name,
      }
    }

    return null
  }
)
