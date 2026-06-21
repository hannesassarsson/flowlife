/**
 * app/(auth)/layout.tsx
 *
 * Platform-level auth pages for STAFF (company owners, PMs, etc.) signing
 * into the dashboard. SLICE SCOPE NOTE: the approved architecture also has
 * a separate tenant-portal login at app/portal/[subdomain]/(public)/login,
 * since tenants normally authenticate against their landlord's branded
 * subdomain rather than this generic page. This slice has no subdomain
 * routing (see proxy.ts header comment), so tenants sign in here too —
 * proxy.ts and getCurrentActor() route them to /portal/dashboard instead
 * of /dashboard after login based on actor.kind, not based on which page
 * they signed in from.
 *
 * No server-side redirect-if-authenticated here — that's handled in
 * proxy.ts (PUBLIC_AUTH_PATHS branch) so it applies before any page-level
 * code runs.
 */

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
