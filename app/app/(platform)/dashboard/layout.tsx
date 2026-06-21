/**
 * app/(platform)/dashboard/layout.tsx
 *
 * The authoritative access check for ALL dashboard routes. requireStaff()
 * redirects to /login if unauthenticated, or to a safe fallback if
 * authenticated but not staff (e.g. a tenant somehow hit this route
 * directly).
 *
 * SLICE ADDITION: also renders the shared nav shell (company name, role
 * badge, logout) here, since every dashboard page needs to show this per
 * the MVP spec and there's no separate UI-component pass yet.
 */

import Link from 'next/link'
import { requireStaff } from '@/lib/auth/require-role'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { logout } from '@/app/(auth)/login/actions'

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  property_manager: 'Property Manager',
  maintenance_staff: 'Maintenance Staff',
  contractor: 'Contractor',
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireStaff()

  let companyName = 'Platform'
  if (actor.kind === 'staff') {
    const supabase = await createClient()
    const { data } = await supabase
      .from('companies')
      .select('name')
      .eq('id', actor.companyId)
      .maybeSingle()
    companyName = data?.name ?? 'Unknown company'
  }

  const roleLabel =
    actor.kind === 'super_admin' ? 'Super Admin' : ROLE_LABELS[actor.role] ?? actor.role

  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-baseline gap-3">
            <Link href="/dashboard" className="text-sm font-medium tracking-tight">
              {companyName}
            </Link>
            <Badge variant="accent">{roleLabel}</Badge>
          </div>
          <nav className="flex items-center gap-5 text-sm text-muted">
            <Link href="/dashboard/properties" className="hover:text-ink">
              Properties
            </Link>
            <Link href="/dashboard/maintenance" className="hover:text-ink">
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
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  )
}
