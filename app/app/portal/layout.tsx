/**
 * app/portal/layout.tsx
 *
 * SLICE SCOPE NOTE: the approved architecture's tenant portal lives at
 * app/portal/[subdomain]/(authenticated)/layout.tsx and re-verifies the
 * actor against a company resolved from the subdomain
 * (getCurrentActorForCompany) — see ARCHITECTURE.md "Key conventions" #7.
 * This slice has no subdomain routing (see proxy.ts header comment), so
 * plain getCurrentActor() + requireTenant() is correct and sufficient
 * here. Don't copy this simplified guard back into the real multi-tenant
 * portal routes once those are built.
 */

import Link from 'next/link'
import { requireTenant } from '@/lib/auth/require-role'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/(auth)/login/actions'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireTenant()

  let companyName = 'My Home'
  if (actor.kind === 'tenant') {
    const supabase = await createClient()
    const { data } = await supabase
      .from('companies')
      .select('name')
      .eq('id', actor.companyId)
      .maybeSingle()
    companyName = data?.name ?? companyName
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/portal/dashboard" className="text-sm font-medium tracking-tight">
            {companyName}
          </Link>
          <nav className="flex items-center gap-5 text-sm text-muted">
            <Link href="/portal/maintenance" className="hover:text-ink">
              Maintenance
            </Link>
            <form action={logout}>
              <button type="submit" className="hover:text-ink">
                Log out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">{children}</main>
    </div>
  )
}
