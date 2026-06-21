import Link from 'next/link'
import { getCurrentActor } from '@/lib/auth/get-current-actor'
import { createClient } from '@/lib/supabase/server'
import { createRepositories } from '@/lib/repositories'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default async function PortalDashboardPage() {
  const actor = await getCurrentActor()
  if (!actor || actor.kind !== 'tenant') return null

  const supabase = await createClient()
  const repos = createRepositories(supabase)

  const leases = await repos.leases.listByTenant(actor.userId)
  const requests = await repos.maintenance.listForActor()
  const openCount = requests.filter((r) => r.status !== 'completed' && r.status !== 'closed').length

  // Typed explicitly rather than @ts-expect-error inline in JSX — see
  // app/(platform)/dashboard/maintenance/page.tsx for why that pattern is
  // unreliable here. Cast once, use plain property access everywhere
  // below.
  type LeaseRow = (typeof leases)[number] & {
    leases?: {
      rent_amount: number
      rent_currency: string
      status: string
      units?: { id: string; unit_number: string; rooms: number | null; size_sqm: number | null } | null
    } | null
  }
  const typedLeases = leases as LeaseRow[]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-medium tracking-tight">Welcome, {actor.fullName}</h1>
        <Badge variant="accent" className="mt-1">
          Tenant
        </Badge>
      </div>

      {typedLeases.map(({ lease_id, leases: lease }) => {
        const unit = lease?.units
        return (
          <Card key={lease_id}>
            <CardHeader>
              <CardTitle>Apartment {unit?.unit_number}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted">
              {unit?.rooms} rooms · {unit?.size_sqm} m² · {lease?.rent_amount} {lease?.rent_currency}/month
            </CardContent>
          </Card>
        )
      })}

      <Card>
        <CardHeader>
          <CardTitle>Maintenance requests</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p className="text-muted">
            {openCount} open of {requests.length} total
          </p>
          <Link href="/portal/maintenance" className="text-accent underline-offset-4 hover:underline">
            View and create requests →
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
