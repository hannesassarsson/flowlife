/**
 * types/tenant.ts
 *
 * The resolved-tenant shape passed from the (portal)/[subdomain] layout
 * down through Server Components via a request-scoped cache (see
 * lib/tenant/get-current-tenant.ts). This is intentionally a flat,
 * UI-ready shape — branding fields the white-label system needs directly
 * — rather than the raw `companies` + `company_branding` join shape.
 */

export interface ResolvedTenant {
  companyId: string
  companyName: string
  slug: string
  status: 'active' | 'suspended' | 'trial'
  branding: {
    logoUrl: string | null
    faviconUrl: string | null
    primaryColor: string
    secondaryColor: string
    accentColor: string
    portalName: string
    welcomeMessage: string | null
    homepageImageUrl: string | null
    contactEmail: string | null
    contactPhone: string | null
  }
}
