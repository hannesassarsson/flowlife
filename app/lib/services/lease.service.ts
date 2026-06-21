/**
 * lib/services/lease.service.ts
 */

import { createClient } from '@/lib/supabase/server'
import { createRepositories } from '@/lib/repositories'
import { assertCan } from '@/lib/auth/permissions'
import type { Actor } from '@/types/auth'
import type { TablesInsert } from '@/lib/supabase/database.types'

/**
 * Creates a lease AND links tenants to it in one operation — this is a
 * good example of why services exist above repositories: a Server Action
 * calling repos.leases.create() and repos.leases.addTenant() separately
 * would leave a window where the lease exists with no tenant attached if
 * the second call fails. Wrapping both here at least keeps the two steps
 * adjacent and consistently audit-logged; true atomicity would need a
 * Postgres function/transaction, which is a reasonable next step if this
 * gap matters in practice.
 */
export async function createLeaseWithTenants(
  actor: Actor,
  leaseInput: TablesInsert<'leases'>,
  tenantIds: { tenantId: string; isPrimary?: boolean }[]
) {
  assertCan(actor, 'create', 'lease', { resourceCompanyId: leaseInput.company_id })

  const supabase = await createClient()
  const repos = createRepositories(supabase)

  const lease = await repos.leases.create(leaseInput)
  // units.status flips to 'occupied' automatically via
  // sync_unit_status_on_lease_change trigger (migration 0004) — no
  // manual unit update needed here.

  for (const { tenantId, isPrimary } of tenantIds) {
    await repos.leases.addTenant({ lease_id: lease.id, tenant_id: tenantId, is_primary: isPrimary ?? false })
  }

  await repos.auditLog.record({
    company_id: lease.company_id,
    actor_id: actor.userId,
    actor_type: actor.kind === 'super_admin' ? 'super_admin' : actor.kind,
    action: 'lease.created',
    entity_type: 'lease',
    entity_id: lease.id,
    metadata: { tenant_count: tenantIds.length },
  })

  return lease
}

export async function terminateLease(actor: Actor, leaseId: string) {
  const supabase = await createClient()
  const repos = createRepositories(supabase)

  const existing = await repos.leases.getById(leaseId)
  if (!existing) throw new Error('Lease not found')

  assertCan(actor, 'update', 'lease', { resourceCompanyId: existing.company_id })

  const updated = await repos.leases.update(leaseId, {
    status: 'terminated',
    end_date: new Date().toISOString().slice(0, 10),
  })
  // units.status flips back to 'vacant' automatically via the same trigger.

  await repos.auditLog.record({
    company_id: existing.company_id,
    actor_id: actor.userId,
    actor_type: actor.kind === 'super_admin' ? 'super_admin' : actor.kind,
    action: 'lease.terminated',
    entity_type: 'lease',
    entity_id: leaseId,
  })

  return updated
}
