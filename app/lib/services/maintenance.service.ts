/**
 * lib/services/maintenance.service.ts
 *
 * Services are where permission checks, cross-repository orchestration,
 * and audit logging happen. Repositories never call assertCan() or write
 * to audit_logs themselves — that would scatter business rules across
 * data-access code. A Server Action calls a service function, never a
 * repository directly, except for simple unauthenticated reads (e.g.
 * branding lookup) that have no business logic to enforce.
 */

import { createClient } from '@/lib/supabase/server'
import { createRepositories } from '@/lib/repositories'
import { assertCan } from '@/lib/auth/permissions'
import type { Actor } from '@/types/auth'
import type { TablesInsert } from '@/lib/supabase/database.types'

export async function createMaintenanceRequest(
  actor: Actor,
  input: Omit<TablesInsert<'maintenance_requests'>, 'created_by' | 'created_by_type'>
) {
  assertCan(actor, 'create', 'maintenance_request', { resourceCompanyId: input.company_id ?? undefined })

  const supabase = await createClient()
  const repos = createRepositories(supabase)

  const request = await repos.maintenance.create({
    ...input,
    created_by: actor.userId,
    created_by_type: actor.kind === 'tenant' ? 'tenant' : 'staff',
  })

  await repos.auditLog.record({
    company_id: request.company_id,
    actor_id: actor.userId,
    actor_type: actor.kind === 'super_admin' ? 'super_admin' : actor.kind,
    action: 'maintenance_request.created',
    entity_type: 'maintenance_request',
    entity_id: request.id,
  })

  return request
}

export async function updateMaintenanceRequestStatus(
  actor: Actor,
  requestId: string,
  newStatus: NonNullable<TablesInsert<'maintenance_requests'>['status']>
) {
  const supabase = await createClient()
  const repos = createRepositories(supabase)

  const existing = await repos.maintenance.getById(requestId)
  if (!existing) throw new Error('Maintenance request not found')

  assertCan(actor, 'update', 'maintenance_request', {
    resourceCompanyId: existing.company_id,
    isAssignee: actor.kind === 'staff' && existing.assigned_to === actor.userId,
  })

  const updated = await repos.maintenance.updateStatus(requestId, newStatus)

  // No manual history insert here — log_maintenance_status_change trigger
  // (migration 0005) handles it automatically on the UPDATE above.

  await repos.auditLog.record({
    company_id: existing.company_id,
    actor_id: actor.userId,
    actor_type: actor.kind === 'super_admin' ? 'super_admin' : actor.kind,
    action: 'maintenance_request.status_changed',
    entity_type: 'maintenance_request',
    entity_id: requestId,
    metadata: { from_status: existing.status, to_status: newStatus },
  })

  return updated
}

export async function assignMaintenanceRequest(actor: Actor, requestId: string, assigneeUserId: string) {
  const supabase = await createClient()
  const repos = createRepositories(supabase)

  const existing = await repos.maintenance.getById(requestId)
  if (!existing) throw new Error('Maintenance request not found')

  assertCan(actor, 'assign', 'maintenance_request', { resourceCompanyId: existing.company_id })

  const updated = await repos.maintenance.assign(requestId, assigneeUserId)

  await repos.auditLog.record({
    company_id: existing.company_id,
    actor_id: actor.userId,
    actor_type: actor.kind === 'super_admin' ? 'super_admin' : actor.kind,
    action: 'maintenance_request.assigned',
    entity_type: 'maintenance_request',
    entity_id: requestId,
    metadata: { assigned_to: assigneeUserId },
  })

  return updated
}

export async function addMaintenanceComment(actor: Actor, requestId: string, body: string) {
  const supabase = await createClient()
  const repos = createRepositories(supabase)

  const existing = await repos.maintenance.getById(requestId)
  if (!existing) throw new Error('Maintenance request not found')

  assertCan(actor, 'create', 'maintenance_comment', {
    resourceCompanyId: existing.company_id,
    isAssignee: actor.kind === 'staff' && existing.assigned_to === actor.userId,
    isOwnRecord: actor.kind === 'tenant', // RLS double-checks this against tenant_unit_ids()
  })

  return repos.maintenance.addComment({
    request_id: requestId,
    author_id: actor.userId,
    author_type: actor.kind === 'tenant' ? 'tenant' : 'staff',
    body,
  })
}
