/**
 * lib/services/company.service.ts
 */

import { createClient } from '@/lib/supabase/server'
import { createRepositories } from '@/lib/repositories'
import { assertCan } from '@/lib/auth/permissions'
import type { Actor } from '@/types/auth'
import type { TablesUpdate } from '@/lib/supabase/database.types'

export async function updateBranding(actor: Actor, companyId: string, input: TablesUpdate<'company_branding'>) {
  assertCan(actor, 'update', 'branding', { resourceCompanyId: companyId })

  const supabase = await createClient()
  const repos = createRepositories(supabase)
  const branding = await repos.companies.updateBranding(companyId, input)

  await repos.auditLog.record({
    company_id: companyId,
    actor_id: actor.userId,
    actor_type: actor.kind === 'super_admin' ? 'super_admin' : actor.kind,
    action: 'branding.updated',
    entity_type: 'company_branding',
    entity_id: companyId,
    metadata: { changes: input },
  })

  return branding
}

export async function inviteStaffMember(
  actor: Actor,
  companyId: string,
  userId: string,
  role: 'owner' | 'property_manager' | 'maintenance_staff' | 'contractor'
) {
  assertCan(actor, 'manage_staff', 'membership', { resourceCompanyId: companyId })

  const supabase = await createClient()
  const repos = createRepositories(supabase)
  const membership = await repos.companies.inviteMember({
    company_id: companyId,
    user_id: userId,
    role,
    invited_by: actor.userId,
    status: 'invited',
  })

  await repos.auditLog.record({
    company_id: companyId,
    actor_id: actor.userId,
    actor_type: actor.kind === 'super_admin' ? 'super_admin' : actor.kind,
    action: 'membership.invited',
    entity_type: 'company_membership',
    entity_id: membership.id,
    metadata: { role },
  })

  return membership
}
