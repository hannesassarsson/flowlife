import Link from 'next/link'
import { getCurrentActor } from '@/lib/auth/get-current-actor'
import { createClient } from '@/lib/supabase/server'
import { createRepositories } from '@/lib/repositories'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default async function PropertiesPage() {
  const actor = await getCurrentActor()
  if (!actor || actor.kind !== 'staff') return null // layout already guards non-staff

  const supabase = await createClient()
  const repos = createRepositories(supabase)
  const properties = await repos.properties.listByCompany(actor.companyId)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-medium tracking-tight">Properties</h1>
        <p className="text-sm text-muted">{properties.length} properties in your company</p>
      </div>

      {properties.length === 0 ? (
        <p className="text-sm text-muted">No properties yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {properties.map((property) => (
            <Link key={property.id} href={`/dashboard/properties/${property.id}`}>
              <Card className="transition-colors hover:border-ink">
                <CardHeader>
                  <CardTitle>{property.name}</CardTitle>
                  <CardDescription>
                    {property.address_line1}, {property.city}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
