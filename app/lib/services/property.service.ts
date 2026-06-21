/**
 * lib/services/property.service.ts
 */

import { createClient } from '@/lib/supabase/server'
import { createRepositories } from '@/lib/repositories'
import { assertCan } from '@/lib/auth/permissions'
import type { Actor } from '@/types/auth'
import type { TablesInsert, TablesUpdate } from '@/lib/supabase/database.types'

export async function createProperty(actor: Actor, input: TablesInsert<'properties'>) {
  assertCan(actor, 'create', 'property', { resourceCompanyId: input.company_id })

  const supabase = await createClient()
  const repos = createRepositories(supabase)
  const property = await repos.properties.create(input)

  await repos.auditLog.record({
    company_id: property.company_id,
    actor_id: actor.userId,
    actor_type: actor.kind === 'super_admin' ? 'super_admin' : actor.kind,
    action: 'property.created',
    entity_type: 'property',
    entity_id: property.id,
  })

  return property
}

export async function createUnit(actor: Actor, buildingCompanyId: string, input: TablesInsert<'units'>) {
  assertCan(actor, 'create', 'unit', { resourceCompanyId: buildingCompanyId })

  const supabase = await createClient()
  const repos = createRepositories(supabase)
  const unit = await repos.properties.createUnit(input)

  await repos.auditLog.record({
    company_id: unit.company_id,
    actor_id: actor.userId,
    actor_type: actor.kind === 'super_admin' ? 'super_admin' : actor.kind,
    action: 'unit.created',
    entity_type: 'unit',
    entity_id: unit.id,
  })

  return unit
}

export async function updateUnit(actor: Actor, unitId: string, input: TablesUpdate<'units'>) {
  const supabase = await createClient()
  const repos = createRepositories(supabase)

  const existing = await repos.properties.getUnitById(unitId)
  if (!existing) throw new Error('Unit not found')

  assertCan(actor, 'update', 'unit', { resourceCompanyId: existing.company_id })

  const updated = await repos.properties.updateUnit(unitId, input)

  await repos.auditLog.record({
    company_id: existing.company_id,
    actor_id: actor.userId,
    actor_type: actor.kind === 'super_admin' ? 'super_admin' : actor.kind,
    action: 'unit.updated',
    entity_type: 'unit',
    entity_id: unitId,
    metadata: { changes: input },
  })

  return updated
}
