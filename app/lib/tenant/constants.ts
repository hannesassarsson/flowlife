/**
 * lib/tenant/constants.ts
 */

// The platform's own root domain — e.g. "yourapp.se". Subdomains of this
// (company.yourapp.se) resolve to a tenant portal. Phase 2 adds
// custom_domain support (portal.companyname.se) as a parallel path, not a
// replacement for this one.
export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'yourapp.se'

// Subdomains that are reserved and never resolve to a tenant, even if a
// company happens to pick a conflicting slug (enforced again at signup
// time in the company-creation service — this list is the UI/middleware
// mirror of that check).
export const RESERVED_SUBDOMAINS = new Set([
  'www', 'app', 'api', 'admin', 'dashboard', 'docs', 'status', 'mail',
  'staging', 'preview',
])
