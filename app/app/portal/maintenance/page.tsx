import { getCurrentActor } from '@/lib/auth/get-current-actor'
import { createClient } from '@/lib/supabase/server'
import { createRepositories } from '@/lib/repositories'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { createMaintenanceRequestAction } from './actions'

const CATEGORY_OPTIONS = [
  'plumbing',
  'electrical',
  'appliance',
  'hvac',
  'structural',
  'pest',
  'other',
] as const

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'danger' | 'accent'> = {
  new: 'accent',
  in_progress: 'default',
  waiting: 'default',
  completed: 'success',
  closed: 'default',
}

export default async function TenantMaintenancePage() {
  const actor = await getCurrentActor()
  if (!actor || actor.kind !== 'tenant') return null

  const supabase = await createClient()
  const repos = createRepositories(supabase)

  const leases = await repos.leases.listByTenant(actor.userId)
  // Cast to `any` rather than @ts-expect-error: the hand-written
  // database.types.ts stub (see its header comment) doesn't model
  // Supabase's joined-relation shapes from select('leases(*, units(*))'),
  // and whether that mismatch surfaces as a type error depends on
  // inference details this sandbox can't verify by actually running tsc.
  // An `any` cast is correct regardless of which way that inference
  // goes, where @ts-expect-error would itself fail to compile if the
  // access turns out to be valid. Replace with real typed access once
  // `npm run gen:types` produces accurate join types.
  const activeLease = (leases as any[]).find((l) => l.leases?.status === 'active')
  const unit = activeLease?.leases?.units as
    | { id: string; unit_number: string; rooms: number | null; size_sqm: number | null }
    | undefined

  const requests = await repos.maintenance.listForActor()

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-lg font-medium tracking-tight">Maintenance</h1>
        <p className="text-sm text-muted">Report an issue or check the status of a previous request.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New request</CardTitle>
        </CardHeader>
        <CardContent>
          {!unit ? (
            <p className="text-sm text-muted">No active lease found — contact your property manager.</p>
          ) : (
            <form action={createMaintenanceRequestAction} className="flex flex-col gap-4">
              <input type="hidden" name="unitId" value={unit.id} />
              <input type="hidden" name="leaseId" value={activeLease.lease_id} />

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" required placeholder="e.g. Leaking kitchen faucet" />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="category">Category</Label>
                <Select id="category" name="category" defaultValue="other">
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  name="description"
                  required
                  rows={3}
                  className="rounded-sm border border-line bg-paper px-3 py-2 text-sm outline-none focus-visible:border-ink"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="image">Photo (optional)</Label>
                <Input id="image" name="image" type="file" accept="image/*" />
              </div>

              <Button type="submit" className="self-start">
                Submit request
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted">Your requests</h2>
        {requests.length === 0 ? (
          <p className="text-sm text-muted">No requests yet.</p>
        ) : (
          requests.map((request) => (
            <Card key={request.id}>
              <CardHeader className="flex-row items-start justify-between gap-4">
                <CardTitle>{request.title}</CardTitle>
                <Badge variant={STATUS_VARIANT[request.status] ?? 'default'}>
                  {request.status.replace('_', ' ')}
                </Badge>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted">{request.description}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
