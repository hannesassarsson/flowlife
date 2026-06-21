import Link from 'next/link'
import { getCurrentActor } from '@/lib/auth/get-current-actor'
import { createClient } from '@/lib/supabase/server'
import { createRepositories } from '@/lib/repositories'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function DashboardPage() {
  const actor = await getCurrentActor()
  if (!actor || actor.kind === 'tenant') return null // layout already guards this

  const supabase = await createClient()
  const repos = createRepositories(supabase)

  const companyId = actor.kind === 'staff' ? actor.companyId : null
  const properties = companyId ? await repos.properties.listByCompany(companyId) : []
  const requests = await repos.maintenance.listForActor()

  const openCount = requests.filter((r) => r.status !== 'completed' && r.status !== 'closed').length

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-medium tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted">
          {actor.kind === 'staff' ? `Signed in as ${actor.fullName}` : 'Signed in'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Properties</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-medium">{properties.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Open maintenance requests</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-medium">{openCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total requests</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-medium">{requests.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3 text-sm">
        <Link href="/dashboard/properties" className="text-accent underline-offset-4 hover:underline">
          View properties →
        </Link>
        <Link href="/dashboard/maintenance" className="text-accent underline-offset-4 hover:underline">
          View maintenance requests →
        </Link>
      </div>
    </div>
  )
}
