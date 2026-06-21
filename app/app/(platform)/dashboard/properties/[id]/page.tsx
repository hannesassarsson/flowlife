import { notFound } from 'next/navigation'
import { getCurrentActor } from '@/lib/auth/get-current-actor'
import { createClient } from '@/lib/supabase/server'
import { createRepositories } from '@/lib/repositories'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const UNIT_STATUS_VARIANT: Record<string, 'default' | 'success' | 'danger' | 'accent'> = {
  vacant: 'accent',
  occupied: 'success',
  maintenance: 'danger',
  unavailable: 'default',
}

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const actor = await getCurrentActor()
  if (!actor || actor.kind !== 'staff') return null

  const supabase = await createClient()
  const repos = createRepositories(supabase)

  // RLS scopes this to the actor's own company — a property ID from
  // another company simply won't be returned, so notFound() doubles as
  // both "doesn't exist" and "not yours to see."
  const property = await repos.properties.getById(id)
  if (!property) notFound()

  const buildings = await repos.properties.listBuildings(id)
  const unitsByBuilding = await Promise.all(
    buildings.map(async (building) => ({
      building,
      units: await repos.properties.listUnitsByBuilding(building.id),
    }))
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-medium tracking-tight">{property.name}</h1>
        <p className="text-sm text-muted">
          {property.address_line1}, {property.city} {property.postal_code}
        </p>
      </div>

      {unitsByBuilding.map(({ building, units }) => (
        <div key={building.id} className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted">{building.name}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {units.map((unit) => (
              <Card key={unit.id}>
                <CardHeader>
                  <CardTitle>Apartment {unit.unit_number}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-sm text-muted">
                  <div className="flex items-center justify-between">
                    <span>
                      {unit.rooms} rooms · {unit.size_sqm} m²
                    </span>
                    <Badge variant={UNIT_STATUS_VARIANT[unit.status] ?? 'default'}>
                      {unit.status}
                    </Badge>
                  </div>
                  {unit.rent_amount && (
                    <span>
                      {unit.rent_amount} {unit.rent_currency} / month
                    </span>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
