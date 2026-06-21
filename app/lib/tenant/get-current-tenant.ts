/**
 * lib/tenant/get-current-tenant.ts
 *
 * Called from the (portal)/[subdomain] layout (and anywhere else under it
 * that needs branding/company context). Wrapped in React's cache() so
 * that if multiple Server Components in the same render tree call this,
 * only one DB round-trip happens per request — without this, every nested
 * layout/page that needs the tenant would re-query it independently.
 *
 * This is a thin wrapper around the repository; it exists in lib/tenant/
 * rather than lib/repositories/ because it also handles the "not found /
 * suspended" branching that's specific to how the portal layout needs to
 * react (redirect vs. 404 vs. render), which isn't a repository concern.
 */

import { cache } from 'react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { ResolvedTenant } from '@/types/tenant'

export const getCurrentTenant = cache(
  async (subdomainSlug: string): Promise<ResolvedTenant> => {
    const supabase = await createClient()

    // company_branding is the public-readable table (RLS allows anon
    // select — see migration 0010), so this works even before the
    // visitor has authenticated, which is required for the portal's
    // logo/colors to render on the login page itself.
    const { data, error } = await supabase
      .from('company_branding')
      .select(
        `
        company_id,
        logo_url,
        favicon_url,
        primary_color,
        secondary_color,
        accent_color,
        portal_name,
        welcome_message,
        homepage_image_url,
        contact_email,
        contact_phone,
        companies (
          name,
          slug,
          status
        )
      `
      )
      .eq('subdomain_slug', subdomainSlug)
      .single()

    if (error || !data || !data.companies) {
      notFound()
    }

    const company = data.companies as unknown as {
      name: string
      slug: string
      status: 'active' | 'suspended' | 'trial'
    }

    return {
      companyId: data.company_id,
      companyName: company.name,
      slug: company.slug,
      status: company.status,
      branding: {
        logoUrl: data.logo_url,
        faviconUrl: data.favicon_url,
        primaryColor: data.primary_color,
        secondaryColor: data.secondary_color,
        accentColor: data.accent_color,
        portalName: data.portal_name,
        welcomeMessage: data.welcome_message,
        homepageImageUrl: data.homepage_image_url,
        contactEmail: data.contact_email,
        contactPhone: data.contact_phone,
      },
    }
  }
)
