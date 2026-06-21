/**
 * lib/tenant/resolve-tenant.ts
 *
 * Pure function: hostname -> tenant slug | null. No I/O, no DB — this runs
 * in middleware on every request, so it has to be cheap and synchronous.
 * The actual tenant record (does this slug exist? is it suspended?) is
 * looked up later, in the (portal)/[subdomain] layout — see
 * lib/tenant/get-current-tenant.ts.
 *
 * Handles three environments, matching the pattern Vercel's own
 * Platforms Starter Kit uses for subdomain-based multi-tenancy:
 *   - Local dev:        company.localhost:3000
 *   - Vercel preview:   company---branch-name.vercel.app
 *   - Production:       company.yourapp.se
 */

import { RESERVED_SUBDOMAINS } from './constants'

export function resolveTenantFromHost(hostname: string, rootDomain: string): string | null {
  const host = hostname.split(':')[0].toLowerCase() // strip port for local dev
  const root = rootDomain.split(':')[0].toLowerCase()

  let candidate: string | null = null

  if (host.endsWith('.localhost')) {
    // company.localhost -> "company"
    candidate = host.replace('.localhost', '')
  } else if (host.endsWith('.vercel.app')) {
    // Vercel preview deployments encode the subdomain as
    // "company---branch-name.vercel.app" since preview URLs can't use
    // real wildcard subdomains the way production DNS can.
    const withoutVercelSuffix = host.replace('.vercel.app', '')
    const [tenantPart] = withoutVercelSuffix.split('---')
    candidate = tenantPart || null
  } else if (host.endsWith(`.${root}`)) {
    candidate = host.replace(`.${root}`, '')
  } else if (host === root) {
    return null // root domain itself — marketing site, not a tenant
  }

  if (!candidate) return null
  if (RESERVED_SUBDOMAINS.has(candidate)) return null

  return candidate
}
