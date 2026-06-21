import { getCurrentActor } from '@/lib/auth/get-current-actor'
import { createClient } from '@/lib/supabase/server'
import { createRepositories } from '@/lib/repositories'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { updateStatusAction, assignRequestAction } from './actions'

const STATUS_OPTIONS = ['new', 'in_progress', 'waiting', 'completed', 'closed'] as const

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'danger' | 'accent'> = {
  new: 'accent',
  in_progress: 'default',
  waiting: 'default',
  completed: 'success',
  closed: 'default',
}

export default async function MaintenanceDashboardPage() {
  const actor = await getCurrentActor()
  if (!actor || actor.kind !== 'staff') return null

  const supabase = await createClient()
  const repos = createRepositories(supabase)

  // RLS already scopes this per role: owner/PM see every request in the
  // company, maintenance_staff/contractor see only what's assigned to
  // them (see can_view_maintenance_request() and the migration 0010
  // history) — this page doesn't add any extra filtering on top.
  const requests = await repos.maintenance.listForActor()
  const members = await repos.companies.listMembers(actor.companyId)

  const canManage = actor.role === 'owner' || actor.role === 'property_manager'

  // Joined-relation rows, typed explicitly rather than relying on
  // @ts-expect-error inside JSX (which doesn't reliably suppress errors
  // on the same line as a JSX expression, and risks an "unused directive"
  // compile error if the hand-written stub's inference happens to match
  // anyway — see database.types.ts header comment on regenerating this
  // properly via `npm run gen:types`).
  type RequestWithUnit = (typeof requests)[number] & {
    units?: { unit_number: string; building_id: string } | null
  }
  type MemberWithProfile = (typeof members)[number] & {
    user_profiles?: { full_name: string; email: string } | null
  }
  const typedRequests = requests as RequestWithUnit[]
  const typedMembers = members as MemberWithProfile[]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-medium tracking-tight">Maintenance requests</h1>
        <p className="text-sm text-muted">
          {canManage
            ? `${requests.length} requests across the company`
            : `${requests.length} requests assigned to you`}
        </p>
      </div>

      {requests.length === 0 ? (
        <p className="text-sm text-muted">No maintenance requests.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {typedRequests.map((request) => (
            <Card key={request.id}>
              <CardHeader className="flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>{request.title}</CardTitle>
                  <p className="mt-1 text-sm text-muted">
                    Apartment {request.units?.unit_number ?? '—'} · {request.category ?? 'uncategorized'}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[request.status] ?? 'default'}>
                  {request.status.replace('_', ' ')}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm">{request.description}</p>

                {canManage && (
                  <div className="flex flex-wrap items-end gap-3 border-t border-line pt-3">
                    <form action={updateStatusAction} className="flex items-end gap-2">
                      <input type="hidden" name="requestId" value={request.id} />
                      <Select name="status" defaultValue={request.status}>
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status.replace('_', ' ')}
                          </option>
                        ))}
                      </Select>
                      <Button type="submit" size="sm" variant="outline">
                        Update status
                      </Button>
                    </form>

                    <form action={assignRequestAction} className="flex items-end gap-2">
                      <input type="hidden" name="requestId" value={request.id} />
                      <Select name="assigneeId" defaultValue={request.assigned_to ?? ''}>
                        <option value="" disabled>
                          Assign to…
                        </option>
                        {typedMembers.map((member) => (
                          <option key={member.id} value={member.user_id}>
                            {member.user_profiles?.full_name ?? member.user_id} ({member.role})
                          </option>
                        ))}
                      </Select>
                      <Button type="submit" size="sm" variant="outline">
                        Assign
                      </Button>
                    </form>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
